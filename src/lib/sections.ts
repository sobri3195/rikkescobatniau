// Section definitions and medical classification logic

export type Classification = "B" | "C" | "K1" | "K2" | "TH";

export interface SectionDef {
  key: string;
  name: string;
  group: "identitas" | "umum" | "fisik" | "khusus" | "resume";
  required: boolean;
  /** include in KESUM aggregation */
  inKesum: boolean;
  /** jiwa drives KESWA */
  isJiwa?: boolean;
  /** Default role responsible for filling this section */
  assignedRole: "registrasi" | "peserta" | "dokter" | "kepala_sub_tim" | "admin";
}

export const SECTIONS: SectionDef[] = [
  { key: "identitas",         name: "Identitas",          group: "identitas", required: true,  inKesum: false, assignedRole: "registrasi" },
  { key: "anamnesa",          name: "Anamnesa",           group: "identitas", required: true,  inKesum: false, assignedRole: "peserta" },
  { key: "surat_pernyataan",  name: "Surat Pernyataan",   group: "identitas", required: true,  inKesum: false, assignedRole: "peserta" },
  { key: "pemeriksaan_umum",  name: "Pemeriksaan Umum",   group: "umum",      required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "tanda_vital",       name: "Tanda Vital",        group: "umum",      required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "penyakit_dalam",    name: "Penyakit Dalam",     group: "umum",      required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "ekg_ergo",          name: "EKG/Ergo",           group: "umum",      required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "paru",              name: "Paru FVC/FEV1",      group: "umum",      required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "neurologi",         name: "Neurologi",          group: "umum",      required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "obsgyn",            name: "Obsgyn",             group: "umum",      required: false, inKesum: true,  assignedRole: "dokter" },
  { key: "kulit",             name: "Kulit",              group: "umum",      required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "laboratorium",      name: "Laboratorium",       group: "umum",      required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "radiologi_ro",      name: "Radiologi/RO",       group: "umum",      required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "usg",               name: "USG",                group: "umum",      required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "tht",               name: "THT",                group: "umum",      required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "bedah",             name: "Bedah",              group: "umum",      required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "atas",              name: "Atas",               group: "fisik",     required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "bawah",             name: "Bawah",              group: "fisik",     required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "audio_tympano",     name: "Audio dan Tympano",  group: "khusus",    required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "mata",              name: "Mata",               group: "khusus",    required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "gigi",              name: "Gigi/Odontogram",    group: "khusus",    required: true,  inKesum: true,  assignedRole: "dokter" },
  { key: "jiwa_keswa",        name: "Jiwa/Keswa",         group: "khusus",    required: true,  inKesum: false, isJiwa: true, assignedRole: "dokter" },
  { key: "resume_kesimpulan", name: "Resume/Kesimpulan",  group: "resume",    required: true,  inKesum: false, assignedRole: "kepala_sub_tim" },
  { key: "rekap_paraf",       name: "Rekap Paraf",        group: "resume",    required: true,  inKesum: false, assignedRole: "admin" },
  { key: "kualifikasi_akhir", name: "Kualifikasi Akhir",  group: "resume",    required: true,  inKesum: false, assignedRole: "kepala_sub_tim" },
];

export const ROLE_LABELS: Record<SectionDef["assignedRole"], string> = {
  registrasi: "Petugas Registrasi",
  peserta: "Peserta",
  dokter: "Dokter / Subtim",
  kepala_sub_tim: "Kepala Sub Tim",
  admin: "Admin / Panitia",
};

export function classifyBmi(bmi: number | null | undefined): Classification | null {
  if (bmi == null || isNaN(bmi)) return null;
  if (bmi < 14.9) return "K2";
  if (bmi < 18.4) return "K1";
  if (bmi < 19.9) return "C";
  if (bmi < 24.9) return "B";
  if (bmi < 26.9) return "C";
  if (bmi < 29.9) return "K1";
  return "K2";
}

export function computeBmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg) return null;
  const m = heightCm / 100;
  if (m <= 0) return null;
  return +(weightKg / (m * m)).toFixed(2);
}

/** Aggregate worst classification across in-KESUM sections */
export function computeKesum(classes: Array<Classification | null | undefined>): {
  kesum: Classification | "Belum Lengkap";
  counts: { B: number; C: number; K1: number; K2: number };
} {
  const counts = { B: 0, C: 0, K1: 0, K2: 0 };
  let hasAny = false;
  for (const c of classes) {
    if (!c || c === "TH") continue;
    hasAny = true;
    if (c in counts) counts[c as keyof typeof counts]++;
  }
  if (!hasAny) return { kesum: "Belum Lengkap", counts };
  if (counts.K2 > 0) return { kesum: "K2", counts };
  if (counts.K1 > 0) return { kesum: "K1", counts };
  if (counts.C > 0) return { kesum: "C", counts };
  return { kesum: "B", counts };
}

export function computeKeswa(jiwa: Classification | null | undefined): "MS" | "TMS" | "TH" | "Belum Lengkap" {
  if (!jiwa) return "Belum Lengkap";
  if (jiwa === "TH") return "TH";
  if (jiwa === "K2") return "TMS";
  return "MS";
}

export function computeFinalResult(
  kesum: Classification | "Belum Lengkap",
  keswa: ReturnType<typeof computeKeswa>,
): "MS" | "TMS" | "TH" | "Belum Lengkap" {
  if (kesum === "Belum Lengkap" || keswa === "Belum Lengkap") return "Belum Lengkap";
  if (kesum === "K2" || keswa === "TMS") return "TMS";
  if (keswa === "TH") return "TH";
  return "MS";
}

export function computeFinalScore(
  kesum: Classification | "Belum Lengkap",
  counts: { B: number; C: number; K1: number; K2: number },
): number | null {
  if (kesum === "Belum Lengkap") return null;
  let base = 85;
  let penalty = 0;
  if (kesum === "B") base = 85;
  if (kesum === "C") {
    base = 75;
    penalty = counts.C * 1 + counts.B * 0.2;
  }
  if (kesum === "K1") {
    base = 65;
    penalty = counts.K1 * 2 + counts.C * 1 + counts.B * 0.2;
  }
  if (kesum === "K2") {
    base = 55;
    penalty = counts.K2 * 3 + counts.K1 * 2 + counts.C * 1 + counts.B * 0.2;
  }
  const score = Math.max(0, Math.round((base - penalty) * 10) / 10);
  return score;
}

export const STATUS_BADGES = {
  Draft: "bg-muted text-muted-foreground",
  Submitted: "bg-blue-100 text-blue-800",
  Revision: "bg-amber-100 text-amber-900",
  Approved: "bg-emerald-100 text-emerald-800",
  Locked: "bg-slate-800 text-white",
  "In Progress": "bg-amber-100 text-amber-900",
  "Pending Review": "bg-blue-100 text-blue-800",
  "Revision Needed": "bg-orange-100 text-orange-900",
  Finalized: "bg-emerald-700 text-white",
  MS: "bg-emerald-600 text-white",
  TMS: "bg-rose-600 text-white",
  TH: "bg-slate-500 text-white",
  B: "bg-emerald-500 text-white",
  C: "bg-yellow-500 text-white",
  K1: "bg-orange-500 text-white",
  K2: "bg-rose-600 text-white",
  "Belum Lengkap": "bg-muted text-muted-foreground",
} as const;