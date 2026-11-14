import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseProgram } from "./parser";
import { validate, isInput } from "./validator";
import { initialState, step, type SimState } from "./simulator";
import { NAMA_BERKAS_RE } from "./guard";
import { TOOLS, runTool } from "./tools";
import type { UsulanSimpan } from "./agent-store";

// ---------------------------------------------------------------------------
// BATAS AKSES TOOL (lapis 3: dipasang di kode, bukan di prompt)
//
// periksa_program      : fungsi murni. Hanya membaca teks program dari model. Tidak menyentuh berkas atau jaringan.
// simulasikan_program  : fungsi murni. Maks 600 scan (60 detik simulasi), 50 kejadian, 10 pengamatan, 12 alamat.
//                        Kejadian hanya boleh mengubah ALAMAT INPUT; keluaran dan bit kerja tidak bisa dipaksa.
// simpan_draf          : satu-satunya tool dengan efek keluar. TIDAK dijalankan oleh agent. Hanya membuat usulan
//                        yang menunggu persetujuan manusia. Nama berkas ditentukan permintaan pengguna, bukan model;
//                        hanya menulis ke satu folder, hanya berkas .txt, maks 4000 karakter.
// ---------------------------------------------------------------------------

export const MAX_SCAN = 600;
export const MAX_EVENT = 50;
export const MAX_SNAP = 10;
export const MAX_PANTAU = 12;
export const MAX_ISI = 4000;

const SIMULASI_TOOL = {
  type: "function" as const,
  function: {
    name: "simulasikan_program",
    description:
      "Menjalankan program ladder yang VALID pada skenario masukan dan melaporkan nilai alamat yang dipantau pada scan tertentu. " +
      "1 scan = 100 ms. Kejadian hanya boleh mengubah alamat input; nilai input bertahan sampai diubah lagi. " +
      "Pakai untuk memeriksa bahwa perilaku program sesuai deskripsi pengguna.",
    parameters: {
      type: "object",
      properties: {
        program: { type: "string", description: "Teks program mnemonic." },
        skenario: {
          type: "array",
          description: "Daftar kejadian masukan, mis. [{\"scan\":0,\"set\":{\"0.00\":true}},{\"scan\":2,\"set\":{\"0.00\":false}}].",
          items: {
            type: "object",
            properties: { scan: { type: "integer" }, set: { type: "object", additionalProperties: { type: "boolean" } } },
            required: ["scan", "set"],
          },
        },
        periksa_pada: { type: "array", items: { type: "integer" }, description: `Nomor scan yang diamati (maks ${MAX_SNAP}, 0 sampai ${MAX_SCAN - 1}).` },
        alamat_pantau: { type: "array", items: { type: "string" }, description: `Alamat yang dilaporkan (maks ${MAX_PANTAU}), mis. "100.00", "T0000", "C0000".` },
      },
      required: ["program", "skenario", "periksa_pada", "alamat_pantau"],
      additionalProperties: false,
    },
  },
};

export const SIMPAN_TOOL = {
  type: "function" as const,
  function: {
    name: "simpan_draf",
    description:
      "Mengusulkan penyimpanan program akhir ke berkas. TIDAK langsung menyimpan: manusia harus menyetujui dulu. " +
      "Panggil sekali, hanya setelah program lolos periksa_program dan sudah disimulasikan. Nama berkas ditentukan sistem.",
    parameters: {
      type: "object",
      properties: { program: { type: "string", description: "Program akhir yang diusulkan untuk disimpan." } },
      required: ["program"],
      additionalProperties: false,
    },
  },
};

// Daftar tool dasar. simpan_draf hanya ditambahkan jika pengguna memintanya (hak akses sekecil mungkin).
export const AGENT_TOOLS = [TOOLS[0], SIMULASI_TOOL];

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);
const ADDR_PANTAU_RE = /^[A-Za-z0-9.]{1,8}$/;

