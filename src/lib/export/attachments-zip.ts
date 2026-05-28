import JSZip from "jszip";
import { saveAs } from "file-saver";
import { localDataApi } from "@/lib/localDataApi";

type Att = { name?: string; path: string; type?: string };

async function downloadOne(path: string): Promise<Blob | null> {
  const { data, error } = await localDataApi.storage.from("hari-h-attachments").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return null;
  try {
    const r = await fetch(data.signedUrl);
    if (!r.ok) return null;
    return await r.blob();
  } catch {
    return null;
  }
}

function safeFolder(s: string | null | undefined) {
  return (s ?? "tanpa-nama").replace(/[^a-zA-Z0-9_\-. ]+/g, "_").slice(0, 80);
}

export async function exportAttachmentsZip(opts: {
  selectionId?: string | null;
  candidateIds?: string[];
  zipName?: string;
  onProgress?: (done: number, total: number) => void;
}) {
  // 1) Resolve candidate set
  let candQ = localDataApi.from("candidates").select("id, full_name, test_number, temporary_id, selection_id");
  if (opts.candidateIds?.length) candQ = candQ.in("id", opts.candidateIds);
  else if (opts.selectionId) candQ = candQ.eq("selection_id", opts.selectionId);
  const { data: cands, error: cErr } = await candQ;
  if (cErr) throw cErr;
  const candidateIds = (cands ?? []).map((c) => c.id);
  if (candidateIds.length === 0) throw new Error("Tidak ada peserta untuk diekspor");
  const candMap = new Map<string, any>((cands ?? []).map((c) => [c.id, c]));

  // 2) Pull attachments from EKG + Radiology rows for those exams
  const { data: exams } = await localDataApi.from("exams").select("id, candidate_id").in("candidate_id", candidateIds);
  const examMap = new Map<string, string>((exams ?? []).map((e: any) => [e.id, e.candidate_id]));
  const examIds = [...examMap.keys()];
  if (examIds.length === 0) throw new Error("Tidak ada exam terkait peserta");

  const [ekg, rad] = await Promise.all([
    localDataApi.from("exam_cardiology").select("exam_id, attachments_json").in("exam_id", examIds),
    localDataApi.from("exam_radiology").select("exam_id, attachments_json").in("exam_id", examIds),
  ]);

  type Job = { candidateId: string; folder: string; att: Att };
  const jobs: Job[] = [];
  const pushFor = (rows: any[] | null, sub: string) => {
    for (const row of rows ?? []) {
      const candidateId = examMap.get(row.exam_id);
      if (!candidateId) continue;
      const atts: Att[] = Array.isArray(row.attachments_json) ? row.attachments_json : [];
      for (const a of atts) {
        if (!a?.path) continue;
        jobs.push({ candidateId, folder: sub, att: a });
      }
    }
  };
  pushFor(ekg.data as any[], "ekg");
  pushFor(rad.data as any[], "radiology");

  if (jobs.length === 0) throw new Error("Tidak ada lampiran untuk diekspor");

  // 3) Build ZIP
  const zip = new JSZip();
  let done = 0;
  for (const j of jobs) {
    const cand = candMap.get(j.candidateId);
    const folderName = `${safeFolder(cand?.test_number || cand?.temporary_id)}_${safeFolder(cand?.full_name)}`;
    const blob = await downloadOne(j.att.path);
    done++;
    opts.onProgress?.(done, jobs.length);
    if (!blob) continue;
    const filename = safeFolder(j.att.name || j.att.path.split("/").pop() || "file");
    zip.folder(folderName)!.folder(j.folder)!.file(filename, blob);
  }

  // 4) manifest
  const manifest = jobs.map((j) => {
    const c = candMap.get(j.candidateId);
    return {
      candidate: c?.full_name,
      test_number: c?.test_number || c?.temporary_id,
      kind: j.folder,
      file: j.att.name,
      path: j.att.path,
    };
  });
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const out = await zip.generateAsync({ type: "blob" });
  const filename = opts.zipName || `lampiran-rikkes-${new Date().toISOString().slice(0, 10)}.zip`;
  saveAs(out, filename);
  return { total: jobs.length, succeeded: done };
}