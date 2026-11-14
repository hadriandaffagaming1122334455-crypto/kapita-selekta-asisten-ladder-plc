import { TOOLS } from "./tools";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
export interface Msg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
export type ChatFn = (messages: Msg[], tools?: unknown[]) => Promise<Msg>;

// Klien model gateway berformat OpenAI-compatible (/chat/completions dengan tools).
// Isi .env.local: GATEWAY_BASE_URL, GATEWAY_API_KEY, GATEWAY_MODEL. Kunci tidak pernah masuk kode.
export function gatewayChat(): ChatFn {
  const base = process.env.GATEWAY_BASE_URL;
  const key = process.env.GATEWAY_API_KEY;
  const model = process.env.GATEWAY_MODEL;
  if (!base || !key || !model) throw new Error("Gateway belum dikonfigurasi.");

  return async (messages, tools = TOOLS) => {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, tools, temperature: 0, max_tokens: 1200 }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Gateway membalas ${res.status}.`);
    const data = (await res.json()) as { choices?: { message?: Msg }[] };
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("Balasan gateway tidak punya message.");
    return msg;
  };
}
