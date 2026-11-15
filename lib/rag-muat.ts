import { readFile } from "node:fs/promises";
import path from "node:path";
import { KAMUS_ID_EN, gatewayEmbedder, muatIndeks, pencariLeksikal, pencariVektor, type Pencari } from "./rag-index";

// Nilai awal ambang. PLACEHOLDER: tentukan angka sebenarnya dari hasil `npx tsx scripts/uji-rag.ts`
// (lihat bagian "cara menentukan threshold" di rancangan-rag.md), lalu tulis di data/indeks/konfigurasi.json.
// Pada uji dengan dokumen fiktif, 0,6 menolak pertanyaan yang jawabannya ada (pertanyaan Indonesia atas dokumen Inggris
// menurunkan kemiripan kata kunci). Nilai ini hanya titik awal: kalibrasi dengan manual aslimu.
export const AMBANG_LEKSIKAL_AWAL = 0.3;
export const AMBANG_VEKTOR_AWAL = 0.35;

export interface Siap {
  pencari: Pencari;
  ambang: number;
  jumlahChunk: number;
}

export async function siapkanPencari(dataDir: string = path.join(process.cwd(), "data")): Promise<Siap | null> {
  const dir = path.join(dataDir, "indeks");
  const idx = await muatIndeks(dir);
  if (!idx || idx.chunks.length === 0) return null;
  let konf: { ambangLeksikal?: number; ambangVektor?: number } = {};
  try { konf = JSON.parse(await readFile(path.join(dir, "konfigurasi.json"), "utf8")); } catch { /* pakai nilai awal */ }
  const embed = gatewayEmbedder();
  if (idx.vektor && embed) {
    return { pencari: pencariVektor(idx.chunks, idx.vektor, embed), ambang: Number(process.env.RAG_AMBANG ?? konf.ambangVektor ?? AMBANG_VEKTOR_AWAL), jumlahChunk: idx.chunks.length };
  }
  return { pencari: pencariLeksikal(idx.chunks, KAMUS_ID_EN), ambang: Number(process.env.RAG_AMBANG ?? konf.ambangLeksikal ?? AMBANG_LEKSIKAL_AWAL), jumlahChunk: idx.chunks.length };
}
