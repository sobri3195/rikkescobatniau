import { ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save, Send, Lock, Pencil, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SubteamFormShell(props: {
  title: string;
  status: string;
  readOnly?: boolean;
  busy?: boolean;
  onSaveDraft?: () => void;
  onSubmit?: () => void;
  /** When true and status is Submitted/Approved, show "Edit Data" button. */
  canEditAfterSubmit?: boolean;
  /** Called with a reason when the user saves a post-submit revision. */
  onSaveRevision?: (reason: string) => void;
  extraActions?: ReactNode;
  children: ReactNode;
}) {
  const {
    title, status, readOnly, busy, onSaveDraft, onSubmit,
    canEditAfterSubmit, onSaveRevision, extraActions, children,
  } = props;
  const submitted = status === "Submitted" || status === "Approved" || status === "Locked";
  const locked = status === "Locked";
  const [editMode, setEditMode] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const reasonValid = reason.trim().length >= 3;
  const showEditBtn = submitted && !locked && !readOnly && !!canEditAfterSubmit && !!onSaveRevision && !editMode;
  const inRevision = editMode && submitted && !locked;
  const style: Record<string, string> = {
    Draft: "bg-amber-100 text-amber-800 border-amber-200",
    Submitted: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Revision: "bg-orange-100 text-orange-700 border-orange-200",
    Locked: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <Badge className={`${style[status] ?? style.Draft} border rounded-full text-[11px]`}>Status: {status}</Badge>
          {inRevision && (
            <Badge className="bg-sky-100 text-sky-700 border-sky-200 border rounded-full text-[11px]">
              Mode Edit Setelah Submit
            </Badge>
          )}
        </div>
        {!readOnly && !submitted && (
          <div className="flex gap-2">
            {extraActions}
            {onSaveDraft && (
              <Button variant="outline" size="sm" onClick={onSaveDraft} disabled={busy}>
                <Save className="h-4 w-4 mr-1.5" /> Simpan Draft
              </Button>
            )}
            {onSubmit && (
              <Button size="sm" onClick={onSubmit} disabled={busy}>
                <Send className="h-4 w-4 mr-1.5" /> Submit
              </Button>
            )}
          </div>
        )}
        {showEditBtn && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditMode(true)} disabled={busy}>
              <Pencil className="h-4 w-4 mr-1.5" /> Edit Data
            </Button>
          </div>
        )}
        {inRevision && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditMode(false)} disabled={busy}>
              <X className="h-4 w-4 mr-1.5" /> Batal
            </Button>
            <Button size="sm" onClick={() => { setReason(""); setReasonOpen(true); }} disabled={busy}>
              <Save className="h-4 w-4 mr-1.5" /> Simpan Revisi
            </Button>
          </div>
        )}
      </div>
      {locked && (
        <div className="p-3 bg-slate-100 border border-slate-200 rounded-md text-sm text-slate-700 flex items-center gap-2">
          <Lock className="h-4 w-4" /> Section ini terkunci.
        </div>
      )}
      <fieldset disabled={readOnly || (submitted && !inRevision)}>{children}</fieldset>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Revisi Data Submitted</DialogTitle>
            <DialogDescription>
              Tuliskan alasan revisi. Perubahan akan tercatat di audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Alasan revisi (wajib, minimal 3 karakter)</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Misal: koreksi data odontogram gigi #36"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(false)}>Batal</Button>
            <Button
              disabled={!reasonValid || busy}
              onClick={() => {
                if (!reasonValid) return;
                onSaveRevision?.(reason.trim());
                setReasonOpen(false);
                setEditMode(false);
              }}
            >
              Simpan Revisi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const QUALS = ["U-1", "U-2", "U-3", "U-4", "U-5"];
const QUALS_L = ["L-1", "L-2", "L-3", "L-4", "L-5"];

export function QualificationSelect({ value, onChange, type = "U" }: { value?: string | null; onChange: (v: string) => void; type?: "U" | "L" }) {
  const opts = type === "L" ? QUALS_L : QUALS;
  return (
    <select
      className="h-9 px-2 rounded-md border border-input bg-background text-sm"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— Pilih —</option>
      {opts.map((q) => <option key={q} value={q}>{q}</option>)}
    </select>
  );
}