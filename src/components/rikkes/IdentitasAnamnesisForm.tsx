import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { useServerFn } from "@/shims/tanstack-react-start";
import {
  patientSaveDraft as patientSaveDraftFn,
  patientSubmitAnamnesis as patientSubmitAnamnesisFn,
  doctorSetClear as doctorSetClearFn,
  doctorAddNote as doctorAddNoteFn,
  doctorRequestClarification as doctorRequestClarificationFn,
  doctorSubmitReview as doctorSubmitReviewFn,
  adminReturnToDraft as adminReturnToDraftFn,
} from "@/lib/anamnesis.functions";
import { ANAMNESIS_STATUS_LABELS } from "@/lib/permissions/anamnesis-workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Save, Send, Undo2, FileDown, Loader2, Lock, CheckCircle2, MessageSquareWarning, Stethoscope, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =========================================================
 * Constants — sesuai blangko Anamnesa RIKKES TNI AU
 * =======================================================*/

const FAMILY_CONDITIONS = [
  "Bengek / Asma",
  "Batuk Darah",
  "Sakit Sendi",
  "Keluhan Ginjal",
  "Keluhan Jantung",
  "Keluhan Lambung",
  "Penyakit Kencing Manis",
  "Penyakit Kulit / Kelamin",
  "Penyakit Jiwa",
  "Ayan",
  "Bunuh Diri",
  "Keterangan-Keterangan Lain",
];

const PERSONAL_HISTORY_ITEMS = [
  "Pusing-pusing",
  "Mudah muntah",
  "Penyakit gegar otak",
  "Sakit kepala terus menerus",
  "Sering sakit kepala sebelah",
  "Berat badan turun/naik",
  "Mabuk udara, laut, darat",
  "Cedera kepala",
  "Luka-luka sebab kecelakaan",
  "Kecelakaan berat",
  "Kehilangan jari/tangan",
  "Patah tulang",
  "Sakit sendi-sendi",
  "Berak-berak ingus/darah",
  "Sakit panas lebih dari 7 hari",
  "Buang air tak lancar",
  "Kembung sakit perut",
  "Luka di lambung",
  "Radang usus besar/buntu",
  "Sakit di usus besar",
  "Sakit batu empedu",
  "Bengek / asma",
  "Batuk lama / batuk darah",
  "Sesak / sakit napas",
  "Muntah / batuk darah",
  "Keringat malam",
  "Sering sakit hidung/tenggorokan",
  "Keluar nanah dari telinga",
  "Sakit gigi/mulut",
  "Kencing batu/darah",
  "Sering sakit pinggang",
  "Kencing waktu tidur",
  "Sakit saat kencing",
  "Sakit kelamin/kulit",
  "Sakit bentol-bentol / bisul-bisul",
  "Sakit kuning",
  "Malaria",
  "Gondok",
  "Lumpuh",
  "Bengkak-bengkak di kaki",
  "Ayan / kejang",
  "Sukar bicara / gagap",
  "Mengigau / mimpi menakutkan",
  "Sering merasa sedih",
  "Pelupa",
  "Mengisap rokok lebih dari 20 batang sehari",
  "Suka minuman keras",
  "Sering kaku di otot-otot kaki",
  "Operasi",
  "Alergi obat / suntik / makanan",
  "Pakai kacamata",
  "Pakai mata buatan / contact lens",
  "Pakai alat pendengaran",
  "Percobaan bunuh diri",
  "Tidur sambil jalan",
  "Tinggal dengan orang berdarah terus karena luka",
];

const FOLLOWUP_QUESTIONS: { number: string; question: string }[] = [
  { number: "13a", question: "Apabila saudara pernah tak dapat bekerja karena: Tak tahan terhadap bahan kimia, debu, sinar, lain-lain?" },
  { number: "13b", question: "Tak dapat melaksanakan gerak tertentu?" },
  { number: "13c", question: "Alasan kesehatan lain?" },
  { number: "14", question: "Apakah saudara pernah bekerja dengan bahan radioaktif?" },
  { number: "15", question: "Apakah saudara pernah mendapat kesukaran di sekolah?" },
  { number: "16", question: "Pernahkah lamaran saudara ditolak karena kesehatan?" },
  { number: "17", question: "Apakah saudara masuk asuransi jiwa?" },
  { number: "18", question: "Apakah saudara pernah dioperasi atau dianjurkan untuk operasi?" },
  { number: "19", question: "Pernahkah saudara menderita penyakit/luka-luka lainnya?" },
  { number: "20", question: "Pernahkah saudara mengobati diri sendiri?" },
  { number: "21", question: "Apakah saudara pernah dirawat di Rumah Sakit Jiwa/Sanatorium?" },
  { number: "22", question: "Apakah saudara pernah/sedang menjalani terapi mata (Ortho-K, operasi mata, dll)?" },
  { number: "23", question: "Apakah saudara pernah/sedang menjalani terapi penyakit jantung?" },
  { number: "24", question: "Apakah saudara pernah/sedang menjalani terapi penyakit kronis (sakit gula, ginjal, paru-paru, dll)?" },
];

/* =========================================================
 * Types
 * =======================================================*/

export type AnamnesisRow = {
  id: string;
  candidate_id: string;
  exam_id: string;
  identity_data_json: any;
  family_history_json: any[];
  personal_history_json: any[];
  female_health_json: any;
  work_history_json: any;
  followup_questions_json: any[];
  other_disease_notes: string | null;
  honesty_statement_accepted: boolean;
  candidate_signature_url: string | null;
  candidate_signed_at: string | null;
  doctor_signature_url: string | null;
  doctor_examiner_name: string | null;
  doctor_signed_at: string | null;
  doctor_resume: string | null;
  doctor_notes_json: any;
  status: string;
  submitted_at: string | null;
  return_reason: string | null;
  anamnesis_workflow_status?: string | null;
  patient_submitted_at?: string | null;
  patient_signature_url?: string | null;
  doctor_review_status?: string | null;
  doctor_review_note?: string | null;
  clarification_note?: string | null;
  clarification_requested_at?: string | null;
  doctor_reviewed_at?: string | null;
};

