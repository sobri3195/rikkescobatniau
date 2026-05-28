import { supabase } from "@/lib/local-supabase-shim";
import { logAudit } from "@/lib/audit";
import type { PreviewRow } from "./rikkes-xlsx-import";

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
  const { data } = await supabase
    .from("candidates")
    .select("id")
    .eq("selection_id", selectionId)
    .eq("test_number", testNumber)
    .is("deleted_at", null)
    .maybeSingle();
  return data?.id || null;
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
          await supabase.from("import_session_rows").insert({
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
        await supabase.from("candidates").update(candidatePayload).eq("id", candidateId);
      } else {
        const { data: newCand, error } = await supabase
          .from("candidates")
          .insert(candidatePayload)
          .select("id")
          .single();
        if (error) throw error;
        candidateId = newCand.id;
      }

      // The DB trigger create_exam_for_candidate auto-creates exam + sections for new candidates.
      // Fetch the exam id.
      const { data: exam } = await supabase
        .from("exams")
        .select("id")
        .eq("candidate_id", candidateId!)
        .maybeSingle();
      const examId = exam?.id;

      if (examId) {
        // measurements
        if (row.height_cm || row.weight_kg || row.bmi) {
          await supabase
            .from("medical_measurements")
            .update({
              height_cm: row.height_cm,
              weight_kg: row.weight_kg,
              bmi: row.bmi ?? row.bmi_calc,
              chest_or_waist_lp: row.chest_or_waist_lp,
              weight_difference: row.weight_difference,
            })
            .eq("exam_id", examId);
        }

        // sections
        for (const [key, sec] of Object.entries(row.sections || {})) {
          if (!sec || (!sec.findings && !sec.classification && !sec.notes)) continue;
          await supabase
            .from("exam_sections")
            .update({
              findings: sec.findings,
              classification: sec.classification,
              notes: sec.notes,
            })
            .eq("exam_id", examId)
            .eq("section_key", key);
        }

        // summary
        await supabase
          .from("medical_summary")
          .update({
            kesum_classification: row.kesum_classification,
            keswa_status: row.keswa_status,
            final_result: row.final_result,
            final_score: row.final_score,
            k1_notes: row.k1_notes,
            k2_notes: row.k2_notes,
            attention_notes: row.attention_notes,
            suggestions: row.suggestions,
          })
          .eq("exam_id", examId);

        // exams summary fields
        await supabase
          .from("exams")
          .update({
            kesum_classification: row.kesum_classification,
            keswa_status: row.keswa_status,
            final_result: row.final_result,
            final_score: row.final_score,
            source_import_session_id: opts.sessionId,
          })
          .eq("id", examId);
      }

      await supabase.from("import_session_rows").insert({
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
      await supabase.from("import_session_rows").insert({
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

  await supabase
    .from("import_sessions")
    .update({
      total_rows: rows.length,
      success_rows: result.success,
      failed_rows: result.failed,
      warning_rows: result.warnings,
      skipped_rows: result.skipped,
      status: result.failed > 0 ? "Completed With Errors" : "Completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", opts.sessionId);

  await logAudit({
    action: result.failed > 0 ? "import_completed_with_errors" : "import_completed",
    module: "Import Data",
    record_id: opts.sessionId,
    after: result as unknown,
  });

  return result;
}