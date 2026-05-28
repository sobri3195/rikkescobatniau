import { supabase } from "@/integrations/supabase/client";

export async function logAudit(input: {
  action: string;
  module?: string;
  record_id?: string;
  candidate_id?: string;
  exam_id?: string;
  before?: unknown;
  after?: unknown;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const device_info =
    typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null;
  await supabase.from("audit_logs").insert({
    user_id: u.user.id,
    action: input.action,
    module: input.module ?? null,
    record_id: input.record_id ?? null,
    candidate_id: input.candidate_id ?? null,
    exam_id: input.exam_id ?? null,
    before_data: (input.before as any) ?? null,
    after_data: (input.after as any) ?? null,
    device_info,
  });
}