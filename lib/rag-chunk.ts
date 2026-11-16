// Memotong dokumen menjadi chunk. Keputusan utama (lihat rancangan-rag.md bagian 2):
// satu bagian logis per chunk, batas ukuran, dan tumpang tindih hanya saat satu bagian terpaksa dipecah.

export interface Dokumen {
  kode: string; // mis. "W483"
  judul: string;
  teks: string;
}
export interface Chunk {
  id: string; // mis. "W483-012"
  dokumen: string; // kode dokumen
  judul: string; // judul dokumen
  bagian: string; // judul bagian terdekat sebelum chunk ini
  halaman?: number; // nomor halaman PDF tempat chunk dimulai; hanya ada kalau teks sumber memuat pemisah halaman (\f, bawaan pdftotext)
  teks: string;
}
export interface OpsiPotong {
  maksKata: number;
  tumpangTindihKata: number;
}
export const OPSI_AWAL: OpsiPotong = { maksKata: 400, tumpangTindihKata: 50 };

// Pola judul bagian. SESUAIKAN dengan bentuk teks manualmu setelah diekstrak dari PDF.
const POLA_JUDUL: RegExp[] = [
  /^\s*SECTION\s+\d+\b.{0,80}$/i, // "SECTION 3 Instructions"
  /^\s*\d+(?:-\d+){1,3}\s+[A-Za-z][^.]{2,80}$/, // "3-4-2 Timer Instructions"
  /^\s*[A-Z][A-Z0-9 \-/&,]{5,60}$/, // JUDUL HURUF BESAR
];
export const adalahJudul = (baris: string): boolean => POLA_JUDUL.some((p) => p.test(baris.trim()) && baris.trim().length <= 90);

const PENANDA_HALAMAN = /^<<HAL:(\d+)>>$/;

const hitungKata = (s: string) => (s.trim() === "" ? 0 : s.trim().split(/\s+/).length);

export function potongDokumen(dok: Dokumen, opsi: OpsiPotong = OPSI_AWAL): Chunk[] {
  const { maksKata, tumpangTindihKata } = opsi;
  if (maksKata < 20 || tumpangTindihKata < 0 || tumpangTindihKata >= maksKata / 2) throw new Error("Opsi potong tidak masuk akal.");
  const hasil: Chunk[] = [];
  let bagian = "(tanpa judul)";
  let buf: string[] = []; // paragraf yang sedang dikumpulkan
  let bufKata = 0;
  let sisaTumpang = ""; // ekor chunk sebelumnya (hanya diisi kalau pemecahan karena ukuran)

  // Nomor halaman: pdftotext memisahkan halaman dengan karakter \f. Diubah jadi penanda sebelum teks dipecah per paragraf.
  const adaHalaman = dok.teks.includes("\f");
  let halamanSekarang = 1;
  let halamanBuf = 1; // halaman tempat paragraf pertama di buf berada

  const simpan = (teks: string, bagianChunk: string, halaman: number) => {
    const t = teks.trim();
    if (t === "") return;
    hasil.push({
      id: `${dok.kode}-${String(hasil.length + 1).padStart(3, "0")}`, dokumen: dok.kode, judul: dok.judul, bagian: bagianChunk,
      ...(adaHalaman ? { halaman } : {}), teks: t,
    });
  };
  const ekor = (teks: string) => (tumpangTindihKata === 0 ? "" : teks.trim().split(/\s+/).slice(-tumpangTindihKata).join(" "));
  const bilas = (karenaUkuran: boolean) => {
    if (buf.length === 0) return;
    const teks = buf.join("\n\n");
    simpan(teks, bagian, halamanBuf);
    sisaTumpang = karenaUkuran ? ekor(teks) : "";
    buf = [];
    bufKata = 0;
  };

  let nomorHal = 1;
  const teksKerja = dok.teks.replace(/\r\n/g, "\n").replace(/\f/g, () => `\n\n<<HAL:${++nomorHal}>>\n\n`);
  const blok = teksKerja.split(/\n\s*\n/);
  for (const b of blok) {
    const penanda = PENANDA_HALAMAN.exec(b.trim());
    if (penanda) { halamanSekarang = Number(penanda[1]); continue; }
    const baris = b.split("\n");
    const adaJudul = baris.length > 0 && adalahJudul(baris[0]);
    if (adaJudul) {
      bilas(false); // judul baru memulai chunk baru, tanpa tumpang tindih
      bagian = baris[0].trim();
    }
    const paragraf = b.trim();
    if (paragraf === "") continue;
    const kata = hitungKata(paragraf);

    if (kata > maksKata) {
      // paragraf raksasa: pecah per jendela kata dengan tumpang tindih
      bilas(false);
      const semua = paragraf.split(/\s+/);
      for (let i = 0; i < semua.length; i += maksKata - tumpangTindihKata) {
        simpan(semua.slice(i, i + maksKata).join(" "), bagian, halamanSekarang);
        if (i + maksKata >= semua.length) break;
      }
      sisaTumpang = "";
      continue;
    }
    if (bufKata + kata > maksKata) bilas(true);
    if (buf.length === 0) halamanBuf = halamanSekarang;
    if (buf.length === 0 && sisaTumpang !== "") {
      buf.push(sisaTumpang);
      bufKata += hitungKata(sisaTumpang);
      sisaTumpang = "";
    }
    buf.push(paragraf);
    bufKata += kata;
  }
  bilas(false);
  return hasil;
}
