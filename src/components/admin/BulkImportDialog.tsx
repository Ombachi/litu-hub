import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { templateCsv, validateRows, credentialsCsv, type ImportRow } from "@/lib/bulkImport";

type Cred = { name: string; admissionNumber: string; email: string; tempPassword: string; cohort: string };

const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

export default function BulkImportDialog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: Cred[]; failed: { email: string; error: string }[] } | null>(null);

  const valid = rows.filter(r => !r.errors.length);
  const invalid = rows.filter(r => r.errors.length);

  const reset = () => { setRows([]); setFileName(""); setResult(null); };

  const onFile = async (f?: File) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast.error("File is larger than 2 MB");
    const { rows, headerError } = validateRows(await f.text());
    if (headerError) return toast.error(headerError);
    if (rows.length > 500) return toast.error("Import up to 500 students at a time");
    setFileName(f.name); setRows(rows); setResult(null);
  };

  const run = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-onboard-students", {
        body: { rows: valid.map(({ firstName, lastName, admissionNumber, email, parentPhone, cohort }) => ({ firstName, lastName, admissionNumber, email, parentPhone, cohort })) },
      });
      if (error || data?.error) throw new Error(data?.error || "Import isn't available until the database is resumed");
      setResult(data);
      toast.success(`${data.created.length} students added`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><FileSpreadsheet className="mr-2 h-4 w-4" />Bulk import students</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import students</DialogTitle>
          <DialogDescription>Upload a CSV. Each student is placed in their stream and enrolled in that stream's courses.</DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => download("student-import-template.csv", templateCsv())}>
              <Download className="mr-2 h-4 w-4" />Download template
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              <Upload className="mr-2 h-4 w-4" />{fileName || "Choose CSV file"}
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
        )}

        {rows.length > 0 && !result && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15"><CheckCircle2 className="mr-1 h-3 w-3" />{valid.length} ready</Badge>
              <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />{invalid.length} need fixing</Badge>
            </div>
            <div className="max-h-80 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left">
                  <tr><th className="p-2">Row</th><th className="p-2">Name</th><th className="p-2">Adm. No.</th><th className="p-2">Email</th><th className="p-2">Stream</th><th className="p-2">Status</th></tr>
                </thead>
                <tbody>
                  {[...invalid, ...valid].map(r => (
                    <tr key={r.line} className={r.errors.length ? "bg-destructive/5" : ""}>
                      <td className="p-2 text-muted-foreground">{r.line}</td>
                      <td className="p-2">{r.firstName} {r.lastName}</td>
                      <td className="p-2">{r.admissionNumber}</td>
                      <td className="p-2">{r.email}</td>
                      <td className="p-2">{r.cohort}</td>
                      <td className="p-2">{r.errors.length
                        ? <span className="text-destructive text-xs">{r.errors.join("; ")}</span>
                        : <span className="text-primary text-xs">Ready</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={reset}>Start over</Button>
              <Button onClick={run} disabled={!valid.length || busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Import {valid.length} students
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <p className="text-sm">{result.created.length} accounts created and enrolled. {result.failed.length > 0 && `${result.failed.length} could not be created.`}</p>
            {result.failed.length > 0 && (
              <ul className="text-xs text-destructive list-disc pl-5">{result.failed.map(f => <li key={f.email}>{f.email}: {f.error}</li>)}</ul>
            )}
            <p className="text-xs text-muted-foreground">Temporary passwords are shown only once. Download them now and share them privately.</p>
            <Button onClick={() => download("student-login-credentials.csv", credentialsCsv(result.created))} disabled={!result.created.length}>
              <Download className="mr-2 h-4 w-4" />Download login details
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
