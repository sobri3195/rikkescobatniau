import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Radio, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { listActiveExamsLocal } from "@/lib/services/examService";
import { buildParticipantRowLocal } from "@/lib/services/participantRowService";
import { getDb } from "@/lib/localDb";
import { logAudit } from "@/lib/audit";
import { QuickSupportingModal } from "@/components/hari-h/QuickSupportingModal";

export const Route = createFileRoute("/_authenticated/data-belum-lengkap")({
  component: IncompletePage,
});

type IssueKey =
  | "no_test_kosong"
  | "ekg_belum"
  | "rontgen_belum"
  | "bypass_belum_review"
  | "anamnesis_belum_submit"
  | "anamnesis_perlu_klarifikasi"
  | "anamnesis_belum_direview"
  | "anamnesis_ttd_dokter_kosong";

const ISSUE_LABEL: Record<IssueKey, string> = {
  no_test_kosong: "No Test kosong",
  ekg_belum: "EKG belum lengkap",
  rontgen_belum: "Rontgen belum lengkap",
  bypass_belum_review: "Bypass belum direview",
  anamnesis_belum_submit: "Anamnesa: peserta belum submit",
  anamnesis_perlu_klarifikasi: "Anamnesa: perlu klarifikasi peserta",
  anamnesis_belum_direview: "Anamnesa: belum direview dokter",
  anamnesis_ttd_dokter_kosong: "Anamnesa: TTD dokter kosong",
};

// Issue → focus query param for Detail Pemeriksaan
const ISSUE_TO_FOCUS: Record<IssueKey, string> = {
  no_test_kosong: "no_test",
  ekg_belum: "ekg",
  rontgen_belum: "rontgen",
  bypass_belum_review: "ekg",
  anamnesis_belum_submit: "anamnesa",
  anamnesis_perlu_klarifikasi: "anamnesa",
  anamnesis_belum_direview: "anamnesa",
  anamnesis_ttd_dokter_kosong: "anamnesa",
};

type Row = {
  exam_id: string;
  candidate_id: string;
  selection_id: string | null;
  full_name: string;
  test_number: string | null;
  temporary_id: string | null;
  nrp_nip: string | null;
  rank: string | null;
  unit_position: string | null;
  hari_h_stage: string;
  ekg_initial_status: string;
  radiology_initial_status: string;
  bypass_initial_at: string | null;
  bypass_initial_reviewed_at: string | null;
  issues: IssueKey[];
};

