import { generateId, getDb, nowIso, saveDb } from "@/lib/localDb";
import { createCandidateLocal, updateCandidateLocal } from "@/lib/services/candidateService";
import { ensureExamForCandidateLocal } from "@/lib/services/examService";
import { logAudit } from "@/lib/audit";
import type { PreviewRow } from "./rikkes-xlsx-import";
import { refreshAllDerivedDataLocal, syncAllLocalRelations } from "@/lib/services/syncService";

export interface ImportOptions {
  selectionId: string;
  sessionId: string;
  duplicateAction: "skip" | "update" | "create_new";
  recalculate: boolean;
}

export interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  warnings: number;
}

/** Find existing candidate in the selection by test_number */
async function findDuplicate(selectionId: string, testNumber: string) {
  if (!testNumber) return null;
  const db = getDb() as any;
  return (
    (db.candidates ?? []).find(
      (candidate: any) =>
        candidate.selection_id === selectionId &&
        String(candidate.test_number ?? "").trim() === String(testNumber ?? "").trim() &&
        !candidate.is_deleted &&
        !candidate.deleted_at,
    )?.id ?? null
  );
}

function appendImportRow(row: any) {
  const db = getDb() as any;
  db.import_session_rows = db.import_session_rows ?? [];
  db.import_session_rows.push({ id: generateId("isr"), ...row, created_at: nowIso() });
  saveDb(db);
}

export async function executeImport(
  rows: PreviewRow[],
  opts: ImportOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { success: 0, failed: 0, skipped: 0, warnings: 0 };
  const toImport = rows.filter((r) => !r.excluded && r.status !== "Error");
  const total = toImport.length;
  let done = 0;

  for (const row of toImport) {
    try {
      const existingId = await findDuplicate(opts.selectionId, row.test_number);
      let candidateId = existingId;
      let action: "create" | "update" | "skip" = "create";

      if (existingId) {
        if (opts.duplicateAction === "skip") {
          appendImportRow({
            import_session_id: opts.sessionId,
            row_number: row.rowNumber,
            sheet_name: row.sourceSheets.join(","),
            test_number: row.test_number,
            full_name: row.full_name,
            candidate_id: existingId,
            row_status: "Skipped",
            action_taken: "skip_duplicate",
            warning_messages_json: row.warnings,
            mapped_data_json: JSON.parse(JSON.stringify(row)),
          });
          result.skipped++;
          done++;
          onProgress?.(done, total);
          continue;
        }
        action = "update";
      }

      const candidatePayload = {
        selection_id: opts.selectionId,
        serial_number: row.serial_number,
        test_number: row.test_number,
        test_number_status: row.test_number ? "assigned" : "pending",
        no_test_missing: !String(row.test_number ?? "").trim(),
        full_name: row.full_name || row.combined_identity || "(Tanpa nama)",
        pok_korp: row.pok_korp,
        panda: row.panda,
        unit_position: row.unit_position,
        birth_place: row.birth_place,
        birth_date: row.birth_date,
        combined_identity: row.combined_identity,
        rank: row.rank,
        nrp_nip: row.nrp_nip,
        generation: row.generation,
        source_import_session_id: opts.sessionId,
      };

      if (action === "update" && candidateId) {
        updateCandidateLocal(candidateId, candidatePayload);
      } else {
        const candidate = createCandidateLocal(candidatePayload);
        candidateId = candidate.id;
      }

      const exam = ensureExamForCandidateLocal(candidateId!);
      const examId = exam?.id;

      if (examId) {
        const db = getDb() as any;
        if (row.height_cm || row.weight_kg || row.bmi) {
          db.medical_measurements = db.medical_measurements ?? [];
          const existing = db.medical_measurements.find((item: any) => item.exam_id === examId);
          const mmPatch = {
            height_cm: row.height_cm,
            weight_kg: row.weight_kg,
            bmi: row.bmi ?? row.bmi_calc,
            chest_or_waist_lp: row.chest_or_waist_lp,
            weight_difference: row.weight_difference,
            updated_at: nowIso(),
          };
          if (existing) Object.assign(existing, mmPatch);
          else
            db.medical_measurements.push({
              id: generateId("mm"),
              exam_id: examId,
              candidate_id: candidateId,
              ...mmPatch,
              created_at: nowIso(),
            });
        }

        for (const [key, sec] of Object.entries(row.sections || {})) {
          if (!sec || (!sec.findings && !sec.classification && !sec.notes)) continue;
          const section = (db.exam_sections ?? []).find(
            (item: any) => item.exam_id === examId && item.section_key === key,
          );
          if (section)
            Object.assign(section, {
              findings: sec.findings,
              classification: sec.classification,
              notes: sec.notes,
              updated_at: nowIso(),
            });
        }

        db.medical_summary = db.medical_summary ?? [];
        const summary = db.medical_summary.find((item: any) => item.exam_id === examId);
        const summaryPatch = {
          exam_id: examId,
          candidate_id: candidateId,
          kesum_classification: row.kesum_classification,
          keswa_status: row.keswa_status,
          final_result: row.final_result,
          final_score: row.final_score,
          k1_notes: row.k1_notes,
          k2_notes: row.k2_notes,
          attention_notes: row.attention_notes,
          suggestions: row.suggestions,
          updated_at: nowIso(),
        };
        if (summary) Object.assign(summary, summaryPatch);
        else
          db.medical_summary.push({ id: generateId("ms"), ...summaryPatch, created_at: nowIso() });

        const localExam = (db.exams ?? []).find((item: any) => item.id === examId);
        if (localExam)
          Object.assign(localExam, {
            kesum_classification: row.kesum_classification,
            keswa_status: row.keswa_status,
            final_result: row.final_result,
            final_score: row.final_score,
            source_import_session_id: opts.sessionId,
            updated_at: nowIso(),
          });
        saveDb(db);
      }

      appendImportRow({
        import_session_id: opts.sessionId,
        row_number: row.rowNumber,
        sheet_name: row.sourceSheets.join(","),
        test_number: row.test_number,
        full_name: row.full_name,
        candidate_id: candidateId,
        exam_id: examId,
        row_status: row.warnings.length ? "Success With Warnings" : "Success",
        action_taken: action,
        warning_messages_json: row.warnings,
        mapped_data_json: JSON.parse(JSON.stringify(row)),
      });

      result.success++;
      if (row.warnings.length) result.warnings++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendImportRow({
        import_session_id: opts.sessionId,
        row_number: row.rowNumber,
        sheet_name: row.sourceSheets.join(","),
        test_number: row.test_number,
        full_name: row.full_name,
        row_status: "Failed",
        error_messages_json: [msg, ...row.errors],
        mapped_data_json: JSON.parse(JSON.stringify(row)),
      });
      result.failed++;
    }
    done++;
    onProgress?.(done, total);
  }

  const db = getDb() as any;
  const session = (db.import_sessions ?? []).find((item: any) => item.id === opts.sessionId);
  if (session)
    Object.assign(session, {
      total_rows: rows.length,
      success_rows: result.success,
      failed_rows: result.failed,
      warning_rows: result.warnings,
      skipped_rows: result.skipped,
      status: result.failed > 0 ? "Completed With Errors" : "Completed",
      completed_at: new Date().toISOString(),
    });
  saveDb(db);

  await logAudit({
    action: "import_data",
    module: "Import Data",
    record_id: opts.sessionId,
    after: result as unknown,
  });

  syncAllLocalRelations({ auditAction: "import_data", module: "Import Data" });
  refreshAllDerivedDataLocal();

  return result;
}
