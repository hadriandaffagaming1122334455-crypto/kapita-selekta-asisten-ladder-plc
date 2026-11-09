"use client";

import { layoutProgram } from "@/lib/layout";
import type { SimState } from "@/lib/simulator";
import type { Program } from "@/lib/types";

const COLORS = { input: "#2563EB", work: "#7C3AED", timer: "#D97706", output: "#059669" };
const IDLE = "#94A3B8";
const WIRE = "#64748B";

export const LEGEND: [string, string][] = [
  ["Input", COLORS.input],
  ["Bit kerja", COLORS.work],
  ["Timer", COLORS.timer],
  ["Output", COLORS.output],
];

function kind(a: string): keyof typeof COLORS {
  if (/^T\d+$/.test(a)) return "timer";
  if (/^[01]\.\d{2}$/.test(a)) return "input";
  if (/^10[01]\.\d{2}$/.test(a)) return "output";
  return "work";
}

export default function LadderDiagram({ program, state }: { program: Program; state: SimState }) {
  const { shapes, width, height } = layoutProgram(program);
  const val = (a: string): boolean =>
    /^T\d+$/.test(a)
      ? state.timers["T" + parseInt(a.slice(1), 10)]?.done ?? false
      : state.bits[a] ?? false;

  return (
    <div
      className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3"
      style={{ backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "16px 16px" }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fontFamily="Consolas, monospace" fontSize="12">
        {shapes.map((s, i) => {
          if (s.k === "line")
            return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={WIRE} strokeWidth="2" />;
          if (s.k === "text")
            return <text key={i} x={s.x} y={s.y} fill="#64748B" fontWeight="600" textAnchor={s.anchor ?? "start"}>{s.s}</text>;
          if (s.k === "contact") {
            const mid = s.y + 25;
            const pass = s.nc ? !val(s.addr) : val(s.addr);
            const base = COLORS[kind(s.addr)];
            const c = pass ? base : IDLE;
            return (
              <g key={i} stroke={c} strokeWidth="3">
                <line x1={s.x} y1={mid} x2={s.x + 30} y2={mid} />
                <line x1={s.x + 50} y1={mid} x2={s.x + 80} y2={mid} />
                <line x1={s.x + 30} y1={mid - 13} x2={s.x + 30} y2={mid + 13} />
                <line x1={s.x + 50} y1={mid - 13} x2={s.x + 50} y2={mid + 13} />
                {s.nc && <line x1={s.x + 27} y1={mid + 13} x2={s.x + 53} y2={mid - 13} />}
                <text x={s.x + 40} y={mid - 18} fill={base} stroke="none" fontWeight="700" textAnchor="middle">{s.addr}</text>
              </g>
            );
          }
          if (s.k === "coil") {
            const on = val(s.addr);
            const base = COLORS[kind(s.addr)];
            return (
              <g key={i}>
                {on && <circle cx={s.x} cy={s.y} r="19" fill="#FBBF24" opacity="0.35" />}
                <circle cx={s.x} cy={s.y} r="12" fill={on ? "#FBBF24" : "#FFFFFF"} stroke={base} strokeWidth="3" />
                <text x={s.x} y={s.y - 22} fill={base} fontWeight="700" textAnchor="middle">{s.addr}</text>
              </g>
            );
          }
          const t = state.timers["T" + parseInt(s.no, 10)];
          return (
            <g key={i}>
              <rect x={s.x} y={s.y} width="100" height="60" rx="6" fill="#FFFBEB" stroke={COLORS.timer} strokeWidth="3" />
              <text x={s.x + 50} y={s.y + 19} fill={COLORS.timer} fontWeight="700" textAnchor="middle">TIM {s.no}</text>
              <text x={s.x + 50} y={s.y + 35} fill="#92400E" textAnchor="middle">#{String(s.preset).padStart(4, "0")}</text>
              <text x={s.x + 50} y={s.y + 51} fill={t?.done ? "#059669" : "#92400E"} fontWeight="700" textAnchor="middle">
                {((t?.elapsedMs ?? 0) / 1000).toFixed(1)} s
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
