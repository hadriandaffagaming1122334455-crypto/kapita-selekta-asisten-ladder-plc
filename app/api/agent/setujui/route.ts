import path from "node:path";
import { putuskan } from "@/lib/agent";
import { fileStore } from "@/lib/agent-store";

const store = fileStore(path.join(process.cwd(), "data", "tugas"));

// Keputusan manusia atas usulan penyimpanan. Body: { id, keputusan: "setuju" | "tolak" }
export async function POST(req: Request) {
  let body: { id?: unknown; keputusan?: unknown };
  try { body = await req.json(); } catch { return Response.json({ galat: "Body bukan JSON." }, { status: 400 }); }
  if (typeof body.id !== "string") return Response.json({ galat: "id wajib string." }, { status: 400 });
  if (body.keputusan !== "setuju" && body.keputusan !== "tolak") return Response.json({ galat: 'keputusan harus "setuju" atau "tolak".' }, { status: 400 });
  const r = await putuskan(store, body.id, body.keputusan);
  return Response.json(r.state ?? { galat: r.galat }, { status: r.status });
}
