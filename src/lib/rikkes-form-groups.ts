export const RIKKES_GROUPS = [
  { key: "identitas_anamnesis", label: "Identitas & Anamnesis (1-12)" },
  { key: "screening_hari_h", label: "Screening Hari-H (TB/BB/LP/IMT)" },
  { key: "lembar_evaluasi_umum", label: "Lembar Evaluasi: Pemeriksaan Umum" },
  { key: "evaluasi_klinis", label: "Evaluasi Klinis (13-34)" },
  { key: "gigi_odontogram", label: "Gigi & Odontogram (35)" },
  { key: "penunjang", label: "Pemeriksaan Penunjang (36-38)" },
  { key: "ukuran_lain", label: "Ukuran & Pemeriksaan Lain (39-53)" },
  { key: "mata_tht", label: "Pemeriksaan Mata (45, 51-53)" },
  { key: "tht_subtim", label: "THT (Subtim)" },
  { key: "mata_visus_subtim", label: "Mata Lihat/Visus (Subtim)" },
  { key: "bedah_subtim", label: "Bedah (Subtim)" },
  { key: "neurologi_subtim", label: "Neurologi (Subtim, opsional)" },
  { key: "laboratorium", label: "Laboratorium (55-59)" },
  { key: "psikologi_subtim", label: "Keswa (Status Psikiatri)" },
  { key: "resume_rekomendasi", label: "Resume & Rekomendasi (60-67)" },
] as const;

export const SELF_MANAGED_GROUPS = new Set<string>([
  "tht_subtim",
  "mata_visus_subtim",
  "bedah_subtim",
  "neurologi_subtim",
  "gigi_odontogram",
  "laboratorium",
  "psikologi_subtim",
]);

export type RikkesGroupKey = (typeof RIKKES_GROUPS)[number]["key"];

export const CLINICAL_ITEMS = [
  { number: 13, label: "KEPALA, MUKA, LEHER, KULIT KEPALA" },
  { number: 14, label: "HIDUNG" },
  { number: 15, label: "SINUS-SINUS" },
  { number: 16, label: "MULUT, TENGGOROKAN, TONSIL-TONSIL" },
  { number: 17, label: "TELINGA" },
  { number: 18, label: "MEMBRANA TYMPANI" },
  { number: 19, label: "MATA (KEDUDUKAN, VISUS & REFRAKSI)" },
  { number: 20, label: "OPHTHALMOSCOPY" },
  { number: 21, label: "PUPIL (BENTUK, REAKSI)" },
  { number: 22, label: "GERAKAN MATA, BIDANG PENGLIHATAN" },
  { number: 23, label: "DADA DAN PARU-PARU" },
  { number: 24, label: "JANTUNG (BESAR, FREKUENSI, IRAMA, BUNYI-BUNYI)" },
  { number: 25, label: "ABDOMEN & VISCERA (HERNIA)" },
  { number: 26, label: "ANUS-RECTUM (HAEMORRHOID) & FISTULA" },
  { number: 27, label: "SISTEM ENDOKRIN" },
  { number: 28, label: "SISTEM GENITOURINARIA" },
  { number: 29, label: "EKSTREMITAS ATAS" },
  { number: 30, label: "EKSTREMITAS BAWAH" },
  { number: 31, label: "TULANG BELAKANG" },
  { number: 32, label: "KULIT" },
  { number: 33, label: "NEUROLOGIS" },
  { number: 34, label: "PEMERIKSAAN LAINNYA" },
];

export const TEETH_TOP = [
  [18, 17, 16, 15, 14, 13, 12, 11],
  [21, 22, 23, 24, 25, 26, 27, 28],
];
export const TEETH_BOTTOM = [
  [48, 47, 46, 45, 44, 43, 42, 41],
  [31, 32, 33, 34, 35, 36, 37, 38],
];

export const TOOTH_CODES = [
  { code: "S", label: "Sehat" },
  { code: "K", label: "Karies" },
  { code: "H", label: "Hilang" },
  { code: "T", label: "Tambalan" },
  { code: "G", label: "Gangren" },
  { code: "A", label: "Sisa Akar" },
  { code: "P", label: "Protesa" },
];

export const TOOTH_COLOR: Record<string, string> = {
  S: "bg-white text-slate-700 border-slate-300",
  K: "bg-red-500 text-white border-red-600",
  H: "bg-slate-900 text-white border-slate-900",
  T: "bg-blue-500 text-white border-blue-600",
  G: "bg-orange-500 text-white border-orange-600",
  A: "bg-amber-700 text-white border-amber-800",
  P: "bg-purple-500 text-white border-purple-600",
};
