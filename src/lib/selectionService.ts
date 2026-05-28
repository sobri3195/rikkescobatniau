import {
  createSelectionLocal,
  listActiveSelectionsLocal,
  listSelectionsLocal,
  setDefaultSelectionLocal,
  softDeleteSelectionLocal,
  updateSelectionLocal,
} from "@/lib/services/selectionService";

export type SelectionInput = {
  name: string;
  year_label: string;
  participant_label: string;
  institution_header_line_1?: string;
  institution_header_line_2?: string;
  report_title?: string;
  report_subtitle?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
};

export const isLocalStorageMode = () => true;

export async function listSelections() {
  return listSelectionsLocal();
}

export async function listActiveSelections() {
  return listActiveSelectionsLocal();
}

export async function createSelection(input: SelectionInput) {
  return createSelectionLocal(input);
}

export async function updateSelection(id: string, patch: Partial<SelectionInput> & Record<string, unknown>) {
  return updateSelectionLocal(id, patch);
}

export async function deleteSelection(id: string) {
  return softDeleteSelectionLocal(id);
}

export async function setDefaultSelection(id: string) {
  return setDefaultSelectionLocal(id);
}