function IncompletePage() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const canOpen = roles.length > 0; // any authenticated role can open detail
  const canEkg = ["super_admin", "admin", "dokter", "kepala_sub_tim", "registrasi"].some((r) => roles.includes(r));
  const canRontgen = ["super_admin", "admin", "dokter", "radiologi", "kepala_sub_tim", "registrasi"].some((r) => roles.includes(r));

  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [modal, setModal] = useState<{ mode: "ekg" | "radiology"; examId: string; candidateId: string } | null>(null);

  async function load() {
    const db = getDb() as any;
    const data = listActiveExamsLocal();
    const mapped: Row[] = (data ?? []).map((r: any) => {
      const candRaw = (db.candidates ?? []).find((c: any) => c.id === r.candidate_id);
      const participant = candRaw ? buildParticipantRowLocal(candRaw, db) : null;
      const cand = participant?.candidate ?? candRaw;
      const issues: IssueKey[] = [];
      const tn = (cand?.test_number ?? "").trim();
      if (!tn || tn.startsWith("TMP-")) issues.push("no_test_kosong");
      const DONE = ["Submitted", "Cleared", "Approved", "Locked"];
      if (!DONE.includes(r.ekg_initial_status)) issues.push("ekg_belum");
      if (!DONE.includes(r.radiology_initial_status)) issues.push("rontgen_belum");
      if (r.bypass_initial_at && !r.bypass_initial_reviewed_at) issues.push("bypass_belum_review");
      const mhfArr = (db.medical_history_forms ?? []).filter((item: any) => item.exam_id === r.id);
      const mhf = mhfArr[0];
      const wf = mhf?.anamnesis_workflow_status ?? "Draft Peserta";
      const patientSigned = !!(mhf?.patient_signature_url || mhf?.candidate_signature_url);
      const doctorSigned = !!(mhf?.doctor_signature_url || mhf?.doctor_signed_at);
      if (wf === "Locked") {
        // fully complete — no anamnesis issue
      } else if (!patientSigned || wf === "Draft Peserta") {
        issues.push("anamnesis_belum_submit");
      } else if (wf === "Perlu Klarifikasi") {
        issues.push("anamnesis_perlu_klarifikasi");
      } else if (wf === "Submitted Peserta" || !mhf?.doctor_review_status) {
        issues.push("anamnesis_belum_direview");
      } else if ((wf === "Clear Dokter" || wf === "Ada Catatan Dokter") && !doctorSigned) {
        issues.push("anamnesis_ttd_dokter_kosong");
      }
      return {
        exam_id: r.id,
        candidate_id: r.candidate_id,
        full_name: participant?.display_name ?? cand?.full_name ?? cand?.name ?? "-",
        test_number: participant?.test_number ?? cand?.test_number ?? null,
        temporary_id: participant?.temporary_id ?? cand?.temporary_id ?? null,
        nrp_nip: participant?.nrp_nip ?? cand?.nrp_nip ?? null,
        rank: participant?.rank ?? cand?.rank ?? null,
        unit_position: participant?.unit_position ?? cand?.unit_position ?? null,
        hari_h_stage: r.hari_h_stage ?? "Registrasi Awal",
        ekg_initial_status: r.ekg_initial_status ?? "Belum Diisi",
        radiology_initial_status: r.radiology_initial_status ?? "Belum Diisi",
        bypass_initial_at: r.bypass_initial_at,
        bypass_initial_reviewed_at: r.bypass_initial_reviewed_at,
        issues,
        selection_id: participant?.selection_id ?? cand?.selection_id ?? null,
      };
    }).filter((r) => r.issues.length > 0);
    setRows(mapped);
  }

  useEffect(() => {
    load();
    logAudit({ action: "open_incomplete_data_page", module: "Data Belum Lengkap" });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && !r.issues.includes(filter as IssueKey)) return false;
      if (s && ![r.full_name, r.test_number, r.temporary_id, r.nrp_nip, r.unit_position].some((v) => (v ?? "").toLowerCase().includes(s))) return false;
      return true;
    });
  }, [rows, q, filter]);

  function openEkg(r: Row) {
    if (!canEkg) return;
    if (!r.exam_id) { toast.error("Data exam peserta belum tersedia."); return; }
    setModal({ mode: "ekg", examId: r.exam_id, candidateId: r.candidate_id });
    logAudit({
      action: "click_incomplete_data_ekg",
      module: "Data Belum Lengkap",
      record_id: r.exam_id,
      candidate_id: r.candidate_id,
    });
  }

  function openRontgen(r: Row) {
    if (!canRontgen) return;
    if (!r.exam_id) { toast.error("Data exam peserta belum tersedia."); return; }
    setModal({ mode: "radiology", examId: r.exam_id, candidateId: r.candidate_id });
    logAudit({
      action: "click_incomplete_data_radiology",
      module: "Data Belum Lengkap",
      record_id: r.exam_id,
      candidate_id: r.candidate_id,
    });
  }

  function openDetail(r: Row) {
    if (!r.candidate_id) { toast.error("Data peserta belum tersedia."); return; }
    const firstIssue = r.issues[0];
    const focus = firstIssue ? ISSUE_TO_FOCUS[firstIssue] : undefined;
    logAudit({
      action: "open_candidate_detail_from_incomplete_data",
      module: "Data Belum Lengkap",
      record_id: r.exam_id,
      candidate_id: r.candidate_id,
      after: { focus, issues: r.issues },
    });
    navigate({
      to: "/rikkes/$id",
      params: { id: r.exam_id ?? r.candidate_id },
      search: { ...(focus ? { focus } : {}), from: "data-belum-lengkap", selectionId: r.selection_id, candidateId: r.candidate_id } as any,
    });
  }

  async function handleModalSaved() {
    await load();
    logAudit({ action: "refresh_incomplete_data_after_action", module: "Data Belum Lengkap" });
    toast.success("Data berhasil diperbarui.");
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertCircle className="h-6 w-6 text-amber-600" /> Data Belum Lengkap
        </h1>
        <p className="text-sm text-muted-foreground">Daftar peserta dengan data wajib yang masih kurang.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Masalah</SelectItem>
            {(Object.keys(ISSUE_LABEL) as IssueKey[]).map((k) => (
              <SelectItem key={k} value={k}>{ISSUE_LABEL[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground self-center">Total: <strong>{filtered.length}</strong></div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">No Test / Temp ID</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Masalah</th>
              <th className="px-3 py-2 text-right w-[280px]">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.exam_id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.full_name}</div>
                  <div className="text-[11px] text-muted-foreground">{r.rank ?? "—"} · {r.nrp_nip ?? "—"}</div>
                </td>
                <td className="px-3 py-2">
                  {r.test_number ?? <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{r.temporary_id ?? "Belum"}</Badge>}
                </td>
                <td className="px-3 py-2"><Badge variant="outline">{r.hari_h_stage}</Badge></td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.issues.map((i) => (
                      <Badge key={i} variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                        {ISSUE_LABEL[i]}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    {r.issues.includes("ekg_belum") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-blue-400 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                        disabled={!canEkg || !r.exam_id}
                        title={!canEkg ? "Anda tidak memiliki akses untuk aksi ini." : undefined}
                        onClick={() => openEkg(r)}
                      >
                        <Activity className="h-3.5 w-3.5 mr-1" /> EKG
                      </Button>
                    )}
                    {r.issues.includes("rontgen_belum") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-indigo-400 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                        disabled={!canRontgen || !r.exam_id}
                        title={!canRontgen ? "Anda tidak memiliki akses untuk aksi ini." : undefined}
                        onClick={() => openRontgen(r)}
                      >
                        <Radio className="h-3.5 w-3.5 mr-1" /> Rontgen
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-8 bg-slate-800 hover:bg-slate-900 text-white"
                      disabled={!canOpen || !r.candidate_id}
                      title={!canOpen ? "Anda tidak memiliki akses untuk aksi ini." : undefined}
                      onClick={() => openDetail(r)}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Buka
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada data yang kurang lengkap.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <QuickSupportingModal
          open={true}
          onOpenChange={(v) => !v && setModal(null)}
          mode={modal.mode}
          examId={modal.examId}
          candidateId={modal.candidateId}
          onSaved={handleModalSaved}
        />
      )}
    </div>
  );
}