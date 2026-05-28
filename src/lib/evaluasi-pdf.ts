import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/local-supabase-shim";

type Cand = {
  full_name?: string | null;
  test_number?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  unit_position?: string | null;
  address?: string | null;
  panda?: string | null;
  group_name?: string | null;
  selection_id?: string | null;
};

export async function fetchSubteam(sectionKey: string, selectionId?: string | null) {
  // Try selection-scoped first, then fallback to global (selection_id null)
  if (selectionId) {
    const { data } = await supabase
      .from("medical_subteams")
      .select("*")
      .eq("section_key", sectionKey)
      .eq("selection_id", selectionId)
      .eq("is_active", true)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase
    .from("medical_subteams")
    .select("*")
    .eq("section_key", sectionKey)
    .is("selection_id", null)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

async function fetchSelectionName(selectionId?: string | null) {
  if (!selectionId) return "";
  const { data } = await supabase.from("selections").select("name").eq("id", selectionId).maybeSingle();
  return (data as any)?.name ?? "";
}

function drawHeader(doc: jsPDF, selectionName: string, isDraft: boolean) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TENTARA NASIONAL INDONESIA", W / 2, 14, { align: "center" });
  doc.text("MARKAS BESAR TNI ANGKATAN UDARA", W / 2, 19, { align: "center" });
  doc.text("PUSAT KESEHATAN", W / 2, 24, { align: "center" });
  doc.setLineWidth(0.5);
  doc.line(14, 27, W - 14, 27);

  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text("RAHASIA KEDOKTERAN", 14, 33);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("LEMBAR EVALUASI KESEHATAN", W / 2, 38, { align: "center" });
  if (selectionName) {
    doc.setFontSize(10);
    doc.text(selectionName.toUpperCase(), W / 2, 44, { align: "center" });
  }

  if (isDraft) {
    doc.saveGraphicsState();
    (doc as any).setGState(new (jsPDF as any).GState({ opacity: 0.12 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(80);
    doc.setTextColor(220, 38, 38);
    doc.text("DRAFT", W / 2, doc.internal.pageSize.getHeight() / 2, { align: "center", angle: 30 });
    doc.setTextColor(0, 0, 0);
    doc.restoreGraphicsState();
  }
}

function drawIdentity(doc: jsPDF, cand: Cand, yStart: number) {
  const W = doc.internal.pageSize.getWidth();
  const rows: [string, string][] = [
    ["Nama", cand.full_name ?? "-"],
    ["No. Test", cand.test_number ?? "-"],
    ["Tempat/Tgl Lahir", `${cand.birth_place ?? "-"} / ${cand.birth_date ?? "-"}`],
    ["Kesatuan", cand.unit_position ?? "-"],
    ["Kelompok", cand.group_name ?? "-"],
    ["Asal Panda", cand.panda ?? "-"],
    ["Alamat", cand.address ?? "-"],
  ];
  autoTable(doc, {
    startY: yStart,
    body: rows.map(([k, v]) => [k, ":", v]),
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.2 },
    columnStyles: { 0: { cellWidth: 38, fontStyle: "bold" }, 1: { cellWidth: 4 }, 2: { cellWidth: W - 14 * 2 - 42 } },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY as number;
}

function drawFooter(doc: jsPDF, subteam: any, examinedAt: string | null) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const yStart = Math.min(H - 55, ((doc as any).lastAutoTable?.finalY ?? H - 80) + 15);
  const location = subteam?.location ?? "...........";
  const dateText = examinedAt ? new Date(examinedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "............... " + new Date().getFullYear();
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${location}, ${dateText}`, W - 14, yStart, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(subteam?.display_title ?? "KA SUB TIM", W - 14, yStart + 5, { align: "right" });
  // signature space
  doc.setFont("helvetica", "normal");
  doc.text("..........................................", W - 14, yStart + 25, { align: "right" });
  doc.setFont("helvetica", "bold");
  const name = [subteam?.doctor_name, subteam?.doctor_title].filter(Boolean).join(", ") || "....................................";
  doc.text(name, W - 14, yStart + 30, { align: "right" });
  doc.setFont("helvetica", "normal");
  const rankNrp = [subteam?.rank, subteam?.nrp ? `NRP ${subteam.nrp}` : null].filter(Boolean).join(" ");
  doc.text(rankNrp || "..............................", W - 14, yStart + 35, { align: "right" });
}

export async function generatePemeriksaanUmumPDF(args: {
  cand: Cand;
  data: any;
  examinedAt: string | null;
  isDraft: boolean;
}) {
  const { cand, data, examinedAt, isDraft } = args;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const selectionName = await fetchSelectionName(cand.selection_id);
  drawHeader(doc, selectionName, isDraft);

  const afterId = drawIdentity(doc, cand, 50);

  autoTable(doc, {
    startY: afterId + 4,
    head: [["Parameter", "Hasil"]],
    body: [
      ["Tinggi Badan", data.height_cm != null ? `${data.height_cm} cm` : "-"],
      ["Berat Badan", data.weight_kg != null ? `${data.weight_kg} kg` : "-"],
      ["Panjang Kaki", data.leg_length_cm != null ? `${data.leg_length_cm} cm` : "-"],
      ["Lingkar Dada Inspirasi", data.chest_inspiration_cm != null ? `${data.chest_inspiration_cm} cm` : "-"],
      ["Lingkar Dada Ekspirasi", data.chest_expiration_cm != null ? `${data.chest_expiration_cm} cm` : "-"],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [230, 230, 230], textColor: 20 },
    margin: { left: 14, right: 14 },
  });

  let y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Anamnesa:", 14, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const anam = doc.splitTextToSize(data.anamnesis || "-", 180);
  doc.text(anam, 14, y); y += anam.length * 4 + 3;

  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Kesimpulan:", 14, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const concl = doc.splitTextToSize(data.conclusion || "-", 180);
  doc.text(concl, 14, y); y += concl.length * 4 + 3;

  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(`Kualifikasi U : ${data.qualification_u || "-"}`, 14, y);

  const subteam = await fetchSubteam("pemeriksaan_umum", cand.selection_id);
  drawFooter(doc, subteam, examinedAt);

  const fname = `RIKKES_EVALUASI_UMUM_${(cand.full_name ?? "PESERTA").replace(/\s+/g, "_")}_${cand.test_number ?? ""}.pdf`;
  doc.save(fname);
  return fname;
}