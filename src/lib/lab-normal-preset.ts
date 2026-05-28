// Reusable preset for "Isi Normal" pada section Laboratorium.
// Nilai aman/default — bisa dipindahkan ke Master Parameter Juknis ke depan.
export const LAB_NORMAL_PRESET: Record<string, string | number> = {
  // Hematologi
  hb: "14",
  leukosit: "7000",
  trombosit: "250000",
  hematokrit: "42",
  eritrosit: "5",
  led: "10",
  diff_basofil: "0",
  diff_eosinofil: "2",
  diff_neutrofil: "60",
  diff_limfosit: "30",
  diff_monosit: "6",
  // Urinalisa
  urin_warna: "Kuning jernih",
  urin_kejernihan: "Jernih",
  urin_bj: "1.020",
  urin_ph: "6",
  urin_protein: "Negatif",
  urin_glukosa: "Negatif",
  urin_keton: "Negatif",
  urin_bilirubin: "Negatif",
  urin_darah: "Negatif",
  urin_nitrit: "Negatif",
  urin_leukosit: "Negatif",
  urin_sedimen: "Normal",
  // Kimia darah
  gula_darah_puasa: "90",
  gula_darah_2jpp: "120",
  hba1c: "5.4",
  kolesterol_total: "180",
  ldl: "100",
  hdl: "50",
  trigliserida: "120",
  ureum: "25",
  kreatinin: "0.9",
  asam_urat: "5.5",
  sgot: "25",
  sgpt: "25",
  // Skrining narkoba
  narkoba_amfetamin: "Negatif",
  narkoba_metamfetamin: "Negatif",
  narkoba_thc: "Negatif",
  narkoba_opiat: "Negatif",
  narkoba_kokain: "Negatif",
  narkoba_benzo: "Negatif",
  narkoba_kesimpulan: "Negatif",
  // Kesimpulan & klasifikasi
  conclusion: "Dalam batas normal",
  qualification_u: "U-1",
};

export const LAB_PRESET_KEYS = Object.keys(LAB_NORMAL_PRESET);