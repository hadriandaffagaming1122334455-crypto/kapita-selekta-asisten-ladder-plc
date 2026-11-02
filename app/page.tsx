"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseProgram } from "@/lib/parser";
import { validate } from "@/lib/validator";
import { initialState, step, type SimState } from "@/lib/simulator";
import { EXAMPLES } from "@/lib/examples";

const INPUTS = ["0.00", "0.01", "0.02", "0.03"];
const OUTPUTS = ["100.00", "100.01", "100.02", "100.03"];

export default function Home() {
  const [text, setText] = useState(EXAMPLES[0].program);
  const [inputs, setInputs] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<SimState>(initialState());
  const [running, setRunning] = useState(false);

  const { program, errors } = useMemo(() => parseProgram(text), [text]);
  const result = useMemo(() => validate(program), [program]);
  const canRun = errors.length === 0 && result.valid;

  // ref supaya interval selalu membaca input terbaru
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;

  useEffect(() => {
    if (!running || !canRun) return;
    const id = setInterval(() => {
      setState((s) => step(program, s, inputsRef.current, 100));
    }, 100);
    return () => clearInterval(id);
  }, [running, canRun, program]);

  const reset = () => { setRunning(false); setState(initialState()); };

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Ladder Tutor — Omron CP1E</h1>
        <p className="text-sm text-gray-500">
          Tulis program ladder dalam mnemonic, periksa, lalu simulasikan. Selalu uji ulang di CX-Programmer.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-semibold">1. Program (mnemonic)</h2>
          <textarea
            className="w-full h-72 rounded border p-3 font-mono text-sm"
            value={text}
            onChange={(e) => { setText(e.target.value); reset(); }}
          />
          <p className="text-xs text-gray-500">{EXAMPLES[0].description}</p>
        </div>

        <div className="space-y-2">
          <h2 className="font-semibold">2. Hasil pemeriksaan</h2>
          <div className={`rounded border p-3 text-sm ${canRun ? "border-green-500" : "border-red-500"}`}>
            <p className="font-medium">{canRun ? "VALID — siap disimulasikan" : "PERLU DIPERBAIKI"}</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              {errors.map((e, i) => <li key={"p" + i} className="text-red-600">{e}</li>)}
              {result.issues.map((i, k) => (
                <li key={k} className={i.severity === "error" ? "text-red-600" : "text-amber-600"}>
                  {i.rung ? `Rung ${i.rung}: ` : ""}{i.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">3. Simulator</h2>
        <div className="flex gap-2">
          <button className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-40"
            disabled={!canRun} onClick={() => setRunning((r) => !r)}>
            {running ? "Jeda" : "Jalankan"}
          </button>
          <button className="rounded border px-3 py-1" onClick={reset}>Reset</button>
          <span className="self-center text-xs text-gray-500">Scan ke-{state.scan} (100 ms/scan)</span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium mb-1">Input (tahan untuk menekan)</p>
            <div className="flex flex-wrap gap-2">
              {INPUTS.map((a) => (
                <button key={a}
                  className={`rounded border px-3 py-2 text-sm font-mono ${inputs[a] ? "bg-blue-600 text-white" : ""}`}
                  onPointerDown={() => setInputs((p) => ({ ...p, [a]: true }))}
                  onPointerUp={() => setInputs((p) => ({ ...p, [a]: false }))}
                  onPointerLeave={() => setInputs((p) => ({ ...p, [a]: false }))}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Output</p>
            <div className="flex flex-wrap gap-3">
              {OUTPUTS.map((a) => (
                <div key={a} className="text-center text-xs font-mono">
                  <div className={`mx-auto h-8 w-8 rounded-full border ${state.bits[a] ? "bg-yellow-400" : "bg-gray-200"}`} />
                  {a}
                </div>
              ))}
            </div>
            {Object.entries(state.timers).map(([k, t]) => (
              <p key={k} className="mt-2 text-xs font-mono">
                {k}: {(t.elapsedMs / 1000).toFixed(1)} s {t.done ? "(selesai)" : ""}
              </p>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
