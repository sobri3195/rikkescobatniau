import { createServerFn } from "@/shims/tanstack-react-start";
import { requireSupabaseAuth } from "@/lib/local-auth-middleware";
import { z } from "zod";
import {
  assertCanViewDashboardProgress,
  getCandidateProgressServer,
  getSelectionParticipantsProgressServer,
  getRolesForUser,
} from "@/lib/dashboard-monitoring.server";

const ProgressFilter = z.enum(["all", "0-25", "26-50", "51-75", "76-99", "100"]);
const SortKey = z.enum(["newest", "oldest", "name_asc", "name_desc", "progress_desc", "progress_asc"]);

export const getSelectionParticipantsProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    selectionId: z.string().uuid(),
    search: z.string().max(120).default(""),
    status: z.string().max(40).default("all"),
    progress: ProgressFilter.default("all"),
    dateFrom: z.string().max(20).optional().nullable(),
    dateTo: z.string().max(20).optional().nullable(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(12).max(60).default(24),
    sort: SortKey.default("newest"),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const roles = await getRolesForUser(context.supabase, context.userId);
    assertCanViewDashboardProgress(roles);
    return getSelectionParticipantsProgressServer(data);
  });

export const getCandidateProgressSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const roles = await getRolesForUser(context.supabase, context.userId);
    assertCanViewDashboardProgress(roles);
    return getCandidateProgressServer(data.candidateId);
  });