function buildDefaults(cand: any): Partial<AnamnesisRow> {
  return {
    identity_data_json: {
      full_name: cand?.full_name ?? "",
      birth_place: cand?.birth_place ?? "",
      birth_date: cand?.birth_date ?? "",
      selection_label: "",
      panda: cand?.panda ?? "",
      exam_purpose: "",
      test_number: cand?.test_number ?? "",
      rank: cand?.rank ?? "",
      nrp_nip: cand?.nrp_nip ?? "",
      unit_position: cand?.unit_position ?? "",
      group_name: cand?.pok_korp ?? "",
      gender: cand?.gender ?? "L",
      address: cand?.address ?? "",
      phone: cand?.phone ?? "",
    },
    family_history_json: FAMILY_CONDITIONS.map((c) => ({
      condition: c,
      has_history: false,
      who: "",
      cause_of_death: "",
      age_at_death: "",
      notes: "",
    })),
    personal_history_json: PERSONAL_HISTORY_ITEMS.map((label, i) => ({
      item_number: i + 1,
      label,
      answer: "Tidak",
      notes: "",
    })),
    female_health_json: {
      pregnant: false,
      vaginal_discharge: false,
      painful_menstruation: false,
      irregular_menstruation: false,
      visited_gynecologist: false,
      menarche_age: "",
      cycle_interval: "",
      menstruation_duration: "",
      last_period_date: "",
      notes: "",
    },
    work_history_json: {
      other_disease_notes: "",
      job_count_last_3_years: "",
      longest_job_duration_months: "",
      current_job: "",
      dominant_hand: "Kanan",
    },
    followup_questions_json: FOLLOWUP_QUESTIONS.map((q) => ({
      number: q.number,
      question: q.question,
      answer: "Tidak",
      notes: "",
    })),
    other_disease_notes: "",
    honesty_statement_accepted: false,
    candidate_signature_url: null,
    candidate_signed_at: null,
    doctor_signature_url: null,
    doctor_examiner_name: "",
    doctor_signed_at: null,
    doctor_resume: "",
    doctor_notes_json: { examiner_name: "", examiner_rank_nrp: "", doctor_resume: "", doctor_note_date: "" },
    status: "Draft",
  };
}

/* =========================================================
 * SignaturePad — minimal canvas
 * =======================================================*/
function SignaturePad({ value, onChange, disabled }: { value?: string | null; onChange: (dataUrl: string | null) => void; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cv.width, cv.height);
      img.src = value;
    }
  }, [value]);

  function pos(e: React.PointerEvent) {
    const cv = ref.current!;
    const rect = cv.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * cv.width) / rect.width, y: ((e.clientY - rect.top) * cv.height) / rect.height };
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        width={500}
        height={140}
        className={`w-full max-w-md border border-dashed rounded bg-white ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-crosshair"}`}
        onPointerDown={(e) => {
          if (disabled) return;
          drawing.current = true;
          const ctx = ref.current!.getContext("2d")!;
          const p = pos(e);
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#0f172a";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current || disabled) return;
          const ctx = ref.current!.getContext("2d")!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={() => {
          if (drawing.current && dirty.current) {
            onChange(ref.current!.toDataURL("image/png"));
          }
          drawing.current = false;
        }}
      />
      {!disabled && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" type="button" onClick={() => {
            const ctx = ref.current!.getContext("2d")!;
            ctx.clearRect(0, 0, ref.current!.width, ref.current!.height);
            dirty.current = false;
            onChange(null);
          }}>Bersihkan</Button>
        </div>
      )}
    </div>
  );
}

/* =========================================================
 * Main form
 * =======================================================*/

const STATUS_STYLE: Record<string, string> = {
  Draft: "bg-amber-100 text-amber-800 border-amber-200",
  Submitted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Revision: "bg-orange-100 text-orange-700 border-orange-200",
  Locked: "bg-slate-100 text-slate-700 border-slate-200",
};

const WORKFLOW_STYLE: Record<string, string> = {
  "Draft Peserta": "bg-amber-100 text-amber-800 border-amber-200",
  "Submitted Peserta": "bg-blue-100 text-blue-800 border-blue-200",
  "Perlu Klarifikasi": "bg-orange-100 text-orange-800 border-orange-200",
  "Clear Dokter": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Ada Catatan Dokter": "bg-teal-100 text-teal-700 border-teal-200",
  "Locked": "bg-slate-100 text-slate-700 border-slate-200",
};

