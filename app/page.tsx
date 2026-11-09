"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { parseProgram } from "@/lib/parser";
import { validate } from "@/lib/validator";
import { initialState, step, type SimState } from "@/lib/simulator";
import { EXAMPLES } from "@/lib/examples";
import LadderDiagram, { LEGEND } from "./LadderDiagram";

function Card({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200" style={{ borderTop: `5px solid ${color}` }}>
      <h2 className="mb-3 text-lg font-bold" style={{ color }}>{title}</h2>
      {children}
    </section>
  );
}

export default function Home() {
  const [exIdx, setExIdx] = useState(0);
  const [text, setText] = useState(EXAMPLES[0].program);
  const [inputs, setInputs] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<SimState>(initialState());
  const [running, setRunning] = useState(false);

  const { program, errors } = useMemo(() => parseProgram(text), [text]);
  const result = useMemo(() => validate(program), [program]);
  const canRun = errors.length === 0 && result.valid;

  // Tombol input dan lampu output mengikuti alamat yang dipakai program
  const { inAddrs, outAddrs } = useMemo(() => {
    const ins = new Set<string>(), outs = new Set<string>();
    for (const r of program)
      for (const i of r.instructions) {
        if (/^[01]\.\d{2}$/.test(i.arg) && i.op !== "OUT") ins.add(i.arg);
        if (i.op === "OUT" && /^10[01]\.\d{2}$/.test(i.arg)) outs.add(i.arg);
      }
    return { inAddrs: [...ins].sort(), outAddrs: [...outs].sort() };
  }, [program]);

  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;

  useEffect(() => {
    if (!running || !canRun) return;
    const id = setInterval(() => setState((s) => step(program, s, inputsRef.current, 100)), 100);
    return () => clearInterval(id);
  }, [running, canRun, program]);

  const reset = () => { setRunning(false); setState(initialState()); };
  const field = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-800";

  return (
    <div>
      <header className="bg-gradient-to-r from-[#1D4ED8] via-[#4F46E5] to-[#7C3AED] text-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Ladder Tutor</h1>
          <p className="mt-1 text-blue-100">
            Tulis program ladder PLC Omron CP1E, lihat diagramnya, lalu jalankan simulasinya.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Program" color="#2563EB">
            <select className={field} value={exIdx}
              onChange={(e) => { const i = +e.target.value; setExIdx(i); setText(EXAMPLES[i].program); reset(); }}>
              {EXAMPLES.map((e, i) => <option key={i} value={i}>Contoh: {e.title}</option>)}
            </select>
            <textarea className={`${field} mt-2 h-60 font-mono`} spellCheck={false}
              value={text} onChange={(e) => { setText(e.target.value); reset(); }} />
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="text-xs text-slate-500">
                Contoh hanya titik awal. Ganti isi kotak dengan rangkaianmu sendiri.
              </p>
              <button className="shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => { setText(""); reset(); }}>Kosongkan</button>
            </div>
          </Card>

          <Card title="Pemeriksaan" color={canRun ? "#059669" : "#DC2626"}>
            <div className={`rounded-lg p-3 text-sm ${canRun ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
              <p className="font-semibold">{canRun ? "Valid, siap disimulasikan" : "Perlu diperbaiki"}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errors.map((e, i) => <li key={"p" + i}>{e}</li>)}
                {result.issues.map((i, k) => (
                  <li key={k} className={i.severity === "warning" ? "text-amber-700" : ""}>
                    {i.rung ? `Rung ${i.rung - 1}: ` : ""}{i.message}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Selalu uji ulang di CX-Programmer sebelum dipakai di PLC sungguhan.
            </p>
          </Card>
        </div>

        <Card title="Diagram ladder" color="#7C3AED">
          {program.length > 0
            ? <LadderDiagram program={program} state={state} />
            : <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">Belum ada rung. Ketik program atau pilih contoh.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            {LEGEND.map(([n, c]) => (
              <span key={n} className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />{n}
              </span>
            ))}
            <span>Berwarna = menghantar, abu-abu = terputus, garis miring = NC</span>
          </div>
        </Card>

        <Card title="Simulator" color="#D97706">
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={!canRun} onClick={() => setRunning((r) => !r)}
              className={`rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-40 ${running ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700"}`}>
              {running ? "Jeda" : "Jalankan"}
            </button>
            <button className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50" onClick={reset}>Reset</button>
            <span className="text-xs text-slate-500">Scan ke-{state.scan} (100 ms per scan)</span>
          </div>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-blue-700">Input (tahan untuk menekan)</p>
              <div className="flex flex-wrap gap-2">
                {inAddrs.map((a) => (
                  <button key={a}
                    className={`rounded-lg border px-4 py-2 font-mono text-sm font-semibold select-none ${inputs[a] ? "border-blue-700 bg-blue-600 text-white" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
                    onPointerDown={() => setInputs((p) => ({ ...p, [a]: true }))}
                    onPointerUp={() => setInputs((p) => ({ ...p, [a]: false }))}
                    onPointerLeave={() => setInputs((p) => ({ ...p, [a]: false }))}>{a}</button>
                ))}
                {inAddrs.length === 0 && <span className="text-sm text-slate-400">Belum ada input.</span>}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-emerald-700">Output</p>
              <div className="flex flex-wrap gap-4">
                {outAddrs.map((a) => (
                  <div key={a} className="text-center font-mono text-xs text-slate-600">
                    <div className={`mx-auto mb-1 h-9 w-9 rounded-full border-2 ${state.bits[a] ? "border-amber-500 bg-amber-300 shadow-[0_0_16px_#fbbf24]" : "border-slate-300 bg-slate-100"}`} />
                    {a}
                  </div>
                ))}
                {outAddrs.length === 0 && <span className="text-sm text-slate-400">Belum ada output.</span>}
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
