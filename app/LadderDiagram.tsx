"use client";

import { layoutProgram, RH } from "@/lib/layout";
import type { SimState } from "@/lib/simulator";
import type { Program } from "@/lib/types";

// Gaya mengikuti CX-Programmer: garis hitam, nama simbol biru, elemen yang menghantar hijau.
const BLACK = "#111111";
const GREEN = "#15803D";
const BLUE = "#1D4ED8";

export default function LadderDiagram({ program, state }: { program: Program; state: SimState }) {
  const { shapes, width, height } = layoutProgram(program);
  const val = (a: string): boolean =>
    /^T\d+$/.test(a)
      ? state.timers["T" + parseInt(a.slice(1), 10)]?.done ?? false
      : state.bits[a] ?? false;
  const half = RH / 2;

  return (
    <div className="overflow-x-auto bg-white p-2">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fontFamily="Consolas, 'Courier New', monospace" fontSize="12">
        {shapes.map((s, i) => {
          if (s.k === "line")
            return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={BLACK} strokeWidth="1.5" />;
          if (s.k === "text")
            return <text key={i} x={s.x} y={s.y} fill="#555" textAnchor={s.anchor ?? "start"}>{s.s}</text>;
          if (s.k === "note")
            return <text key={i} x={s.x} y={s.y} fill={BLUE}>{s.s}</text>;
          if (s.k === "contact") {
            const mid = s.y + half;
            const pass = s.nc ? !val(s.addr) : val(s.addr);
            const c = pass ? GREEN : BLACK;
            return (
              <g key={i} stroke={c} strokeWidth="2">
                <line x1={s.x} y1={mid} x2={s.x + 30} y2={mid} />
                <line x1={s.x + 50} y1={mid} x2={s.x + 80} y2={mid} />
                <line x1={s.x + 30} y1={mid - 13} x2={s.x + 30} y2={mid + 13} />
                <line x1={s.x + 50} y1={mid - 13} x2={s.x + 50} y2={mid + 13} />
                {s.nc && <line x1={s.x + 27} y1={mid + 13} x2={s.x + 53} y2={mid - 13} />}
                <text x={s.x + 40} y={mid - 18} fill={BLACK} stroke="none" textAnchor="middle">{s.addr}</text>
                {s.label && <text x={s.x + 40} y={mid + 28} fill={BLUE} stroke="none" fontSize="11" textAnchor="middle">{s.label}</text>}
              </g>
            );
          }
          if (s.k === "coil") {
            const on = val(s.addr);
            return (
              <g key={i}>
                <circle cx={s.x} cy={s.y} r="12" fill={on ? "#86EFAC" : "#FFFFFF"} stroke={on ? GREEN : BLACK} strokeWidth="2" />
                <text x={s.x} y={s.y - 20} fill={BLACK} textAnchor="middle">{s.addr}</text>
              </g>
            );
          }
          const t = state.timers["T" + parseInt(s.no, 10)];
          const done = t?.done ?? false;
          return (
            <g key={i}>
              <rect x={s.x} y={s.y} width="100" height="60" fill="#FFFFFF" stroke={done ? GREEN : BLACK} strokeWidth="2" />
              <text x={s.x + 50} y={s.y + 19} fill={BLACK} textAnchor="middle">TIM {s.no}</text>
              <text x={s.x + 50} y={s.y + 35} fill={BLACK} textAnchor="middle">#{s.preset}</text>
              <text x={s.x + 50} y={s.y + 51} fill={done ? GREEN : "#555"} textAnchor="middle">
                {((t?.elapsedMs ?? 0) / 1000).toFixed(1)} s
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
