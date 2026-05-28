import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { localDataApi } from "@/lib/localDataApi";
import { logAudit } from "@/lib/audit";

type Row = {
  full_name: string;
  rank: string | null;
  nrp_nip: string | null;
  unit_position: string | null;
  temporary_id: string | null;
  test_number: string | null;
  test_number_status: string | null;
  selection_name: string | null;
  created_at: string;
};

async function loadRows(opts?: { selectionId?: string }): Promise<Row[]> {
  let q = localDataApi
    .from("candidates")
    .select("full_name, rank, nrp_nip, unit_position, temporary_id, test_number, test_number_status, created_at, selections(name)")
    .or("test_number.is.null,test_number.like.TMP-%")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (opts?.selectionId) q = q.eq("selection_id", opts.selectionId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    full_name: r.full_name,
    rank: r.rank,
    nrp_nip: r.nrp_nip,
    unit_position: r.unit_position,
    temporary_id: r.temporary_id,
    test_number: r.test_number,
    test_number_status: r.test_number_status,
    selection_name: r.selections?.name ?? null,
    created_at: r.created_at,
  }));
}

export async function exportLaporanXlsx(opts?: { selectionId?: string }) {
  const rows = await loadRows(opts);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Peserta Tanpa No Test");
  ws.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Nama Lengkap", key: "name", width: 28 },
    { header: "Pangkat", key: "rank", width: 14 },
    { header: "NRP/NIP", key: "nrp", width: 16 },
    { header: "Satuan/Jabatan", key: "unit", width: 30 },
    { header: "Seleksi", key: "sel", width: 22 },
    { header: "TMP ID", key: "tmp", width: 22 },
    { header: "Status No Test", key: "stat", width: 16 },
    { header: "Tgl Daftar", key: "tgl", width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAB308" } };
  rows.forEach((r, i) => {
    ws.addRow({
      no: i + 1,
      name: r.full_name,
      rank: r.rank ?? "",
      nrp: r.nrp_nip ?? "",
      unit: r.unit_position ?? "",
      sel: r.selection_name ?? "",
      tmp: r.temporary_id ?? "",
      stat: r.test_number_status ?? "Belum Ada",
      tgl: r.created_at?.slice(0, 10) ?? "",
    });
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `Laporan-Peserta-Tanpa-NoTest-${stamp}.xlsx`);
  await logAudit({ action: "export_laporan_no_test", module: "peserta_no_test", after: { format: "xlsx", count: rows.length } });
  return rows.length;
}

export async function exportLaporanPdf(opts?: { selectionId?: string }) {
  const rows = await loadRows(opts);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const stamp = new Date().toLocaleString("id-ID");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("LAPORAN PESERTA TANPA NO TEST", 14, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Dicetak: ${stamp} · Total: ${rows.length} peserta`, 14, 20);

  autoTable(doc, {
    startY: 25,
    head: [["No", "Nama", "Pangkat", "NRP/NIP", "Satuan", "Seleksi", "TMP ID", "Status", "Tgl"]],
    body: rows.map((r, i) => [
      String(i + 1),
      r.full_name,
      r.rank ?? "—",
      r.nrp_nip ?? "—",
      r.unit_position ?? "—",
      r.selection_name ?? "—",
      r.temporary_id ?? "—",
      r.test_number_status ?? "Belum Ada",
      r.created_at?.slice(0, 10) ?? "",
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [234, 179, 8], textColor: 20, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [254, 252, 232] },
    columnStyles: { 0: { cellWidth: 10 }, 6: { cellWidth: 28 }, 7: { cellWidth: 20 } },
  });

  // Watermark DRAFT di setiap halaman — semua baris di laporan ini per-definisi belum punya No Test final
  const pageCount = (doc as any).internal.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.saveGraphicsState?.();
    const gs = (doc as any).GState ? new (doc as any).GState({ opacity: 0.13 }) : null;
    if (gs) (doc as any).setGState(gs);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 0, 0);
    doc.setFontSize(54);
    doc.text("DRAFT - NO TEST BELUM ADA", w / 2, h / 2, { align: "center", angle: 25 });
    doc.setTextColor(0, 0, 0);
    doc.restoreGraphicsState?.();
  }

  const fname = `Laporan-Peserta-Tanpa-NoTest-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
  await logAudit({ action: "export_laporan_no_test", module: "peserta_no_test", after: { format: "pdf", count: rows.length } });
  return rows.length;
}