export function IdentitasAnamnesisForm({
  cand,
  exam,
  onSyncSection,
  selectionLabel,
}: {
  cand: any;
  exam: any;
  onSyncSection?: (status: string, submittedAt: string | null) => Promise<void>;
  selectionLabel?: string;
}) {
  const { roles } = useAuth();
  const callPatientSaveDraft = useServerFn(patientSaveDraftFn);
  const callPatientSubmit = useServerFn(patientSubmitAnamnesisFn);
  const callDoctorSetClear = useServerFn(doctorSetClearFn);
  const callDoctorAddNote = useServerFn(doctorAddNoteFn);
  const callDoctorRequestClar = useServerFn(doctorRequestClarificationFn);
  const callDoctorSubmitReview = useServerFn(doctorSubmitReviewFn);
  const callAdminReturnToDraft = useServerFn(adminReturnToDraftFn);
  const isDoctor = roles?.some((r: string) => ["dokter_umum", "dokter", "kepala_sub_tim", "admin", "super_admin"].includes(r));
  const isAdmin = roles?.some((r: string) => ["admin", "super_admin"].includes(r));
  const isRegistrasi = roles?.some((r: string) => ["registrasi", "admin", "super_admin"].includes(r));
  const isPatient = roles?.some((r: string) => ["peserta", "casis"].includes(r));
  const isStaff = isDoctor || isRegistrasi || isAdmin;

  const [row, setRow] = useState<AnamnesisRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [openSections, setOpenSections] = useState<string[]>(["sec1"]);

  const load = useCallback(async () => {
    if (!exam?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("medical_history_forms")
      .select("*")
      .eq("exam_id", exam.id)
      .maybeSingle();
    if (data) {
      setRow(data as AnamnesisRow);
    } else {
      const defaults = buildDefaults(cand);
      defaults.identity_data_json = {
        ...(defaults.identity_data_json as object),
        selection_label: selectionLabel ?? "",
      };
      setRow({
        id: "",
        candidate_id: cand.id,
        exam_id: exam.id,
        ...defaults,
      } as AnamnesisRow);
    }
    setLoading(false);
  }, [exam?.id, cand, selectionLabel]);

  useEffect(() => {
    load();
    logAudit({ action: "open_anamnesis_form", module: "Identitas & Anamnesis", candidate_id: cand?.id, record_id: exam?.id }).catch(() => {});
  }, [load, cand?.id, exam?.id]);

  const status = row?.status ?? "Draft";
  const locked = status === "Locked";
  const submitted = status === "Submitted" || status === "Approved";
  const isFemale = (row?.identity_data_json?.gender ?? "L") === "P";
  const workflow = row?.anamnesis_workflow_status ?? (submitted ? "Submitted Peserta" : "Draft Peserta");
  const workflowLocked = workflow === "Locked" || workflow === "Clear Dokter";
  // Peserta can edit only when Draft Peserta or Perlu Klarifikasi
  const patientCanEdit = isPatient && (workflow === "Draft Peserta" || workflow === "Perlu Klarifikasi");
  // Admin/registrasi can always edit identitas (admin)
  const canEditCandidateData = !locked && (patientCanEdit || ((!submitted || isAdmin) && isStaff && !workflowLocked) || (isAdmin && !locked));
  const canEditDoctorData = !locked && isDoctor && workflow !== "Locked";
  const canDoctorReview = isDoctor && (workflow === "Submitted Peserta" || workflow === "Perlu Klarifikasi" || workflow === "Ada Catatan Dokter");

  const personalYesCount = useMemo(
    () => (row?.personal_history_json ?? []).filter((x) => x.answer === "Ya").length,
    [row?.personal_history_json],
  );
  const familyYesCount = useMemo(
    () => (row?.family_history_json ?? []).filter((x) => x.has_history).length,
    [row?.family_history_json],
  );
  const followupYesCount = useMemo(
    () => (row?.followup_questions_json ?? []).filter((x) => x.answer === "Ya").length,
    [row?.followup_questions_json],
  );

  function patch<K extends keyof AnamnesisRow>(key: K, value: AnamnesisRow[K]) {
    setRow((r) => (r ? { ...r, [key]: value } : r));
  }

  function patchIdentity(p: any) {
    setRow((r) => (r ? { ...r, identity_data_json: { ...(r.identity_data_json ?? {}), ...p } } : r));
  }
  function patchFemale(p: any) {
    setRow((r) => (r ? { ...r, female_health_json: { ...(r.female_health_json ?? {}), ...p } } : r));
  }
  function patchWork(p: any) {
    setRow((r) => (r ? { ...r, work_history_json: { ...(r.work_history_json ?? {}), ...p } } : r));
  }

  function updateFamily(idx: number, p: any) {
    setRow((r) => {
      if (!r) return r;
      const next = [...r.family_history_json];
      next[idx] = { ...next[idx], ...p };
      return { ...r, family_history_json: next };
    });
  }
  function updatePersonal(idx: number, p: any) {
    setRow((r) => {
      if (!r) return r;
      const next = [...r.personal_history_json];
      next[idx] = { ...next[idx], ...p };
      return { ...r, personal_history_json: next };
    });
  }
  function updateFollowup(idx: number, p: any) {
    setRow((r) => {
      if (!r) return r;
      const next = [...r.followup_questions_json];
      next[idx] = { ...next[idx], ...p };
      return { ...r, followup_questions_json: next };
    });
  }

  function validate(forSubmit: boolean): string[] {
    if (!row) return ["Form belum termuat"];
    const errs: string[] = [];
    const id = row.identity_data_json ?? {};
    if (!id.full_name) errs.push("Nama lengkap wajib");
    if (!id.birth_place) errs.push("Tempat lahir wajib");
    if (!id.birth_date) errs.push("Tanggal lahir wajib");
    if (!id.selection_label) errs.push("Seleksi wajib");
    if (!id.panda) errs.push("Asal Panda wajib");
    if (!id.exam_purpose) errs.push("Maksud pemeriksaan wajib");
    if (!id.test_number) errs.push("Nomor test wajib");
    if (!forSubmit) return errs;

    // Submit-only validations
    for (const fh of row.family_history_json ?? []) {
      if (fh.has_history && !fh.who?.trim() && fh.condition !== "Keterangan-Keterangan Lain") {
        errs.push(`Riwayat keluarga "${fh.condition}": kolom "Siapa" wajib`);
      }
    }
    for (const ph of row.personal_history_json ?? []) {
      if (ph.answer === "Ya" && !ph.notes?.trim()) {
        errs.push(`Riwayat pribadi #${ph.item_number} "${ph.label}": keterangan wajib`);
      }
    }
    for (const fq of row.followup_questions_json ?? []) {
      if (fq.answer === "Ya" && !fq.notes?.trim()) {
        errs.push(`Pertanyaan ${fq.number}: keterangan wajib`);
      }
    }
    if (isFemale) {
      const fh = row.female_health_json ?? {};
      if (fh.visited_gynecologist && !fh.notes?.trim()) {
        errs.push("Bagian wanita: keterangan kunjungan ahli kandungan wajib");
      }
    }
    if (!row.honesty_statement_accepted) errs.push("Centang pernyataan kejujuran wajib");
    if (!row.candidate_signature_url) errs.push("Tanda tangan calon siswa wajib");
    return errs;
  }

  async function persist(extra: Partial<AnamnesisRow>, newStatus: string) {
    if (!row) return null;
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      candidate_id: row.candidate_id,
      exam_id: row.exam_id,
      identity_data_json: row.identity_data_json,
      family_history_json: row.family_history_json,
      personal_history_json: row.personal_history_json,
      female_health_json: row.female_health_json,
      work_history_json: row.work_history_json,
      followup_questions_json: row.followup_questions_json,
      other_disease_notes: row.other_disease_notes,
      honesty_statement_accepted: row.honesty_statement_accepted,
      candidate_signature_url: row.candidate_signature_url,
      candidate_signed_at: row.candidate_signed_at,
      doctor_signature_url: row.doctor_signature_url,
      doctor_examiner_name: row.doctor_examiner_name,
      doctor_signed_at: row.doctor_signed_at,
      doctor_resume: row.doctor_resume,
      doctor_notes_json: row.doctor_notes_json,
      status: newStatus,
      updated_by: u.user?.id,
      ...extra,
    };
    if (row.id) {
      const { data, error } = await supabase
        .from("medical_history_forms")
        .update(payload)
        .eq("id", row.id)
        .select()
        .single();
      if (error) throw error;
      return data as AnamnesisRow;
    }
    payload.created_by = u.user?.id;
    const { data, error } = await supabase
      .from("medical_history_forms")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as AnamnesisRow;
  }

  async function saveDraft() {
    const errs = validate(false);
    if (errs.length) {
      toast.error(errs[0]);
      return;
    }
    setSaving(true);
    try {
      if (isPatient && !isStaff) {
        await callPatientSaveDraft({
          data: {
            examId: exam.id,
            candidateId: cand.id,
            data: {
              identity_data_json: row?.identity_data_json,
              family_history_json: row?.family_history_json,
              personal_history_json: row?.personal_history_json,
              female_health_json: row?.female_health_json,
              work_history_json: row?.work_history_json,
              followup_questions_json: row?.followup_questions_json,
              other_disease_notes: row?.other_disease_notes ?? undefined,
            },
          },
        });
        await load();
        toast.success("Draft anamnesa tersimpan");
        return;
      }
      const saved = await persist({}, status === "Submitted" ? "Submitted" : "Draft");
      if (!saved) return;
      setRow(saved);
      await onSyncSection?.(saved.status, saved.submitted_at);
      await logAudit({ action: "save_draft_anamnesis", module: "Identitas & Anamnesis", candidate_id: cand.id, record_id: exam.id });
      toast.success("Draft anamnesa tersimpan");
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function submitForm() {
    const errs = validate(true);
    if (errs.length) {
      toast.error(errs[0]);
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const saved = await persist({
        submitted_by: u.user?.id,
        submitted_at: now,
        candidate_signed_at: row?.candidate_signed_at ?? now,
      } as any, "Submitted");
      if (!saved) return;
      setRow(saved);
      await onSyncSection?.("Submitted", saved.submitted_at);
      await logAudit({ action: "submit_anamnesis", module: "Identitas & Anamnesis", candidate_id: cand.id, record_id: exam.id });
      toast.success("Anamnesa berhasil disubmit");
    } catch (e: any) {
      toast.error(e.message ?? "Gagal submit");
    } finally {
      setSaving(false);
    }
  }

  async function returnToDraft() {
    if (!row?.id) return;
    setSaving(true);
    try {
      await callAdminReturnToDraft({ data: { examId: exam.id, candidateId: cand.id, reason: returnReason } });
      await load();
      await onSyncSection?.("Draft", null);
      toast.success("Anamnesa dikembalikan ke Draft");
      setReturnOpen(false);
      setReturnReason("");
    } catch (e: any) {
      toast.error(e.message ?? "Gagal mengembalikan");
    } finally {
      setSaving(false);
    }
  }

  async function updateWorkflow(extra: Partial<AnamnesisRow>, action: string, successMsg: string) {
    if (!row?.id) {
      toast.error("Form belum tersimpan");
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = { ...extra, updated_by: u.user?.id };
      const { data, error } = await supabase
        .from("medical_history_forms")
        .update(payload)
        .eq("id", row.id)
        .select()
        .single();
      if (error) throw error;
      setRow(data as AnamnesisRow);
      await logAudit({ action, module: "Identitas & Anamnesis", candidate_id: cand.id, record_id: exam.id, after: extra });
      toast.success(successMsg);
    } catch (e: any) {
      toast.error(e.message ?? "Gagal");
    } finally {
      setSaving(false);
    }
  }

  async function patientSubmit() {
    const errs = validate(true);
    if (errs.length) { toast.error(errs[0]); return; }
    setSaving(true);
    try {
      // Pastikan draft terbaru tersimpan dulu lewat server fn (RLS-safe)
      await callPatientSaveDraft({
        data: {
          examId: exam.id,
          candidateId: cand.id,
          data: {
            identity_data_json: row?.identity_data_json,
            family_history_json: row?.family_history_json,
            personal_history_json: row?.personal_history_json,
            female_health_json: row?.female_health_json,
            work_history_json: row?.work_history_json,
            followup_questions_json: row?.followup_questions_json,
            other_disease_notes: row?.other_disease_notes ?? undefined,
          },
        },
      });
      await callPatientSubmit({
        data: {
          examId: exam.id,
          candidateId: cand.id,
          signatureUrl: row?.candidate_signature_url ?? "",
          honesty: !!row?.honesty_statement_accepted,
        },
      });
      await load();
      await onSyncSection?.("Submitted", new Date().toISOString());
      toast.success("Anamnesa diserahkan ke Dokter Umum untuk direview");
    } catch (e: any) {
      toast.error(e.message ?? "Gagal submit");
    } finally {
      setSaving(false);
    }
  }

  async function doctorSetClear() {
    if (!row?.id) { toast.error("Form belum tersimpan"); return; }
    setSaving(true);
    try {
      await callDoctorSetClear({ data: { examId: exam.id, candidateId: cand.id, note: row?.doctor_review_note ?? undefined } });
      await load();
      toast.success("Anamnesa ditandai Clear oleh Dokter Umum");
    } catch (e: any) {
      toast.error(e.message ?? "Gagal");
    } finally { setSaving(false); }
  }

  async function doctorAddNote() {
    if (!row?.doctor_resume?.trim()) { toast.error("Tulis resume / catatan klinis dulu"); return; }
    setSaving(true);
    try {
      await callDoctorAddNote({
        data: {
          examId: exam.id,
          candidateId: cand.id,
          note: row.doctor_resume,
          resume: row.doctor_resume,
          recommendation: row?.doctor_review_note ?? undefined,
        },
      });
      await load();
      toast.success("Catatan dokter tersimpan");
    } catch (e: any) {
      toast.error(e.message ?? "Gagal");
    } finally { setSaving(false); }
  }

  const [clarOpen, setClarOpen] = useState(false);
  const [clarText, setClarText] = useState("");
  async function doctorRequestClarification() {
    if (!clarText.trim()) { toast.error("Tulis alasan klarifikasi"); return; }
    setSaving(true);
    try {
      await callDoctorRequestClar({ data: { examId: exam.id, candidateId: cand.id, note: clarText } });
      await load();
      await onSyncSection?.("Revision", null);
      toast.success("Klarifikasi diminta ke peserta");
      setClarOpen(false);
      setClarText("");
    } catch (e: any) {
      toast.error(e.message ?? "Gagal");
    } finally { setSaving(false); }
  }

  async function doctorSubmitReview() {
    if (!row?.doctor_signature_url) { toast.error("Tanda tangan dokter wajib diisi"); return; }
    if (!row?.doctor_examiner_name?.trim()) { toast.error("Nama dokter pemeriksa wajib"); return; }
    setSaving(true);
    try {
      await callDoctorSubmitReview({
        data: {
          examId: exam.id,
          candidateId: cand.id,
          signatureUrl: row.doctor_signature_url,
          examinerName: row.doctor_examiner_name,
        },
      });
      await load();
      toast.success("TTD dokter tersimpan");
    } catch (e: any) {
      toast.error(e.message ?? "Gagal");
    } finally { setSaving(false); }
  }

  function exportPDF() {
    if (!row) return;
    const id = row.identity_data_json ?? {};
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("MARKAS BESAR TNI ANGKATAN UDARA", W / 2, 40, { align: "center" });
    doc.text("DINAS KESEHATAN", W / 2, 56, { align: "center" });
    doc.setFontSize(9).text(`No Test: ${id.test_number ?? "-"}`, W - 40, 40, { align: "right" });
    doc.setFontSize(12);
    doc.text("DAFTAR ISIAN RIWAYAT KESEHATAN (ANAMNESA)", W / 2, 84, { align: "center" });

    autoTable(doc, {
      startY: 100,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2 },
      body: [
        ["1. Nama Lengkap", id.full_name ?? "-", "2. Tempat/Tgl Lahir", `${id.birth_place ?? "-"} / ${id.birth_date ?? "-"}`],
        ["3. Seleksi", id.selection_label ?? "-", "4. Asal Panda", id.panda ?? "-"],
        ["5. Maksud Pemeriksaan", id.exam_purpose ?? "-", "6. Nomor Test", id.test_number ?? "-"],
        ["Pangkat / NRP", `${id.rank ?? "-"} / ${id.nrp_nip ?? "-"}`, "Satuan", id.unit_position ?? "-"],
        ["Jenis Kelamin", id.gender === "P" ? "Perempuan" : "Laki-laki", "Kelompok", id.group_name ?? "-"],
      ],
    });

    autoTable(doc, {
      head: [["Riwayat Keluarga", "Ya", "Tidak", "Siapa", "Penyebab Meninggal", "Umur", "Keterangan"]],
      body: (row.family_history_json ?? []).map((f) => [
        f.condition,
        f.has_history ? "✓" : "",
        f.has_history ? "" : "✓",
        f.who ?? "",
        f.cause_of_death ?? "",
        f.age_at_death ?? "",
        f.notes ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    });

    autoTable(doc, {
      head: [["No", "Penyakit/Kelainan Pribadi", "Ya", "Tidak", "Keterangan"]],
      body: (row.personal_history_json ?? []).map((p) => [
        p.item_number,
        p.label,
        p.answer === "Ya" ? "✓" : "",
        p.answer === "Tidak" ? "✓" : "",
        p.notes ?? "",
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    });

    if (isFemale) {
      const fh = row.female_health_json ?? {};
      autoTable(doc, {
        head: [["Bagian Khusus Wanita", "Nilai"]],
        body: [
          ["Hamil", fh.pregnant ? "Ya" : "Tidak"],
          ["Keputihan", fh.vaginal_discharge ? "Ya" : "Tidak"],
          ["Sakit bila haid", fh.painful_menstruation ? "Ya" : "Tidak"],
          ["Haid tidak teratur", fh.irregular_menstruation ? "Ya" : "Tidak"],
          ["Berobat ahli kandungan", fh.visited_gynecologist ? "Ya" : "Tidak"],
          ["Haid mulai umur", fh.menarche_age ?? "-"],
          ["Waktu antara dua haid", fh.cycle_interval ?? "-"],
          ["Lamanya haid", fh.menstruation_duration ?? "-"],
          ["Tanggal terakhir haid", fh.last_period_date ?? "-"],
        ],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      });
    }

    const wh = row.work_history_json ?? {};
    autoTable(doc, {
      head: [["Pekerjaan & Penyakit Lain", "Nilai"]],
      body: [
        ["8. Penyakit-penyakit lain", wh.other_disease_notes ?? row.other_disease_notes ?? "-"],
        ["9. Jumlah pekerjaan 3 thn terakhir", wh.job_count_last_3_years ?? "-"],
        ["10. Lama pekerjaan terlama (bulan)", wh.longest_job_duration_months ?? "-"],
        ["11. Pekerjaan sekarang", wh.current_job ?? "-"],
        ["12. Tangan dominan", wh.dominant_hand ?? "-"],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    });

    autoTable(doc, {
      head: [["No", "Pertanyaan", "Ya", "Tidak", "Keterangan"]],
      body: (row.followup_questions_json ?? []).map((q) => [
        q.number,
        q.question,
        q.answer === "Ya" ? "✓" : "",
        q.answer === "Tidak" ? "✓" : "",
        q.notes ?? "",
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    });

    let y = (doc as any).lastAutoTable.finalY + 16;
    if (y > 720) { doc.addPage(); y = 60; }
    doc.setFontSize(8);
    doc.text(
      "Saya telah memberikan keterangan sebenarnya tanpa merahasiakan sesuatu apapun mengenai kesehatan saya untuk\n" +
      "kepentingan diri sendiri maupun orang lain. Apabila keterangan yang saya buat tidak sebenarnya, maka saya\n" +
      "bersedia menanggung resiko.",
      40, y,
    );
    y += 50;
    doc.text(`Calon Siswa: ${id.full_name ?? "-"}`, 60, y);
    doc.text(`Dokter Pemeriksa: ${row.doctor_examiner_name ?? "-"}`, 320, y);
    if (row.candidate_signature_url) try { doc.addImage(row.candidate_signature_url, "PNG", 40, y + 4, 120, 50); } catch {}
    if (row.doctor_signature_url) try { doc.addImage(row.doctor_signature_url, "PNG", 300, y + 4, 120, 50); } catch {}
    y += 80;
    if (row.doctor_resume) {
      doc.setFont("helvetica", "bold").text("25. Catatan Dokter / Resume Kelainan", 40, y);
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(row.doctor_resume, W - 80), 40, y + 14);
    }

    doc.save(`Anamnesa_${(id.full_name ?? "casis").replace(/\s+/g, "_")}.pdf`);
    logAudit({ action: "export_anamnesis_pdf", module: "Identitas & Anamnesis", candidate_id: cand.id, record_id: exam.id }).catch(() => {});
  }

  if (loading || !row) return <div className="text-sm text-slate-500">Memuat anamnesa…</div>;

  const validationErrors = validate(true);
  const canSubmit = !readOnlyFor(status, isAdmin) && validationErrors.length === 0;

  return (
    <div className="space-y-4">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 -mx-5 -mt-5 px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-slate-900">Identitas & Anamnesis (1–12)</h3>
          <Badge
            variant={ANAMNESIS_STATUS_LABELS[workflow]?.variant ?? "secondary"}
            className={`${WORKFLOW_STYLE[workflow] ?? STATUS_STYLE[status]} border rounded-full text-[11px]`}
          >
            Workflow: {ANAMNESIS_STATUS_LABELS[workflow]?.label ?? workflow}
          </Badge>
          <Badge variant="outline" className="text-[10px]">Status: {status}</Badge>
          {familyYesCount > 0 && <Badge variant="outline" className="text-[10px]">Keluarga: {familyYesCount} Ya</Badge>}
          {personalYesCount > 0 && <Badge variant="outline" className="text-[10px]">Pribadi: {personalYesCount} Ya</Badge>}
          {followupYesCount > 0 && <Badge variant="outline" className="text-[10px]">Lanjutan: {followupYesCount} Ya</Badge>}
          {(familyYesCount + personalYesCount + followupYesCount) > 0 && <Badge className="bg-orange-100 text-orange-800 text-[10px]">Ada Riwayat</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" type="button" onClick={() => setOpenSections(["sec1","sec2","sec3","sec4","sec5","sec6","sec7","sec8"])}>Expand</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setOpenSections([])}>Collapse</Button>
          <Button size="sm" variant="outline" type="button" onClick={exportPDF}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
          {submitted && isAdmin && (
            <Button size="sm" variant="destructive" type="button" onClick={() => setReturnOpen(true)}>
              <Undo2 className="h-4 w-4 mr-1" /> Kembalikan ke Draft
            </Button>
          )}
          {isPatient && patientCanEdit && (
            <>
              <Button size="sm" variant="outline" type="button" onClick={saveDraft} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Simpan Draft
              </Button>
              <Button size="sm" type="button" onClick={patientSubmit} disabled={saving || validationErrors.length > 0}>
                <Send className="h-4 w-4 mr-1" /> Submit (Peserta)
              </Button>
            </>
          )}
          {!isPatient && !readOnlyFor(status, isAdmin) && (
            <>
              <Button size="sm" variant="outline" type="button" onClick={saveDraft} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Simpan Draft
              </Button>
              <Button size="sm" type="button" onClick={submitForm} disabled={saving || !canSubmit}>
                <Send className="h-4 w-4 mr-1" /> Submit
              </Button>
            </>
          )}
          {canDoctorReview && (
            <>
              <Button size="sm" variant="outline" type="button" onClick={() => setClarOpen(true)} disabled={saving}>
                <MessageSquareWarning className="h-4 w-4 mr-1" /> Minta Klarifikasi
              </Button>
              <Button size="sm" variant="outline" type="button" onClick={doctorAddNote} disabled={saving}>
                <Stethoscope className="h-4 w-4 mr-1" /> Simpan Catatan
              </Button>
              <Button size="sm" type="button" onClick={doctorSetClear} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                <ShieldCheck className="h-4 w-4 mr-1" /> Set Clear
              </Button>
            </>
          )}
          {isDoctor && (workflow === "Clear Dokter" || workflow === "Ada Catatan Dokter") && !row.doctor_signed_at && (
            <Button size="sm" type="button" onClick={doctorSubmitReview} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              <Stethoscope className="h-4 w-4 mr-1" /> TTD Dokter
            </Button>
          )}
        </div>
      </div>

      {workflow === "Perlu Klarifikasi" && row.clarification_note && (
        <Alert className="border-orange-300 bg-orange-50">
          <MessageSquareWarning className="h-4 w-4 text-orange-700" />
          <AlertDescription className="text-orange-900">
            <div className="font-semibold">Dokter Umum meminta klarifikasi:</div>
            <div className="text-sm mt-1">{row.clarification_note}</div>
            {row.clarification_requested_at && (
              <div className="text-[11px] text-orange-700 mt-1">Diminta: {new Date(row.clarification_requested_at).toLocaleString("id-ID")}</div>
            )}
          </AlertDescription>
        </Alert>
      )}
      {workflow === "Clear Dokter" && (
        <Alert className="border-emerald-300 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <AlertDescription className="text-emerald-900 text-sm">
            Anamnesa telah ditandai <b>Clear</b> oleh Dokter Umum
            {row.doctor_reviewed_at && ` pada ${new Date(row.doctor_reviewed_at).toLocaleString("id-ID")}`}.
          </AlertDescription>
        </Alert>
      )}
      {workflow === "Ada Catatan Dokter" && (
        <Alert className="border-teal-300 bg-teal-50">
          <Stethoscope className="h-4 w-4 text-teal-700" />
          <AlertDescription className="text-teal-900 text-sm">
            Dokter Umum memberi catatan klinis. Lihat bagian <b>8. Catatan Dokter</b>.
          </AlertDescription>
        </Alert>
      )}

      {locked && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>Anamnesa telah dikunci dan tidak dapat diubah.</AlertDescription>
        </Alert>
      )}
      {!locked && validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">{validationErrors.length} item belum lengkap:</div>
            <ul className="list-disc ml-5 text-xs mt-1 max-h-32 overflow-y-auto">
              {validationErrors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
              {validationErrors.length > 8 && <li>… dan {validationErrors.length - 8} lainnya</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue={isDoctor && !isPatient ? "review" : "identitas"} className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="identitas">1. Data Peserta</TabsTrigger>
          <TabsTrigger value="riwayat">
            2. Riwayat Kesehatan
            {(familyYesCount + personalYesCount + followupYesCount) > 0 && (
              <Badge variant="outline" className="ml-2 text-[10px]">{familyYesCount + personalYesCount + followupYesCount} Ya</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ttd" className="relative">
            3. Pernyataan &amp; TTD
            {isPatient && !row?.patient_signature_url && (workflow === "Draft Peserta" || workflow === "Perlu Klarifikasi") && (
              <span aria-label="Perlu tindak lanjut" className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="review" className="relative">
            4. Review Dokter
            {isPatient && (workflow === "Perlu Klarifikasi" || workflow === "Ada Catatan Dokter") && (
              <span aria-label="Catatan baru dari dokter" className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
            {isDoctor && !isPatient && workflow === "Submitted Peserta" && (
              <span aria-label="Menunggu review dokter" className="ml-2 inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* ============ TAB 1: DATA PESERTA ============ */}
        <TabsContent value="identitas" className="mt-4">
          <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="space-y-2">
            <AccordionItem value="sec1" className="border rounded-md">
          <AccordionTrigger className="px-4">1. Identitas Peserta</AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nama Lengkap *"><Input value={row.identity_data_json?.full_name ?? ""} onChange={(e) => patchIdentity({ full_name: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="Nomor Test *"><Input value={row.identity_data_json?.test_number ?? ""} onChange={(e) => patchIdentity({ test_number: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="Tempat Lahir *"><Input value={row.identity_data_json?.birth_place ?? ""} onChange={(e) => patchIdentity({ birth_place: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="Tanggal Lahir *"><Input type="date" value={row.identity_data_json?.birth_date ?? ""} onChange={(e) => patchIdentity({ birth_date: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="Seleksi *"><Input value={row.identity_data_json?.selection_label ?? ""} onChange={(e) => patchIdentity({ selection_label: e.target.value })} placeholder="Contoh: SEMABA GEL I A-55 TA 2025" disabled={!canEditCandidateData} /></Field>
              <Field label="Asal Panda *"><Input value={row.identity_data_json?.panda ?? ""} onChange={(e) => patchIdentity({ panda: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="Maksud Pemeriksaan *"><Input value={row.identity_data_json?.exam_purpose ?? ""} onChange={(e) => patchIdentity({ exam_purpose: e.target.value })} placeholder="Pemeriksaan Berkala / Seleksi Pendidikan / RIKKES" disabled={!canEditCandidateData} /></Field>
              <Field label="Pangkat"><Input value={row.identity_data_json?.rank ?? ""} onChange={(e) => patchIdentity({ rank: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="NRP/NIP"><Input value={row.identity_data_json?.nrp_nip ?? ""} onChange={(e) => patchIdentity({ nrp_nip: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="Satuan/Kesatuan"><Input value={row.identity_data_json?.unit_position ?? ""} onChange={(e) => patchIdentity({ unit_position: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="Kelompok"><Input value={row.identity_data_json?.group_name ?? ""} onChange={(e) => patchIdentity({ group_name: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="Jenis Kelamin">
                <RadioGroup className="flex gap-4" value={row.identity_data_json?.gender ?? "L"} onValueChange={(v) => patchIdentity({ gender: v })} disabled={!canEditCandidateData}>
                  <label className="flex items-center gap-1 text-sm"><RadioGroupItem value="L" /> Laki-laki</label>
                  <label className="flex items-center gap-1 text-sm"><RadioGroupItem value="P" /> Perempuan</label>
                </RadioGroup>
              </Field>
              <Field label="Nomor HP"><Input value={row.identity_data_json?.phone ?? ""} onChange={(e) => patchIdentity({ phone: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="Alamat" full><Textarea rows={2} value={row.identity_data_json?.address ?? ""} onChange={(e) => patchIdentity({ address: e.target.value })} disabled={!canEditCandidateData} /></Field>
            </div>
          </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        {/* ============ TAB 2: RIWAYAT KESEHATAN ============ */}
        <TabsContent value="riwayat" className="mt-4">
          <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="space-y-2">
            <AccordionItem value="sec2" className="border rounded-md">
          <AccordionTrigger className="px-4">2. Riwayat Keluarga {familyYesCount > 0 && <Badge variant="outline" className="ml-2">{familyYesCount} Ya</Badge>}</AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left border">Penyakit</th>
                    <th className="p-2 border w-12">Ya</th>
                    <th className="p-2 border w-12">Tidak</th>
                    <th className="p-2 text-left border">Siapa</th>
                    <th className="p-2 text-left border">Penyebab Meninggal</th>
                    <th className="p-2 text-left border w-20">Umur</th>
                    <th className="p-2 text-left border">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {(row.family_history_json ?? []).map((f, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 border align-top">{f.condition}</td>
                      <td className="p-2 border text-center"><input type="radio" checked={f.has_history === true} onChange={() => updateFamily(idx, { has_history: true })} disabled={!canEditCandidateData} /></td>
                      <td className="p-2 border text-center"><input type="radio" checked={f.has_history === false} onChange={() => updateFamily(idx, { has_history: false, who: "", cause_of_death: "", age_at_death: "" })} disabled={!canEditCandidateData} /></td>
                      <td className="p-2 border"><Input className="h-7 text-xs" value={f.who ?? ""} onChange={(e) => updateFamily(idx, { who: e.target.value })} disabled={!canEditCandidateData || !f.has_history} /></td>
                      <td className="p-2 border"><Input className="h-7 text-xs" value={f.cause_of_death ?? ""} onChange={(e) => updateFamily(idx, { cause_of_death: e.target.value })} disabled={!canEditCandidateData || !f.has_history} /></td>
                      <td className="p-2 border"><Input className="h-7 text-xs" value={f.age_at_death ?? ""} onChange={(e) => updateFamily(idx, { age_at_death: e.target.value })} disabled={!canEditCandidateData || !f.has_history} /></td>
                      <td className="p-2 border"><Input className="h-7 text-xs" value={f.notes ?? ""} onChange={(e) => updateFamily(idx, { notes: e.target.value })} disabled={!canEditCandidateData} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 3 — Riwayat Penyakit Pribadi */}
        <AccordionItem value="sec3" className="border rounded-md">
          <AccordionTrigger className="px-4">3. Riwayat Penyakit/Kelainan Pribadi {personalYesCount > 0 && <Badge variant="outline" className="ml-2">{personalYesCount} Ya</Badge>}</AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <p className="text-xs text-slate-600 mb-3">Apakah saudara pernah/sedang menderita penyakit/kelainan di bawah ini? Jika "Ya", isi keterangan.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {(row.personal_history_json ?? []).map((p, idx) => (
                <div key={idx} className={`border rounded p-2 ${p.answer === "Ya" ? "bg-orange-50 border-orange-200" : "bg-white"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-medium flex-1"><span className="text-slate-500 mr-1">{p.item_number}.</span>{p.label}</div>
                    <div className="flex gap-2 text-xs">
                      <label className="flex items-center gap-1"><input type="radio" checked={p.answer === "Ya"} onChange={() => updatePersonal(idx, { answer: "Ya" })} disabled={!canEditCandidateData} /> Ya</label>
                      <label className="flex items-center gap-1"><input type="radio" checked={p.answer === "Tidak"} onChange={() => updatePersonal(idx, { answer: "Tidak", notes: "" })} disabled={!canEditCandidateData} /> Tidak</label>
                    </div>
                  </div>
                  {p.answer === "Ya" && (
                    <Input className="h-7 text-xs mt-2" placeholder="Keterangan (wajib)" value={p.notes ?? ""} onChange={(e) => updatePersonal(idx, { notes: e.target.value })} disabled={!canEditCandidateData} />
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 4 — Wanita */}
        <AccordionItem value="sec4" className="border rounded-md">
          <AccordionTrigger className="px-4">4. Bagian Khusus Wanita</AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {!isFemale ? (
              <p className="text-xs text-slate-600 italic">Bagian khusus wanita tidak berlaku untuk peserta laki-laki.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { k: "pregnant", l: "Hamil" },
                    { k: "vaginal_discharge", l: "Keputihan" },
                    { k: "painful_menstruation", l: "Sakit bila haid" },
                    { k: "irregular_menstruation", l: "Haid tidak teratur" },
                    { k: "visited_gynecologist", l: "Berobat pada ahli kandungan" },
                  ].map((f) => (
                    <div key={f.k} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                      <span>{f.l}</span>
                      <div className="flex gap-3 text-xs">
                        <label className="flex items-center gap-1"><input type="radio" checked={row.female_health_json?.[f.k] === true} onChange={() => patchFemale({ [f.k]: true })} disabled={!canEditCandidateData} /> Ya</label>
                        <label className="flex items-center gap-1"><input type="radio" checked={row.female_health_json?.[f.k] !== true} onChange={() => patchFemale({ [f.k]: false })} disabled={!canEditCandidateData} /> Tidak</label>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Haid mulai umur"><Input value={row.female_health_json?.menarche_age ?? ""} onChange={(e) => patchFemale({ menarche_age: e.target.value })} disabled={!canEditCandidateData} /></Field>
                  <Field label="Waktu antara dua haid"><Input value={row.female_health_json?.cycle_interval ?? ""} onChange={(e) => patchFemale({ cycle_interval: e.target.value })} disabled={!canEditCandidateData} /></Field>
                  <Field label="Lamanya haid"><Input value={row.female_health_json?.menstruation_duration ?? ""} onChange={(e) => patchFemale({ menstruation_duration: e.target.value })} disabled={!canEditCandidateData} /></Field>
                  <Field label="Tanggal terakhir haid"><Input type="date" value={row.female_health_json?.last_period_date ?? ""} onChange={(e) => patchFemale({ last_period_date: e.target.value })} disabled={!canEditCandidateData} /></Field>
                  <Field label="Keterangan tambahan" full><Textarea rows={2} value={row.female_health_json?.notes ?? ""} onChange={(e) => patchFemale({ notes: e.target.value })} disabled={!canEditCandidateData} /></Field>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 5 — Pekerjaan */}
        <AccordionItem value="sec5" className="border rounded-md">
          <AccordionTrigger className="px-4">5. Keterangan Penyakit Lain & Pekerjaan</AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="8. Keterangan Penyakit Lain" full>
                <Textarea rows={3} value={row.work_history_json?.other_disease_notes ?? ""} onChange={(e) => patchWork({ other_disease_notes: e.target.value })} disabled={!canEditCandidateData} />
              </Field>
              <Field label="9. Jumlah pekerjaan dalam 3 tahun terakhir"><Input value={row.work_history_json?.job_count_last_3_years ?? ""} onChange={(e) => patchWork({ job_count_last_3_years: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="10. Lama pekerjaan terlama (bulan)"><Input value={row.work_history_json?.longest_job_duration_months ?? ""} onChange={(e) => patchWork({ longest_job_duration_months: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="11. Pekerjaan sekarang"><Input value={row.work_history_json?.current_job ?? ""} onChange={(e) => patchWork({ current_job: e.target.value })} disabled={!canEditCandidateData} /></Field>
              <Field label="12. Tangan dominan">
                <RadioGroup className="flex gap-4" value={row.work_history_json?.dominant_hand ?? "Kanan"} onValueChange={(v) => patchWork({ dominant_hand: v })} disabled={!canEditCandidateData}>
                  <label className="flex items-center gap-1 text-sm"><RadioGroupItem value="Kanan" /> Kanan</label>
                  <label className="flex items-center gap-1 text-sm"><RadioGroupItem value="Kiri" /> Kiri</label>
                  <label className="flex items-center gap-1 text-sm"><RadioGroupItem value="Keduanya" /> Keduanya</label>
                </RadioGroup>
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 6 — Pertanyaan Lanjutan */}
        <AccordionItem value="sec6" className="border rounded-md">
          <AccordionTrigger className="px-4">6. Pertanyaan Lanjutan (13–24) {followupYesCount > 0 && <Badge variant="outline" className="ml-2">{followupYesCount} Ya</Badge>}</AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 border w-14">No</th>
                    <th className="p-2 border text-left">Pertanyaan</th>
                    <th className="p-2 border w-12">Ya</th>
                    <th className="p-2 border w-12">Tidak</th>
                    <th className="p-2 border text-left">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {(row.followup_questions_json ?? []).map((q, idx) => (
                    <tr key={idx} className={`border-t ${q.answer === "Ya" ? "bg-orange-50" : ""}`}>
                      <td className="p-2 border font-mono">{q.number}</td>
                      <td className="p-2 border">{q.question}</td>
                      <td className="p-2 border text-center"><input type="radio" checked={q.answer === "Ya"} onChange={() => updateFollowup(idx, { answer: "Ya" })} disabled={!canEditCandidateData} /></td>
                      <td className="p-2 border text-center"><input type="radio" checked={q.answer === "Tidak"} onChange={() => updateFollowup(idx, { answer: "Tidak", notes: "" })} disabled={!canEditCandidateData} /></td>
                      <td className="p-2 border"><Input className="h-7 text-xs" value={q.notes ?? ""} onChange={(e) => updateFollowup(idx, { notes: e.target.value })} disabled={!canEditCandidateData || q.answer !== "Ya"} placeholder={q.answer === "Ya" ? "Wajib" : ""} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionContent>
        </AccordionItem>
          </Accordion>
        </TabsContent>

        {/* ============ TAB 3: PERNYATAAN & TTD ============ */}
        <TabsContent value="ttd" className="mt-4">
          <Accordion type="multiple" defaultValue={["sec7"]} className="space-y-2">
            <AccordionItem value="sec7" className="border rounded-md">
          <AccordionTrigger className="px-4">7. Pernyataan Kejujuran & Tanda Tangan</AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="p-3 border rounded bg-slate-50 text-xs text-slate-700 italic">
              "Saya telah memberikan keterangan sebenarnya tanpa merahasiakan sesuatu apapun mengenai kesehatan saya untuk
              kepentingan diri sendiri maupun orang lain. Apabila keterangan yang saya buat tidak sebenarnya, maka saya
              bersedia menanggung resiko."
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={row.honesty_statement_accepted} onCheckedChange={(v) => patch("honesty_statement_accepted", Boolean(v))} disabled={!canEditCandidateData} />
              Saya menyatakan bahwa keterangan di atas benar.
            </label>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label className="text-xs font-medium">Tanda Tangan Calon Siswa</Label>
                <SignaturePad value={row.candidate_signature_url} onChange={(v) => { patch("candidate_signature_url", v); patch("candidate_signed_at", v ? new Date().toISOString() : null); }} disabled={!canEditCandidateData} />
                <div className="text-[11px] text-slate-500 mt-1">Ditandatangani: {row.candidate_signed_at ? new Date(row.candidate_signed_at).toLocaleString("id-ID") : "—"}</div>
              </div>
              <div className="text-xs text-slate-500 italic border rounded p-3 bg-slate-50">
                Tanda tangan Dokter Pemeriksa berada di tab <b>4. Review Dokter</b>.
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
          </Accordion>
        </TabsContent>

        {/* ============ TAB 4: REVIEW DOKTER ============ */}
        <TabsContent value="review" className="mt-4">
          <Accordion type="multiple" defaultValue={["sec8", "sec8b"]} className="space-y-2">
            <AccordionItem value="sec8b" className="border rounded-md">
              <AccordionTrigger className="px-4">Tanda Tangan Dokter Pemeriksa</AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-medium">Tanda Tangan Dokter</Label>
                    <SignaturePad value={row.doctor_signature_url} onChange={(v) => { patch("doctor_signature_url", v); patch("doctor_signed_at", v ? new Date().toISOString() : null); }} disabled={!canEditDoctorData} />
                    <Input className="mt-2" placeholder="Nama Dokter Pemeriksa" value={row.doctor_examiner_name ?? ""} onChange={(e) => patch("doctor_examiner_name", e.target.value)} disabled={!canEditDoctorData} />
                    <div className="text-[11px] text-slate-500 mt-1">Ditandatangani: {row.doctor_signed_at ? new Date(row.doctor_signed_at).toLocaleString("id-ID") : "—"}</div>
                  </div>
                  <div className="text-xs text-slate-600 border rounded p-3 bg-slate-50 space-y-1">
                    <div><b>TTD Peserta:</b> {row.candidate_signed_at ? new Date(row.candidate_signed_at).toLocaleString("id-ID") : "— belum"}</div>
                    <div><b>Workflow:</b> {workflow}</div>
                    <div><b>Status Review:</b> {row.doctor_review_status ?? "—"}</div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="sec8" className="border rounded-md">
          <AccordionTrigger className="px-4">8. Catatan Dokter / Resume Kelainan</AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            {!isDoctor && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">Catatan dokter hanya dapat diisi oleh dokter/admin.</AlertDescription>
              </Alert>
            )}
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Nama Dokter Pemeriksa"><Input value={row.doctor_notes_json?.examiner_name ?? ""} onChange={(e) => patch("doctor_notes_json", { ...row.doctor_notes_json, examiner_name: e.target.value })} disabled={!canEditDoctorData} /></Field>
              <Field label="Pangkat / NRP Dokter"><Input value={row.doctor_notes_json?.examiner_rank_nrp ?? ""} onChange={(e) => patch("doctor_notes_json", { ...row.doctor_notes_json, examiner_rank_nrp: e.target.value })} disabled={!canEditDoctorData} /></Field>
              <Field label="Tanggal Catatan"><Input type="date" value={row.doctor_notes_json?.doctor_note_date ?? ""} onChange={(e) => patch("doctor_notes_json", { ...row.doctor_notes_json, doctor_note_date: e.target.value })} disabled={!canEditDoctorData} /></Field>
            </div>
            <Field label="25. Catatan Dokter / Resume Kelainan" full>
              <Textarea rows={6} value={row.doctor_resume ?? ""} onChange={(e) => { patch("doctor_resume", e.target.value); patch("doctor_notes_json", { ...row.doctor_notes_json, doctor_resume: e.target.value }); }} disabled={!canEditDoctorData} placeholder="Resume klinis dokter pemeriksa" />
            </Field>
          </AccordionContent>
        </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kembalikan Anamnesa ke Draft</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Alasan</Label>
            <Textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Misal: ada data perlu dilengkapi" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={returnToDraft} disabled={saving}>Kembalikan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clarOpen} onOpenChange={setClarOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Minta Klarifikasi ke Peserta</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Pertanyaan / hal yang perlu diklarifikasi</Label>
            <Textarea
              value={clarText}
              onChange={(e) => setClarText(e.target.value)}
              rows={4}
              placeholder="Mis. Mohon perjelas riwayat operasi sebelumnya (kapan dan dimana)"
            />
            <p className="text-[11px] text-slate-500">
              Status akan berubah ke "Perlu Klarifikasi" dan peserta dapat mengedit kembali anamnesanya.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClarOpen(false)}>Batal</Button>
            <Button onClick={doctorRequestClarification} disabled={saving}>Kirim Permintaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function readOnlyFor(status: string, isAdmin: boolean): boolean {
  if (status === "Locked") return true;
  if ((status === "Submitted" || status === "Approved") && !isAdmin) return true;
  return false;
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? "md:col-span-2" : ""}`}>
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}