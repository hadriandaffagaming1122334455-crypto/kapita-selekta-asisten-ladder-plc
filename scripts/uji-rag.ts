// Menjalankan set pertanyaan uji dan mencetak tabel BUILD Minggu 9. Pemakaian:
//   npx tsx scripts/uji-rag.ts [berkas-uji.json] [--jawab]
// Tanpa --jawab: hanya pencarian (gratis, tanpa kunci). Dengan --jawab: juga memanggil model lewat gateway.
// Format berkas uji (default docs/uji-rag.json):
//   [{ "no": 1, "pertanyaan": "...", "jenis": "ada" | "tersebar" | "tidak_ada", "kunci": [{ "dokumen": "W483", "teks": "potongan teks yang HARUS ada di chunk" }] }]
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gatewayChat } from "../lib/llm";
import { jawabDariDokumen } from "../lib/rag";
import { siapkanPencari } from "../lib/rag-muat";

interface Kunci { dokumen?: string; teks: string }
interface Uji { no: number; pertanyaan: string; jenis: "ada" | "tersebar" | "tidak_ada"; kunci?: Kunci[] }

(async () => {
  const berkas = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? path.join(process.cwd(), "docs", "uji-rag.json");
  const uji = JSON.parse(await readFile(berkas, "utf8")) as Uji[];
  const siap = await siapkanPencari(process.env.RAG_DATA_DIR);
  if (!siap) { console.error("Indeks belum ada. Jalankan dulu: npx tsx scripts/bangun-indeks.ts"); process.exit(1); }
  const jawab = process.argv.includes("--jawab");
  const chat = jawab ? gatewayChat() : null;
  const sistem = jawab ? await readFile(path.join(process.cwd(), "prompts", "rag-v1.md"), "utf8") : "";

  console.log(`Pencari: ${siap.pencari.jenis} | ambang: ${siap.ambang} | ${siap.jumlahChunk} chunk\n`);
  console.log("| # | Pertanyaan | Jenis | Chunk benar terambil? | Kemiripan tertinggi | Chunk terambil (id : kemiripan) |" + (jawab ? " Status sistem | Jawaban benar? |" : ""));
  console.log("|---|---|---|---|---|---|" + (jawab ? "---|---|" : ""));

  const adaTop: number[] = [], tidakTop: number[] = [];
  let adaTerambil = 0, adaTotal = 0, tolakBenar = 0, tolakTotal = 0, kunciKosong = 0;
  for (const u of uji) {
    const hasil = await siap.pencari.cari(u.pertanyaan, 4);
    const top = hasil.length > 0 ? Math.max(...hasil.map((h) => h.kemiripan)) : 0;
    let terambil = "-";
    if (u.jenis === "tidak_ada") { tidakTop.push(top); tolakTotal++; }
    else {
      adaTop.push(top); adaTotal++;
      if (!u.kunci || u.kunci.length === 0) { terambil = "[kunci belum diisi]"; kunciKosong++; }
      else {
        const semua = u.kunci.every((k) => hasil.some((h) => (!k.dokumen || h.chunk.dokumen === k.dokumen) && h.chunk.teks.toLowerCase().includes(k.teks.toLowerCase())));
        terambil = semua ? "ya" : "TIDAK";
        if (semua) adaTerambil++;
      }
    }
    let tambah = "";
    if (jawab && chat) {
      const r = await jawabDariDokumen({ pertanyaan: u.pertanyaan, mode: "penuh", pencari: siap.pencari, chat, systemPrompt: sistem, ambang: siap.ambang });
      if (u.jenis === "tidak_ada" && r.status === "tidak_ada_di_dokumen") tolakBenar++;
      tambah = ` ${r.status}${r.rujukan.length ? " (" + r.rujukan.map((x) => `${x.dokumen}:${x.bagian}`).join("; ") + ")" : ""} | [nilai manual] |`;
    } else if (u.jenis === "tidak_ada" && top < siap.ambang) tolakBenar++;
    const daftar = hasil.map((h) => `${h.chunk.id}:${h.kemiripan.toFixed(2)}`).join(", ");
    console.log(`| ${u.no} | ${u.pertanyaan} | ${u.jenis} | ${terambil} | ${top.toFixed(3)} | ${daftar} |${tambah}`);
  }

  console.log(`\nChunk benar terambil (ada dan tersebar): ${adaTerambil} dari ${adaTotal}${kunciKosong ? ` (${kunciKosong} belum punya kunci)` : ""}`);
  console.log(`Ditolak dengan benar (tidak ada)${jawab ? "" : " menurut ambang"}: ${tolakBenar} dari ${tolakTotal}`);
  console.log('Angka "ada dan dijawab benar" butuh penilaianmu sendiri atas jawabannya (jalankan dengan --jawab).');
  if (adaTop.length > 0 && tidakTop.length > 0) {
    const minAda = Math.min(...adaTop), maxTidak = Math.max(...tidakTop);
    console.log(`\nAnalisis ambang: kemiripan terendah pertanyaan "ada" = ${minAda.toFixed(3)}, tertinggi pertanyaan "tidak ada" = ${maxTidak.toFixed(3)}.`);
    console.log(minAda > maxTidak
      ? `Keduanya terpisah. Ambang yang masuk akal ada di antara keduanya, mis. ${((minAda + maxTidak) / 2).toFixed(3)} (tulis di data/indeks/konfigurasi.json).`
      : "Keduanya TUMPANG TINDIH: tidak ada ambang tunggal yang sempurna. Catat ini sebagai temuan dan tentukan mana yang lebih kamu hindari (menolak yang ada jawabannya, atau menjawab yang tidak ada).");
  }
})();
