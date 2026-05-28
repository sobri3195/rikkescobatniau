import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Mengambil exam milik peserta/casis yang sedang login (berdasarkan
 * candidates.linked_user_id). Bila peserta belum ditautkan ke kandidat
 * apa pun, akan auto-provisioning satu kandidat sandbox pada seleksi
 * paling baru — supaya akun uji coba (peserta@/casis@) bisa langsung
 * mengisi anamnesis tanpa setup admin.
 */
export const getMyExamForAnamnesis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;

    // Pastikan user benar-benar peserta/casis (jangan auto-provision untuk role lain).
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role as string);
    const isPatient = roles.some((r) => r === "peserta" || r === "casis");
    if (!isPatient) {
      throw new Error("Akses ditolak: hanya akun peserta/casis yang dapat membuka halaman ini.");
    }

    // Profil (untuk nama saat auto-provision)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, nrp_nip")
      .eq("auth_user_id", userId)
      .maybeSingle();

    // Cari kandidat yang sudah ditautkan
    let { data: cand } = await supabaseAdmin
      .from("candidates")
      .select("id, selection_id, full_name, rank, nrp_nip, test_number, temporary_id, unit_position, pok_korp, panda")
      .eq("linked_user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cand) {
      // Auto-provision sandbox candidate pada seleksi terbaru
      const { data: sel } = await supabaseAdmin
        .from("selections")
        .select("id, name")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sel) {
        throw new Error("Belum ada Master Seleksi. Hubungi admin untuk dibuatkan.");
      }
      const fullName = profile?.full_name || profile?.email || "Peserta Uji Coba";
      const { data: created, error: insErr } = await supabaseAdmin
        .from("candidates")
        .insert({
          selection_id: sel.id,
          full_name: fullName,
          nrp_nip: profile?.nrp_nip ?? null,
          linked_user_id: userId,
          status: "Active",
          registration_notes: "Auto-provisioned untuk akun peserta uji coba",
        })
        .select("id, selection_id, full_name, rank, nrp_nip, test_number, temporary_id, unit_position, pok_korp, panda")
        .single();
      if (insErr) throw new Error(insErr.message);
      cand = created;
    }

    // Ambil exam (trigger create_exam_for_candidate harusnya sudah membuatkannya)
    let { data: exam } = await supabaseAdmin
      .from("exams")
      .select("id, candidate_id, selection_id, exam_status, progress_percentage, hari_h_stage")
      .eq("candidate_id", cand!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!exam) {
      const { data: createdExam, error: examErr } = await supabaseAdmin
        .from("exams")
        .insert({
          candidate_id: cand!.id,
          selection_id: cand!.selection_id,
          exam_status: "In Progress",
          progress_percentage: 0,
        })
        .select("id, candidate_id, selection_id, exam_status, progress_percentage, hari_h_stage")
        .single();
      if (examErr) throw new Error(examErr.message);
      exam = createdExam;
    }

    // Label seleksi (untuk header)
    const { data: selRow } = await supabaseAdmin
      .from("selections")
      .select("name")
      .eq("id", cand!.selection_id)
      .maybeSingle();

    return {
      candidate: cand,
      exam,
      selectionLabel: selRow?.name ?? null,
    };
  });
