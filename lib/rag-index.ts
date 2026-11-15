import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Chunk } from "./rag-chunk";

export interface Hasil {
  chunk: Chunk;
  skor: number; // dipakai untuk mengurutkan (BM25 atau cosine)
  kemiripan: number; // 0..1, dipakai untuk ambang penolakan
}
export interface Pencari {
  jenis: "leksikal" | "vektor";
  cari(pertanyaan: string, n: number): Promise<Hasil[]>;
}

// ---------------------------------------------------------------------------
// Tokenisasi dan kamus istilah
// ---------------------------------------------------------------------------

const STOP = new Set(
  ("yang dan di ke dari untuk pada dengan apa apakah berapa bagaimana adalah itu ini saya bisa dapat kapan mengapa atau dalam akan ada " +
    "the an of to in is are for and or on with be by as it this that at from can may when what how").split(" ")
);

export function tokenisasi(s: string): string[] {
  const norm = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return (norm.match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 2 && !STOP.has(t));
}

// Kamus Indonesia -> Inggris untuk perluasan kueri. Manual Omron berbahasa Inggris, pertanyaan berbahasa Indonesia,
// jadi pencarian kata kunci murni gagal tanpa jembatan ini. EDIT sesuai kosakata pertanyaanmu.
export const KAMUS_ID_EN: Record<string, string[]> = {
  penghitung: ["counter", "count", "cnt"], hitung: ["count"], hitungan: ["count"],
  timer: ["timer", "tim"], waktu: ["time"], detik: ["second", "seconds"],
  rentang: ["range"], alamat: ["address"], memori: ["memory"], area: ["area"],
  masukan: ["input"], keluaran: ["output"], kerja: ["work"],
  instruksi: ["instruction", "instructions"], fungsi: ["function"], perintah: ["instruction"],
  nilai: ["value"], satuan: ["unit"], nomor: ["number"], jumlah: ["number", "points"], titik: ["points"],
  kontak: ["contact"], tertutup: ["closed", "not"], blok: ["block"], seri: ["series", "and"], paralel: ["parallel", "or"],
  gabung: ["combine", "load"], menggabungkan: ["combine", "load"], tahan: ["hold", "holding"], kunci: ["latch", "holding"],
  dorong: ["push"], lampu: ["indicator", "lamp"], tombol: ["button", "input"], sensor: ["sensor", "input"],
  tegangan: ["voltage"], daya: ["power"], model: ["model"], tipe: ["type", "model"], harga: ["price"],
};

/** Mengubah pertanyaan jadi kelompok istilah: tiap kelompok = istilah asli + padanan dari kamus. */
export function kelompokKueri(q: string, kamus?: Record<string, string[]>): string[][] {
  const hasil: string[][] = [];
  const terlihat = new Set<string>();
  for (const t of tokenisasi(q)) {
    if (terlihat.has(t)) continue;
    terlihat.add(t);
    const alt = [t, ...(kamus?.[t] ?? []).flatMap(tokenisasi)];
    hasil.push([...new Set(alt)]);
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Pencarian kata kunci (BM25)
// ---------------------------------------------------------------------------

const K1 = 1.5;
const B = 0.75;

export function pencariLeksikal(chunks: Chunk[], kamus?: Record<string, string[]>): Pencari {
  const tf = chunks.map((c) => {
    const m = new Map<string, number>();
    for (const t of tokenisasi(`${c.bagian} ${c.teks}`)) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  });
  const panjang = tf.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
  const rata = panjang.reduce((a, b) => a + b, 0) / Math.max(1, panjang.length);
  const df = new Map<string, number>();
  for (const m of tf) for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const N = chunks.length;
  const idf = (t: string) => Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));

  return {
    jenis: "leksikal",
    async cari(pertanyaan, n) {
      const grup = kelompokKueri(pertanyaan, kamus);
      const bobotTotal = grup.reduce((a, g) => a + Math.max(...g.map(idf)), 0);
      const hasil: Hasil[] = [];
      chunks.forEach((chunk, d) => {
        let skor = 0;
        let cocok = 0;
        for (const g of grup) {
          let terbaik = 0;
          let ada = false;
          for (const alt of g) {
            const f = tf[d].get(alt) ?? 0;
            if (f === 0) continue;
            ada = true;
            terbaik = Math.max(terbaik, (idf(alt) * f * (K1 + 1)) / (f + K1 * (1 - B + (B * panjang[d]) / rata)));
          }
          skor += terbaik;
          if (ada) cocok += Math.max(...g.map(idf));
        }
        if (skor > 0) hasil.push({ chunk, skor, kemiripan: bobotTotal > 0 ? cocok / bobotTotal : 0 });
      });
      return hasil.sort((a, b) => b.skor - a.skor).slice(0, n);
    },
  };
}

