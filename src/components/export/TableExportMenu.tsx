import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clipboard, Download, FileSpreadsheet, FileText, FileType2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportColumn<T> = {
  key: string;
  label: string;
  accessor?: (row: T) => unknown;
};

type Props<T> = {
  data: T[];
  columns: ExportColumn<T>[];
  filename?: string;
  title?: string;
  size?: "sm" | "default";
  align?: "start" | "end";
};

function getValue<T>(row: T, col: ExportColumn<T>): string {
  const raw = col.accessor ? col.accessor(row) : (row as any)?.[col.key];
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

function toMatrix<T>(data: T[], columns: ExportColumn<T>[]): string[][] {
  const head = columns.map((c) => c.label);
  const body = data.map((row) => columns.map((c) => getValue(row, c)));
  return [head, ...body];
}

export function TableExportMenu<T>({
  data,
  columns,
  filename = "data",
  title,
  size = "sm",
  align = "end",
}: Props<T>) {
  const safeName = filename.replace(/[^a-z0-9_\-]+/gi, "_");
  const docTitle = title ?? filename;

  function doCopy() {
    try {
      const rows = toMatrix(data, columns);
      const tsv = rows.map((r) => r.map((c) => c.replace(/\t/g, " ").replace(/\n/g, " ")).join("\t")).join("\n");
      navigator.clipboard.writeText(tsv);
      toast.success(`Disalin ${data.length} baris ke clipboard`);
    } catch (e: any) {
      toast.error("Gagal copy: " + (e?.message ?? "unknown"));
    }
  }

  function doCSV() {
    try {
      const rows = toMatrix(data, columns);
      const csv = rows
        .map((r) =>
          r
            .map((c) => {
              const v = c.replace(/"/g, '""');
              return /[",\n]/.test(v) ? `"${v}"` : v;
            })
            .join(","),
        )
        .join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      triggerDownload(blob, `${safeName}.csv`);
      toast.success("Export CSV berhasil");
    } catch (e: any) {
      toast.error("Export CSV gagal: " + (e?.message ?? "unknown"));
    }
  }

  function doXLSX() {
    try {
      const rows = toMatrix(data, columns);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `${safeName}.xlsx`);
      toast.success("Export XLSX berhasil");
    } catch (e: any) {
      toast.error("Export XLSX gagal: " + (e?.message ?? "unknown"));
    }
  }

  function doPDF() {
    try {
      const rows = toMatrix(data, columns);
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      doc.setFontSize(12);
      doc.text(docTitle, 40, 32);
      doc.setFontSize(9);
      doc.text(new Date().toLocaleString("id-ID"), 40, 46);
      autoTable(doc, {
        head: [rows[0]],
        body: rows.slice(1),
        startY: 60,
        styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        margin: { left: 40, right: 40 },
      });
      doc.save(`${safeName}.pdf`);
      toast.success("Export PDF berhasil");
    } catch (e: any) {
      toast.error("Export PDF gagal: " + (e?.message ?? "unknown"));
    }
  }

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const disabled = !data || data.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        <DropdownMenuLabel>{data.length} baris</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={doCopy}>
          <Clipboard className="h-4 w-4 mr-2" /> Copy clipboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={doCSV}>
          <FileText className="h-4 w-4 mr-2" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={doXLSX}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (XLSX)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={doPDF}>
          <FileType2 className="h-4 w-4 mr-2" /> PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}