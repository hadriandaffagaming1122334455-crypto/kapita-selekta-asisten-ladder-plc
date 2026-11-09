"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { parseProgram } from "@/lib/parser";
import { validate } from "@/lib/validator";
import { initialState, step, type SimState } from "@/lib/simulator";
import { EXAMPLES } from "@/lib/examples";
import LadderDiagram from "./LadderDiagram";

function Panel({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`border border-slate-400 bg-white ${className}`}>
      <div className="border-b border-slate-400 bg-[#dde3ea] px-2 py-1 font-semibold">{title}</div>
      <div className="p-2">{children}</div>
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
  const btn = "border border-slate-500 bg-[#f3f4f6] px-3 py-1 hover:bg-white disabled:opacity-40";

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-[#1f4e79] px-3 py-1.5 text-sm font-semibold text-white">
        Ladder Tutor - Omron CP1E - [Section1 (Diagram)]
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-400 bg-[#f3f4f6] px-3 py-2">
        <button className={`${btn} ${running ? "" : "font-semibold"}`} disabled={!canRun} onClick={() => setRunning((r) => !r)}>
          {running ? "Jeda" : "Jalankan"}
        </button>
        <button className={btn} onClick={reset}>Reset</button>
        <span className="mx-1 h-5 border-l border-slate-400" />
        <select className="border border-slate-500 bg-white px-2 py-1" value={exIdx}
          onChange={(e) => { const i = +e.target.value; setExIdx(i); setText(EXAMPLES[i].program); reset(); }}>
          {EXAMPLES.map((e, i) => <option key={i} value={i}>Contoh: {e.title}</option>)}
        </select>
        <button className={btn} onClick={() => { setText(""); reset(); }}>Kosongkan</button>
        <span className="ml-auto text-xs text-slate-600">Contoh hanya titik awal, ganti dengan rangkaianmu sendiri.</span>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="w-full shrink-0 space-y-3 border-b border-slate-400 bg-[#f9fafb] p-2 md:w-60 md:border-b-0 md:border-r">
          <Panel title="Proyek">
            <ul className="space-y-0.5 font-mono text-xs">
              <li>▾ NewProject</li>
              <li className="pl-3">▾ PLC [CP1E] {running ? "Simulasi" : "Offline"}</li>
              <li className="pl-6">▾ Programs</li>
              <li className="pl-9">▾ NewProgram1 (00)</li>
              <li className="bg-[#2563eb] pl-12 text-white">Section1</li>
              <li className="pl-12">END</li>
            </ul>
          </Panel>
          <Panel title="Input (tahan untuk menekan)">
            <div className="flex flex-wrap gap-1.5">
              {inAddrs.map((a) => (
                <button key={a}
                  className={`select-none border px-3 py-1.5 font-mono ${inputs[a] ? "border-green-800 bg-green-600 text-white" : "border-slate-500 bg-[#f3f4f6] hover:bg-white"}`}
                  onPointerDown={() => setInputs((p) => ({ ...p, [a]: true }))}
                  onPointerUp={() => setInputs((p) => ({ ...p, [a]: false }))}
                  onPointerLeave={() => setInputs((p) => ({ ...p, [a]: false }))}>{a}</button>
              ))}
              {inAddrs.length === 0 && <span className="text-slate-400">Belum ada input.</span>}
            </div>
          </Panel>
          <Panel title="Output">
            <div className="flex flex-wrap gap-3">
              {outAddrs.map((a) => (
                <div key={a} className="text-center font-mono text-xs">
                  <div className={`mx-auto mb-1 h-6 w-6 rounded-full border-2 ${state.bits[a] ? "border-green-800 bg-green-400" : "border-slate-500 bg-white"}`} />
                  {a}
                </div>
              ))}
              {outAddrs.length === 0 && <span className="text-slate-400">Belum ada output.</span>}
            </div>
          </Panel>
        </aside>

        <main className="min-w-0 flex-1 space-y-3 p-2">
          <section className="border border-slate-400 bg-white">
            <div className="bg-[#fff59d] px-2 py-1 font-mono text-xs">
              [Program Name : NewProgram1] [Section Name : Section1]
            </div>
            {program.length > 0
              ? <LadderDiagram program={program} state={state} />
              : <p className="p-8 text-center text-slate-500">Belum ada rung. Ketik program di bawah atau pilih contoh.</p>}
            <div className="border-t border-slate-300 px-2 py-1 text-xs text-slate-600">
              Hijau = sedang menghantar, hitam = terputus, garis miring = kontak NC, teks biru = nama simbol.
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Program (mnemonic)">
              <textarea className="h-56 w-full border border-slate-400 p-2 font-mono text-xs" spellCheck={false}
                value={text} onChange={(e) => { setText(e.target.value); reset(); }} />
              <p className="mt-1 text-xs text-slate-600">
                Tulis komentar di akhir baris setelah // untuk memberi nama simbol, mis. LD 0.00 // START
              </p>
            </Panel>
            <Panel title="Pemeriksaan">
              <div className={`border p-2 ${canRun ? "border-green-700 bg-green-50 text-green-900" : "border-red-700 bg-red-50 text-red-900"}`}>
                <p className="font-semibold">{canRun ? "Valid, siap disimulasikan" : "Perlu diperbaiki"}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {errors.map((e, i) => <li key={"p" + i}>{e}</li>)}
                  {result.issues.map((i, k) => (
                    <li key={k} className={i.severity === "warning" ? "text-amber-800" : ""}>
                      {i.rung ? `Rung ${i.rung - 1}: ` : ""}{i.message}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-2 text-xs text-slate-600">Selalu uji ulang di CX-Programmer sebelum dipakai di PLC sungguhan.</p>
            </Panel>
          </div>
        </main>
      </div>

      <footer className="flex flex-wrap gap-4 border-t border-slate-400 bg-[#f3f4f6] px-3 py-1 text-xs text-slate-700">
        <span>{running ? "Simulasi berjalan" : "Simulasi berhenti"}</span>
        <span>Scan ke-{state.scan} (100 ms)</span>
        <span>{canRun ? "Program valid" : "Program belum valid"}</span>
        <span className="ml-auto">CP1E</span>
      </footer>
    </div>
  );
}