export function simulasikan(args: unknown): Record<string, unknown> {
  if (typeof args !== "object" || args === null) return { galat: "Argumen harus objek." };
  const a = args as Record<string, unknown>;
  if (typeof a.program !== "string" || a.program.length > MAX_ISI) return { galat: `"program" wajib string maksimal ${MAX_ISI} karakter.` };
  if (!Array.isArray(a.skenario) || a.skenario.length > MAX_EVENT) return { galat: `"skenario" wajib daftar maksimal ${MAX_EVENT} kejadian.` };
  if (!Array.isArray(a.periksa_pada) || a.periksa_pada.length < 1 || a.periksa_pada.length > MAX_SNAP) return { galat: `"periksa_pada" wajib berisi 1 sampai ${MAX_SNAP} nomor scan.` };
  if (!Array.isArray(a.alamat_pantau) || a.alamat_pantau.length < 1 || a.alamat_pantau.length > MAX_PANTAU) return { galat: `"alamat_pantau" wajib berisi 1 sampai ${MAX_PANTAU} alamat.` };

  const events = new Map<number, Record<string, boolean>>();
  for (const e of a.skenario) {
    const ev = e as { scan?: unknown; set?: unknown };
    if (!isNum(ev.scan) || ev.scan < 0 || ev.scan >= MAX_SCAN) return { galat: `Nomor scan kejadian harus bilangan bulat 0 sampai ${MAX_SCAN - 1}.` };
    if (typeof ev.set !== "object" || ev.set === null) return { galat: 'Kejadian butuh "set" berupa objek.' };
    const cur = events.get(ev.scan) ?? {};
    for (const [addr, val] of Object.entries(ev.set as Record<string, unknown>)) {
      if (!isInput(addr)) return { galat: `Alamat "${addr}" bukan alamat input; simulasi hanya boleh mengubah input.` };
      if (typeof val !== "boolean") return { galat: `Nilai untuk "${addr}" harus true atau false.` };
      cur[addr] = val;
    }
    events.set(ev.scan, cur);
  }
  const snaps = new Set<number>();
  for (const n of a.periksa_pada) {
    if (!isNum(n) || n < 0 || n >= MAX_SCAN) return { galat: `"periksa_pada" harus bilangan bulat 0 sampai ${MAX_SCAN - 1}.` };
    snaps.add(n);
  }
  const pantau = a.alamat_pantau as unknown[];
  if (!pantau.every((x) => typeof x === "string" && ADDR_PANTAU_RE.test(x))) return { galat: "Alamat pantau tidak valid." };

  const { program, errors } = parseProgram(a.program);
  const v = validate(program);
  if (errors.length > 0 || !v.valid) return { galat: "Program belum valid, tidak disimulasikan. Perbaiki lewat periksa_program dulu.", galat_sintaks: errors };

  const last = Math.max(...snaps);
  let s: SimState = initialState();
  const hasil: { scan: number; nilai: Record<string, boolean> }[] = [];
  for (let scan = 0; scan <= last; scan++) {
    s = step(program, s, events.get(scan) ?? {}, 100);
    if (snaps.has(scan)) {
      const nilai: Record<string, boolean> = {};
      for (const addr of pantau as string[]) {
        nilai[addr] = /^T\d+$/.test(addr)
          ? s.timers["T" + parseInt(addr.slice(1), 10)]?.done ?? false
          : /^C\d+$/.test(addr)
            ? s.counters["C" + parseInt(addr.slice(1), 10)]?.done ?? false
            : s.bits[addr] ?? false;
      }
      hasil.push({ scan, nilai });
    }
  }
  return { hasil, catatan: "1 scan = 100 ms. Nilai input bertahan sampai diubah lagi." };
}

// Pelaksana tool yang boleh dipanggil agent. Selalu mengembalikan string JSON.
export function jalankanAgentTool(name: string, argsJson: string): string {
  if (name === "periksa_program") return runTool(name, argsJson);
  if (name === "simulasikan_program") {
    let args: unknown;
    try { args = JSON.parse(argsJson); } catch { return JSON.stringify({ galat: "Argumen bukan JSON valid." }); }
    return JSON.stringify(simulasikan(args));
  }
  return JSON.stringify({ galat: `Tool tidak tersedia: ${name}` });
}

// --- penyimpanan berkas (hanya dipakai SETELAH persetujuan manusia) ---

export const DRAF_DIR = path.join(process.cwd(), "data", "draf");

function jalurBerkas(dir: string, nama: string): string {
  if (!NAMA_BERKAS_RE.test(nama)) throw new Error("Nama berkas tidak valid.");
  const base = path.resolve(dir);
  const file = path.resolve(base, `${nama}.txt`);
  if (!file.startsWith(base + path.sep)) throw new Error("Jalur berkas di luar folder yang diizinkan.");
  return file;
}

export async function buatUsulan(dir: string, nama: string, isi: string, periksaValid: boolean): Promise<UsulanSimpan> {
  if (isi.length > MAX_ISI) throw new Error(`Isi lebih dari ${MAX_ISI} karakter.`);
  const file = jalurBerkas(dir, nama);
  let menimpa = false;
  try { await readFile(file); menimpa = true; } catch { /* berkas belum ada */ }
  return { nama, berkas: `data/draf/${nama}.txt`, isi, menimpa, ukuranByte: Buffer.byteLength(isi, "utf8"), periksaValid };
}

export async function simpanKeBerkas(dir: string, nama: string, isi: string): Promise<string> {
  if (isi.length > MAX_ISI) throw new Error(`Isi lebih dari ${MAX_ISI} karakter.`);
  const file = jalurBerkas(dir, nama);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, isi, "utf8");
  return file;
}
