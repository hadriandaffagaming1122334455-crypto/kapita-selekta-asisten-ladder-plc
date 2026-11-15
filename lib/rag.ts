import type { ChatFn, Msg } from "./llm";
import type { Mode } from "./schema";
import { checkRag } from "./rag-schema";
import type { Pencari } from "./rag-index";

export const N_AWAL = 4;
export const PESAN_TIDAK_ADA = "Informasi ini tidak ditemukan di dokumen rujukan yang tersedia.";

export interface Terambil {
  no: number; // urutan hasil pencarian
  chunkId: string;
  dokumen: string;
  bagian: string;
  kemiripan: number;
  lolosAmbang: boolean;
}
export interface Rujukan {
  sumber: number;
  chunkId: string;
  dokumen: string;
  judul: string;
  bagian: string;
}
export interface RagResult {
  status: "dijawab" | "tidak_ada_di_dokumen" | "gagal";
  jawaban: string;
  rujukan: Rujukan[];
  catatan: string[];
  terambil: Terambil[]; // selalu diisi: periksa ini dulu setiap kali jawaban salah
  modelDipanggil: boolean;
  alasan?: string;
}

export interface RagOpts {
  pertanyaan: string;
  mode: Mode;
  pencari: Pencari;
  chat: ChatFn;
  systemPrompt: string;
  ambang: number; // batas kemiripan; di bawah ini chunk dianggap tidak relevan
  n?: number;
}

function extractJson(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

export async function jawabDariDokumen(o: RagOpts): Promise<RagResult> {
  const n = o.n ?? N_AWAL;
  const hasil = await o.pencari.cari(o.pertanyaan, n);
  const terambil: Terambil[] = hasil.map((h, i) => ({
    no: i + 1, chunkId: h.chunk.id, dokumen: h.chunk.dokumen, bagian: h.chunk.bagian,
    kemiripan: Math.round(h.kemiripan * 1000) / 1000, lolosAmbang: h.kemiripan >= o.ambang,
  }));
  const dipakai = hasil.filter((h) => h.kemiripan >= o.ambang);

  // Penolakan tegas SEBELUM model dipanggil: tidak ada chunk yang cukup mirip, tidak ada dasar untuk menjawab.
  if (dipakai.length === 0) {
    const tertinggi = hasil.length > 0 ? Math.max(...hasil.map((h) => h.kemiripan)) : 0;
    return {
      status: "tidak_ada_di_dokumen", jawaban: PESAN_TIDAK_ADA, rujukan: [], catatan: [], terambil, modelDipanggil: false,
      alasan: `Tidak ada potongan dokumen dengan kemiripan di atas ambang ${o.ambang} (tertinggi ${Math.round(tertinggi * 1000) / 1000}).`,
    };
  }

  // Konteks: chunk diberi nomor (cara 2 modul), dibungkus agar jelas bahwa isinya data.
  const konteks = dipakai
    .map((h, i) => `[Sumber ${i + 1}] ${h.chunk.dokumen} | ${h.chunk.judul} | bagian: ${h.chunk.bagian}\n${h.chunk.teks.replace(/<\/?sumber>/gi, "")}`)
    .join("\n\n");
  const messages: Msg[] = [
    { role: "system", content: o.systemPrompt },
    { role: "user", content: `Mode output: ${o.mode}\n\n<sumber>\n${konteks}\n</sumber>\n\nPertanyaan pengguna: ${o.pertanyaan}` },
  ];

  let galat: string[] = [];
  for (let percobaan = 0; percobaan < 2; percobaan++) {
    const msg = await o.chat(messages, []); // tanpa tool
    messages.push(msg);
    try {
      // Wajib mengutip (cara 1) dan nomor sumber dicek otomatis (cara 2): nomor yang tidak ada ditolak.
      const cek = checkRag(extractJson(msg.content ?? ""), o.mode, dipakai.length);
      if (cek.ok) {
        const rujukan: Rujukan[] = cek.value.rujukan.map((r) => {
          const c = dipakai[r.sumber - 1].chunk;
          return { sumber: r.sumber, chunkId: c.id, dokumen: c.dokumen, judul: c.judul, bagian: c.bagian };
        });
        return { status: cek.value.status, jawaban: cek.value.jawaban, rujukan, catatan: cek.value.catatan, terambil, modelDipanggil: true };
      }
      galat = cek.errors;
    } catch {
      galat = ["Jawaban bukan JSON valid."];
    }
    messages.push({ role: "user", content: `Output tidak sesuai aturan: ${galat.join(" ")} Kirim ulang sebagai satu objek JSON saja.` });
  }
  return { status: "gagal", jawaban: "", rujukan: [], catatan: [], terambil, modelDipanggil: true, alasan: `Format jawaban tidak valid setelah diperbaiki sekali: ${galat.join(" ")}` };
}