// ---------------------------------------------------------------------------
// Pencarian embedding (cosine)
// ---------------------------------------------------------------------------

export type Embedder = (teks: string[]) => Promise<number[][]>;

export function cosine(a: number[], b: number[]): number {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa === 0 || bb === 0 ? 0 : ab / Math.sqrt(aa * bb);
}

export async function buatVektor(chunks: Chunk[], embed: Embedder, batch = 32): Promise<number[][]> {
  const hasil: number[][] = [];
  for (let i = 0; i < chunks.length; i += batch) {
    const v = await embed(chunks.slice(i, i + batch).map((c) => `${c.bagian}\n${c.teks}`));
    if (v.length !== Math.min(batch, chunks.length - i)) throw new Error("Jumlah vektor tidak sama dengan jumlah teks.");
    hasil.push(...v);
  }
  return hasil;
}

export function pencariVektor(chunks: Chunk[], vektor: number[][], embed: Embedder): Pencari {
  if (chunks.length !== vektor.length) throw new Error("Jumlah chunk dan vektor tidak sama. Bangun ulang indeks.");
  return {
    jenis: "vektor",
    async cari(pertanyaan, n) {
      const [q] = await embed([pertanyaan]);
      return chunks
        .map((chunk, i) => { const c = cosine(q, vektor[i]); return { chunk, skor: c, kemiripan: Math.max(0, c) }; })
        .sort((a, b) => b.skor - a.skor)
        .slice(0, n);
    },
  };
}

// Embedder lewat gateway berformat OpenAI-compatible (/embeddings). Butuh GATEWAY_EMBED_MODEL.
// Belum tentu gateway dosen menyediakan endpoint ini: kalau tidak, pakai pencarian kata kunci.
export function gatewayEmbedder(): Embedder | null {
  const base = process.env.GATEWAY_BASE_URL, key = process.env.GATEWAY_API_KEY, model = process.env.GATEWAY_EMBED_MODEL;
  if (!base || !key || !model) return null;
  return async (teks) => {
    const res = await fetch(`${base.replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, input: teks }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Gateway embeddings membalas ${res.status}.`);
    const data = (await res.json()) as { data?: { index: number; embedding: number[] }[] };
    if (!data.data) throw new Error("Balasan embeddings tidak punya data.");
    return [...data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  };
}

// ---------------------------------------------------------------------------
// Simpan dan muat indeks (data/indeks/)
// ---------------------------------------------------------------------------

export async function simpanIndeks(dir: string, chunks: Chunk[], vektor?: number[][]): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "chunks.json"), JSON.stringify(chunks), "utf8");
  if (vektor) await writeFile(path.join(dir, "vektor.json"), JSON.stringify(vektor), "utf8");
}

export async function muatIndeks(dir: string): Promise<{ chunks: Chunk[]; vektor?: number[][] } | null> {
  let chunks: Chunk[];
  try { chunks = JSON.parse(await readFile(path.join(dir, "chunks.json"), "utf8")) as Chunk[]; } catch { return null; }
  let vektor: number[][] | undefined;
  try { vektor = JSON.parse(await readFile(path.join(dir, "vektor.json"), "utf8")) as number[][]; } catch { /* tanpa vektor */ }
  return { chunks, vektor };
}
