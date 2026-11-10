import type { Instruction, Program } from "./types";

export type Shape =
  | { k: "line"; x1: number; y1: number; x2: number; y2: number }
  | { k: "text"; x: number; y: number; s: string; anchor?: "start" | "middle" }
  | { k: "contact"; x: number; y: number; addr: string; nc: boolean; label?: string }
  | { k: "note"; x: number; y: number; s: string }
  | { k: "coil"; x: number; y: number; addr: string }
  | { k: "tim"; x: number; y: number; no: string; preset: number; kind: "TIM" | "CNT"; h: number };

type Node = { t: "c"; addr: string; nc: boolean; label?: string } | { t: "s" | "p"; kids: Node[] };

const CW = 80; // lebar kontak
export const RH = 60; // tinggi satu baris

const join = (t: "s" | "p", a: Node, b: Node): Node => ({
  t,
  kids: a.t === t ? [...a.kids, b] : [a, b],
});

function size(n: Node): { w: number; h: number } {
  if (n.t === "c") return { w: CW, h: RH };
  const k = n.kids.map(size);
  return n.t === "s"
    ? { w: k.reduce((a, b) => a + b.w, 0), h: Math.max(...k.map((x) => x.h)) }
    : { w: Math.max(...k.map((x) => x.w)), h: k.reduce((a, b) => a + b.h, 0) };
}

function draw(n: Node, x: number, y: number, w: number, out: Shape[]) {
  const mid = y + RH / 2;
  const line = (x1: number, y1: number, x2: number, y2: number) => out.push({ k: "line", x1, y1, x2, y2 });
  if (n.t === "c") return void out.push({ k: "contact", x, y, addr: n.addr, nc: n.nc, label: n.label });
  if (n.t === "s") {
    let cx = x;
    for (const kid of n.kids) {
      const sz = size(kid);
      draw(kid, cx, y, sz.w, out);
      cx += sz.w;
    }
    if (cx < x + w) line(cx, mid, x + w, mid);
    return;
  }
  let cy = y;
  const mids: number[] = [];
  for (const kid of n.kids) {
    const sz = size(kid);
    draw(kid, x, cy, sz.w, out);
    if (sz.w < w) line(x + sz.w, cy + RH / 2, x + w, cy + RH / 2);
    mids.push(cy + RH / 2);
    cy += sz.h;
  }
  line(x, mids[0], x, mids[mids.length - 1]);
  line(x + w, mids[0], x + w, mids[mids.length - 1]);
}

/**
 * Model tumpukan blok: AND = seri, OR = paralel dengan blok saat ini, LD memulai blok baru,
 * ANDLD/ORLD menggabungkan blok saat ini dengan blok di tumpukan. Untuk CNT, blok saat ini
 * adalah input reset dan blok di tumpukan adalah input hitung.
 */
export function buildCondition(ins: Instruction[]): { cond: Node | null; reset: Node | null; out: Instruction | null } {
  const last = ins[ins.length - 1];
  const hasOut = !!last && ["OUT", "TIM", "CNT"].includes(last.op);
  const body = hasOut ? ins.slice(0, -1) : ins;
  const stack: Node[] = [];
  let cur: Node | null = null;
  for (const i of body) {
    if (i.op === "ANDLD" || i.op === "ORLD") {
      const a = stack.pop();
      if (a && cur) cur = join(i.op === "ANDLD" ? "s" : "p", a, cur);
      continue;
    }
    const c: Node = { t: "c", addr: i.arg, nc: i.op.endsWith("NOT"), label: i.label };
    if (i.op === "LD" || i.op === "LD NOT") {
      if (cur) stack.push(cur);
      cur = c;
    } else if (!cur) cur = c;
    else cur = join(i.op.startsWith("OR") ? "p" : "s", cur, c);
  }
  if (hasOut && last.op === "CNT") return { cond: stack.pop() ?? null, reset: cur, out: last };
  return { cond: cur, reset: null, out: hasOut ? last : null };
}

export function layoutProgram(program: Program): { shapes: Shape[]; width: number; height: number } {
  const shapes: Shape[] = [];
  const rungs = program.map((r) => {
    const b = buildCondition(r.instructions);
    const rs = b.reset ? size(b.reset) : null;
    return { r, b, rs, sz: b.cond ? size(b.cond) : { w: 0, h: RH } };
  });
  const maxW = Math.max(CW, ...rungs.map((x) => Math.max(x.sz.w, x.rs?.w ?? 0)));
  const LEFT = 40;
  const OUTX = LEFT + maxW + 30;
  const RIGHT = OUTX + 130;
  const line = (x1: number, y1: number, x2: number, y2: number) => shapes.push({ k: "line", x1, y1, x2, y2 });
  let y = 10;
  for (const { r, b, rs, sz } of rungs) {
    const mid = y + RH / 2;
    const countH = Math.max(sz.h, RH);
    shapes.push({ k: "text", x: 4, y: mid + 4, s: String(r.no - 1) });
    if (b.cond) draw(b.cond, LEFT, y, sz.w, shapes);
    line(LEFT + sz.w, mid, OUTX, mid);
    if (b.reset && rs) {
      // Baris kedua untuk input reset CNT, masuk ke kotak CNT di sisi bawah.
      const y2 = y + countH;
      draw(b.reset, LEFT, y2, rs.w, shapes);
      line(LEFT + rs.w, y2 + RH / 2, OUTX, y2 + RH / 2);
    }
    if (b.out?.op === "OUT") {
      shapes.push({ k: "coil", x: OUTX + 30, y: mid, addr: b.out.arg });
      line(OUTX, mid, OUTX + 18, mid);
      line(OUTX + 42, mid, RIGHT, mid);
      if (b.out.label) shapes.push({ k: "note", x: RIGHT + 12, y: mid + 4, s: b.out.label });
    } else if (b.out) {
      const isCnt = b.out.op === "CNT";
      shapes.push({
        k: "tim", x: OUTX, y: mid - 18, no: b.out.arg, preset: b.out.preset ?? 0,
        kind: isCnt ? "CNT" : "TIM", h: isCnt ? countH + 36 : 60,
      });
      line(OUTX + 100, mid, RIGHT, mid);
      if (b.out.label) shapes.push({ k: "note", x: RIGHT + 12, y: mid + 4, s: b.out.label });
    }
    y += Math.max(sz.h + (rs ? rs.h : 0), 70) + 20;
  }
  line(LEFT, 10, LEFT, y - 10);
  line(RIGHT, 10, RIGHT, y - 10);
  return { shapes, width: RIGHT + 240, height: y };
}
