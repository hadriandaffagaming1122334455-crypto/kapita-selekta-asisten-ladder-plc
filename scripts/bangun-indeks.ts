// Membangun indeks dari dokumen teks. Pemakaian:
//   npx tsx scripts/bangun-indeks.ts [--maks 400] [--tumpang 50] [--vektor]
// Masukan : data/dokumen/daftar.json  -> [{ "berkas": "w483.txt", "kode": "W483", "judul": "..." }, ...]
//           data/dokumen/<berkas>     -> teks dokumen (hasil ekstrak dari PDF, .txt atau .md)
// Keluaran: data/indeks/chunks.json (+ vektor.json jika --vektor dan GATEWAY_EMBED_MODEL terisi)
import { readFile } from "node:fs/promises";
import path from "node:path";
import { OPSI_AWAL, potongDokumen, type Chunk } from "../lib/rag-chunk";
import { buatVektor, gatewayEmbedder, simpanIndeks } from "../lib/rag-index";

const arg = (nama: string, awal: number) => { const i = process.argv.indexOf(nama); return i >= 0 ? Number(process.argv[i + 1]) : awal; };

(async () => {
  const dataDir = process.env.RAG_DATA_DIR ?? path.join(process.cwd(), "data");
  const opsi = { maksKata: arg("--maks", OPSI_AWAL.maksKata), tumpangTindihKata: arg("--tumpang", OPSI_AWAL.tumpangTindihKata) };
  let daftar: { berkas: string; kode: string; judul: string }[];
  try { daftar = JSON.parse(await readFile(path.join(dataDir, "dokumen", "daftar.json"), "utf8")); }
  catch { console.error(`Tidak menemukan ${path.join(dataDir, "dokumen", "daftar.json")}. Lihat petunjuk di bagian atas skrip ini.`); process.exit(1); }

  const semua: Chunk[] = [];
  for (const d of daftar) {
    const teks = await readFile(path.join(dataDir, "dokumen", d.berkas), "utf8");
    const chunks = potongDokumen({ kode: d.kode, judul: d.judul, teks }, opsi);
    const kata = chunks.reduce((a, c) => a + c.teks.split(/\s+/).length, 0);
    const bagian = new Set(chunks.map((c) => c.bagian)).size;
    console.log(`${d.kode}: ${chunks.length} chunk, rata-rata ${Math.round(kata / Math.max(1, chunks.length))} kata, ${bagian} judul bagian terdeteksi`);
    if (chunks.length > 0 && bagian <= 1) console.log(`  PERINGATAN: ${d.kode} hampir tanpa judul bagian. Sesuaikan POLA_JUDUL di lib/rag-chunk.ts dengan bentuk teksmu.`);
    semua.push(...chunks);
  }

  let vektor: number[][] | undefined;
  if (process.argv.includes("--vektor")) {
    const embed = gatewayEmbedder();
    if (!embed) { console.error("--vektor butuh GATEWAY_BASE_URL, GATEWAY_API_KEY, dan GATEWAY_EMBED_MODEL di environment."); process.exit(1); }
    console.log(`Membuat vektor untuk ${semua.length} chunk (memanggil gateway, ada biayanya)...`);
    vektor = await buatVektor(semua, embed);
  }
  await simpanIndeks(path.join(dataDir, "indeks"), semua, vektor);
  console.log(`Selesai: ${semua.length} chunk disimpan${vektor ? " beserta vektor" : " (tanpa vektor, pencarian kata kunci)"}.`);
})();
