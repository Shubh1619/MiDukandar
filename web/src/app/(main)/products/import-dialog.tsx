"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { apiFetch, apiUploadFile, ApiError } from "@/lib/api";
import { csvToRows, gridToRows, cleanExtractedLine, type ProductImportRow } from "@/lib/product-import";
import type { ProductSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  summary: ProductSummary | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: (result: ImportResult) => void;
}

interface PreviewItem {
  index: number;
  status: "valid" | "duplicate" | "error";
  message?: string;
  name?: string;
}

const statusTone: Record<PreviewItem["status"], string> = {
  valid: "bg-emerald-50 text-emerald-700",
  duplicate: "bg-amber-50 text-amber-700",
  error: "bg-destructive/10 text-destructive",
};

export default function ImportDialog({ open, onOpenChange, onImported }: Props) {
  const [tab, setTab] = useState("csv");
  const [source, setSource] = useState<"csv" | "pdf" | "sheets" | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<ProductImportRow[]>([]);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [mode, setMode] = useState<"skip" | "update">("skip");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    if (!preview) return null;
    return {
      total: preview.length,
      valid: preview.filter((r) => r.status === "valid").length,
      duplicate: preview.filter((r) => r.status === "duplicate").length,
      error: preview.filter((r) => r.status === "error").length,
    };
  }, [preview]);

  const importable =
    counts ? counts.valid + (mode === "update" ? counts.duplicate : 0) : 0;

  const reset = () => {
    setSource(null);
    setFilename(null);
    setRows([]);
    setPreview(null);
    setMode("skip");
    setError(null);
    setUrl("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const runPreview = async (nextRows: ProductImportRow[]) => {
    setBusy("preview");
    setError(null);
    try {
      const res = await apiFetch<{
      counts: { total: number; valid: number; duplicate: number; error: number };
      results: { index: number; status: "valid" | "duplicate" | "error"; message?: string; product: ProductImportRow | null }[];
    }>(
      "/api/products/import/preview",
      { method: "POST", body: { rows: nextRows } },
    );
    setPreview(res.results.map((r) => ({ index: r.index, status: r.status, message: r.message, name: r.product?.name })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not validate the file");
      setPreview(null);
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    if (!rows.length) return;
    setBusy("import");
    setError(null);
    try {
      const res = await apiFetch<{
        imported: number; updated: number; skipped: number; failed: number;
        summary: ProductSummary | null;
        errors: { index: number; message: string }[];
      }>(
        "/api/products/import",
        { method: "POST", body: { rows, mode } },
      );
      const parts: string[] = [];
      if (res.imported) parts.push(`${res.imported} added`);
      if (res.updated) parts.push(`${res.updated} updated`);
      if (res.skipped) parts.push(`${res.skipped} skipped`);
      if (res.failed) parts.push(`${res.failed} failed`);
      toast.success(parts.length ? parts.join(", ") : "Nothing changed");
      if (res.failed && res.errors.length) {
        void Promise.all(res.errors.slice(0, 5).map((e) => toast.warning(`Row ${e.index + 1}: ${e.message}`)));
      }
      const changed = res.imported + res.updated > 0;
      if (changed) {
        onImported({
          imported: res.imported,
          updated: res.updated,
          skipped: res.skipped,
          failed: res.failed,
          summary: res.summary ?? null,
        });
        close();
      } else {
        setError("Nothing was imported. Fix the flagged rows above (they are skipped on import), then try again.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed");
    } finally {
      setBusy(null);
    }
  };

  const onCsvFile = async (file: File) => {
    setBusy("parse");
    setError(null);
    try {
      const text = await file.text();
      const next = csvToRows(text);
      if (!next.length) {
        setError("No product rows found. Check that the file has a product_name column and some data.");
        return;
      }
      setSource("csv");
      setFilename(file.name);
      setRows(next);
      setPreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not parse the CSV file");
    } finally {
      setBusy(null);
    }
  };

  const onPdfFile = async (file: File) => {
    setBusy("parse");
    setError(null);
    try {
      const res = await apiUploadFile<{ lines: string[]; confidence?: string }>("/api/products/import/pdf", file);
      let junk = 0;
      const clean: string[] = [];
      for (const raw of res.lines ?? []) {
        const line = cleanExtractedLine(raw);
        if (line) clean.push(line);
        else junk++;
      }
      if (!clean.length) {
        setError("No readable product data found in this PDF. It may be a scanned/image PDF or a signed/binary file — try exporting a CSV instead.");
        return;
      }
      const next: ProductImportRow[] = [];
      for (const raw of clean) {
        // Convert the extracted text line into a usable product name:
        // strip PDF line-number prefixes ("12)", "3."), stray trailing
        // separators/punctuation, and clamp to the 150-char server contract.
        let name = String(raw ?? "").replace(/\u0000/g, "").trim();
        name = name.replace(/^(\d{1,4})[).][\s-]*/, "").trim();
        name = name.replace(/[\s\-|,;:.\u00b7\u2026]+$/, "").trim().slice(0, 150);
        if (name) next.push({ name });
      }
      if (!next.length) {
        setError("No readable product data found in this PDF. It may be a scanned/image PDF or a signed/binary file — try exporting a CSV instead.");
        return;
      }
      setSource("pdf");
      setFilename(file.name);
      setRows(next);
      setPreview(null);
      if (junk > 0) {
        toast.warning(`${junk} unreadable line${junk === 1 ? "" : "s"} skipped — only clean rows above were kept.`);
      }
      if (res.confidence === "low") {
        toast.warning("Low-confidence extraction — review the rows below before importing.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not extract the PDF");
    } finally {
      setBusy(null);
    }
  };

  const onSheets = async () => {
    if (!url.trim()) return;
    setBusy("sheets");
    setError(null);
    try {
      const res = await apiFetch<{ columns: string[]; rows: string[][] }>(
        "/api/products/import/sheets",
        { method: "POST", body: { url: url.trim() } },
      );
      if (!res.columns || !res.rows.length) {
        setError("The sheet appears empty or has no data rows.");
        return;
      }
      const next = gridToRows(res.columns, res.rows);
      if (!next.length) {
        setError("No product rows recognised. Make sure a product_name column exists.");
        return;
      }
      setSource("sheets");
      setFilename(url.trim());
      setRows(next);
      setPreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the sheet");
    } finally {
      setBusy(null);
    }
  };

  const canPreview = rows.length > 0 && !preview;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="size-4" /> Import products
          </DialogTitle>
          <DialogDescription>
            Batch add or update from CSV, a PDF, or a Google Sheet. Duplicate rows are skipped or updated — never duplicated.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="csv" className="gap-1.5"><FileSpreadsheet className="size-3.5" /> CSV</TabsTrigger>
            <TabsTrigger value="pdf" className="gap-1.5"><FileText className="size-3.5" /> PDF</TabsTrigger>
            <TabsTrigger value="sheets" className="gap-1.5"><Link2 className="size-3.5" /> Google Sheets</TabsTrigger>
          </TabsList>

          <TabsContent value="csv" className="space-y-3 pt-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onCsvFile(f);
              }}
            />
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-4">
              <div className="min-w-0 flex-1 truncate text-sm">
                {source === "csv" && filename ? (
                  <span className="font-medium text-foreground">{filename}</span>
                ) : (
                  <span className="text-muted-foreground">Pick a .csv file with a product_name column.</span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                {busy === "parse" ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {busy === "parse" ? "Parsing…" : "Choose file"}
              </Button>
              {source === "csv" && filename ? (
                <Button variant="ghost" size="sm" onClick={() => reset()}>Clear</Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Supported columns: product_name, category, sku, barcode, unit, purchase_price, selling_price,
              gst_percent, opening_stock, low_stock_threshold, description.
            </p>
          </TabsContent>

          <TabsContent value="pdf" className="space-y-3 pt-3">
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPdfFile(f);
              }}
            />
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-4">
              <div className="min-w-0 flex-1 truncate text-sm">
                {source === "pdf" && filename ? (
                  <span className="font-medium text-foreground">{filename}</span>
                ) : (
                  <span className="text-muted-foreground">Pick a text-based PDF (bill/stock report) to extract rows from.</span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => pdfRef.current?.click()} disabled={busy !== null}>
                {busy === "parse" ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {busy === "parse" ? "Parsing…" : "Choose file"}
              </Button>
              {source === "pdf" && filename ? (
                <Button variant="ghost" size="sm" onClick={() => reset()}>Clear</Button>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="sheets" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="sheet-url">Published Google Sheets URL</Label>
              <Input
                id="sheet-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/<id>/export?format=csv"
              />
              <p className="text-xs text-muted-foreground">
                The sheet must be shared with &quot;Anyone with the link&quot; view access. Paste the spreadsheet URL.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void onSheets()} disabled={busy !== null || !url.trim()}>
              {busy === "sheets" ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Fetch sheet
            </Button>
            {source === "sheets" && filename ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{filename}</span>
                <Button variant="ghost" size="sm" onClick={() => reset()}>Clear</Button>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        ) : null}

        {rows.length ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{rows.length} row{rows.length === 1 ? "" : "s"} parsed</span>
              {counts ? (
                <span className="flex gap-2 text-xs">
                  <span className="text-emerald-600">{counts.valid} new</span>
                  <span className="text-amber-600">{counts.duplicate} dup</span>
                  {counts.error ? <span className="text-destructive">{counts.error} errors</span> : null}
                </span>
              ) : null}
            </div>

            {preview && counts ? (
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60 text-left text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">#</th>
                      <th className="px-2 py-1.5 font-medium">Status</th>
                      <th className="px-2 py-1.5 font-medium">Product / detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.map((r) => (
                      <tr key={r.index}>
                        <td className="px-2 py-1 tabular-nums">{r.index + 1}</td>
                        <td className="px-2 py-1">
                          <span className={`rounded px-1.5 py-0.5 font-medium ${statusTone[r.status]}`}>{r.status}</span>
                        </td>
                        <td className="px-2 py-1">
                          <span className="font-medium">{r.name || "—"}</span>
                          {r.message ? <span className="text-muted-foreground"> · {r.message}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">When a match is found:</span>
              <div className="flex gap-1.5">
                <Button
                  variant={mode === "skip" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("skip")}
                  disabled={busy !== null}
                >
                  Skip
                </Button>
                <Button
                  variant={mode === "update" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("update")}
                  disabled={busy !== null}
                >
                  Update
                </Button>
              </div>
            </div>

            {busy === "preview" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Validating rows against existing products…
              </div>
            ) : null}
            {busy === "import" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Importing products…
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <p className="mr-auto min-w-0 flex-1 text-xs text-muted-foreground">
            Duplicate-safe: products are matched by SKU, barcode or name.
            {preview && importable === 0 ? (
              <span className="mt-1 block text-destructive">
                Nothing to import — all rows are duplicates or have errors. Fix the flagged rows, or switch
                the mode to &quot;Update&quot; to overwrite matches.
              </span>
            ) : null}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            {canPreview ? (
              <Button onClick={() => void runPreview(rows)} disabled={busy !== null}>
                {busy === "preview" ? <Loader2 className="size-4 animate-spin" /> : null}
                Preview
              </Button>
            ) : null}
            {preview ? (
              <Button onClick={() => void runImport()} disabled={busy !== null || importable === 0}>
                {busy === "import" ? <Loader2 className="size-4 animate-spin" /> : null}
                Import{importable > 0 ? ` (${importable})` : ""}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}