"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Loader2,
  Lock,
  Plus,
  Printer,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import {
  addLine,
  deleteLine,
  duplicateDocument,
  finalizeDocument,
  getDocument,
  updateDocumentMeta,
  updateLine,
  type LinePayload,
} from "@/lib/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { ApiError, type DiscountType, type DocumentView, type LineView } from "@/lib/api";

interface LineDraft {
  key: string;
  id?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountType: DiscountType;
  discountValue: string;
  taxPercent: string;
}

const EMPTY_DRAFT = (n: number): LineDraft => ({
  key: `new-${n}`,
  description: "",
  quantity: "",
  unitPrice: "",
  discountType: "NONE",
  discountValue: "0",
  taxPercent: "0",
});

function parseDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function StepperNumber({
  value,
  onChange,
  disabled,
  min,
  max,
  step = 1,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
}) {
  const applyStep = (delta: number) => {
    if (disabled) return;
    let next = parseDecimal(value);
    if (next === null) {
      next = delta > 0 ? (min ?? 0) : min ?? 0;
    } else {
      next += delta;
    }
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    onChange(String(next));
  };

  return (
    <div className={`flex items-stretch ${className}`}>
      <button
        type="button"
        tabIndex={-1}
        className="flex w-8 shrink-0 flex-col border border-r-0 border-neutral bg-tertiary/60 text-secondary transition-colors rounded-l-xl hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
        onClick={() => applyStep(step)}
        disabled={disabled}
        aria-label="Increase"
      >
        <span className="grid flex-1 place-items-center">
          <ChevronUp className="h-3 w-3" aria-hidden="true" />
        </span>
        <span className="grid flex-1 place-items-center border-t border-neutral">
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </span>
      </button>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full min-w-0 rounded-r-xl border border-neutral bg-surface px-2 py-2 text-right text-[0.9375rem] outline-none transition-colors focus:border-secondary disabled:opacity-45 [appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none`}
      />
    </div>
  );
}

function toLinePayload(draft: LineDraft): LinePayload {
  const quantity = parseDecimal(draft.quantity);
  const unitPrice = parseDecimal(draft.unitPrice);
  const discountValue = parseDecimal(draft.discountValue);
  const taxPercent = parseDecimal(draft.taxPercent);
  return {
    description: draft.description,
    quantity: quantity ?? 0,
    unitPrice: unitPrice ?? 0,
    discountType: draft.discountType,
    discountValue: discountValue ?? 0,
    taxPercent: taxPercent ?? 0,
  };
}

function toDraft(line: LineView): LineDraft {
  return {
    key: line.id,
    id: line.id,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountType: line.discountType,
    discountValue: line.discountValue,
    taxPercent: line.taxPercent,
  };
}

function BusyIcon({ busy }: { busy: boolean }) {
  if (!busy) return null;
  return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
}

export function DocumentEditor({
  id,
  email,
}: {
  id: string;
  email?: string;
}) {
  const [doc, setDoc] = useState<DocumentView | null>(null);
  const [drafts, setDrafts] = useState<LineDraft[]>([]);
  const [savedLines, setSavedLines] = useState<Record<string, LineView>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingLine, setSavingLine] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [pendingDeleteLine, setPendingDeleteLine] = useState<LineDraft | null>(null);
  const [deletingLine, setDeletingLine] = useState(false);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState({ title: "", customer: "", issueDate: "" });
  const [nextDraft, setNextDraft] = useState(1);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await getDocument(id);
        if (cancelled) return;
        setDoc(res.document);
        setMeta({
          title: res.document.title,
          customer: res.document.customer,
          issueDate: formatDate(res.document.issueDate),
        });
        const lines = res.document.lines ?? [];
        setDrafts(lines.map(toDraft));
        setSavedLines(Object.fromEntries(lines.map((l) => [l.id, l])));
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Failed to load the document.");
          toast("error", err instanceof ApiError ? err.message : "Failed to load the document.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  const finalized = doc?.status === "FINALIZED";

  function applyDocument(updated: DocumentView) {
    setDoc(updated);
  }

  function updateDraft(key: string, patch: Partial<LineDraft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
    setDirtyKeys((prev) => new Set(prev).add(key));
  }

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const check = () => {
      setCanScrollLeft(el.scrollLeft > 8);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [drafts.length]);

  function scrollTableRight() {
    const el = tableScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: Math.max(320, el.clientWidth * 0.6), behavior: "smooth" });
  }

  function scrollTableLeft() {
    const el = tableScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: -Math.max(320, el.clientWidth * 0.6), behavior: "smooth" });
  }

  async function handleSaveMeta(e?: React.FormEvent): Promise<boolean> {
    e?.preventDefault();
    setSavingMeta(true);
    try {
      const payload: { title: string; customer: string; issueDate?: string } = {
        title: meta.title,
        customer: meta.customer,
      };
      if (meta.issueDate) payload.issueDate = meta.issueDate;
      const res = await updateDocumentMeta(id, payload);
      applyDocument(res.document);
      toast("success", "Document details saved.");
      return true;
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Failed to save document details.");
      return false;
    } finally {
      setSavingMeta(false);
    }
  }

  function addNewLine() {
    const key = `new-${nextDraft}`;
    setDrafts((prev) => [...prev, EMPTY_DRAFT(nextDraft)]);
    setDirtyKeys((prev) => new Set(prev).add(key));
    setNextDraft((n) => n + 1);
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function saveLine(draft: LineDraft): Promise<boolean> {
    setSavingLine(draft.key);
    try {
      if (draft.id) {
        const res = await updateLine(id, draft.id, toLinePayload(draft));
        applyDocument(res.document);
        setSavedLines((prev) => ({ ...prev, [draft.id!]: res.line }));
      } else {
        const res = await addLine(id, toLinePayload(draft));
        applyDocument(res.document);
        setSavedLines((prev) => ({ ...prev, [res.line.id]: res.line }));
        setDrafts((prev) =>
          prev.map((d) => (d.key === draft.key ? toDraft(res.line) : d)),
        );
      }
      setDirtyKeys((prev) => {
        const next = new Set(prev);
        next.delete(draft.key);
        return next;
      });
      toast("success", "Line item saved.");
      return true;
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Failed to save the line.");
      return false;
    } finally {
      setSavingLine(null);
    }
  }

  async function handleDeleteLineConfirm() {
    if (!pendingDeleteLine) return;
    const { id: lineId, key } = pendingDeleteLine;
    if (!lineId) {
      removeDraft(key);
      setPendingDeleteLine(null);
      return;
    }
    setDeletingLine(true);
    try {
      const res = await deleteLine(id, lineId);
      applyDocument(res.document);
      removeDraft(key);
      setSavedLines((prev) => {
        const next = { ...prev };
        delete next[lineId];
        return next;
      });
      toast("success", "Line item deleted.");
      setPendingDeleteLine(null);
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Failed to delete the line.");
    } finally {
      setDeletingLine(false);
    }
  }

  async function handleDuplicate() {
    if (duplicating || !doc) return;
    setDuplicating(true);
    try {
      const res = await duplicateDocument(doc.id);
      router.push(`/documents/${res.document.id}`);
      toast("success", "Document duplicated as a draft.");
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Failed to duplicate the document.");
    } finally {
      setDuplicating(false);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      const res = await finalizeDocument(id);
      applyDocument(res.document);
      setShowFinalizeDialog(false);
      toast("success", "Document finalized.");
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Failed to finalize the document.");
    } finally {
      setFinalizing(false);
    }
  }

  if (loadError) {
    return (
      <AppShell email={email}>
        <div className="card px-8 py-16 text-center">
          <h2 className="text-xl font-semibold tracking-[-0.01em]">Couldn’t load this document</h2>
          <p className="mx-auto mt-2 max-w-sm text-[0.9375rem] text-secondary">
            {loadError}
          </p>
          <Link href="/" className="btn btn-text mt-6">
            <ArrowLeft className="h-4 w-4" />
            Back to documents
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!doc) {
    return (
      <AppShell email={email}>
        <div className="flex min-h-[50vh] items-center justify-center gap-3 text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="text-[0.9375rem]">Loading document…</span>
        </div>
      </AppShell>
    );
  }

  const computedLine = (draft: LineDraft): LineView | undefined =>
    draft.id ? savedLines[draft.id] : undefined;

  const hasUnsavedMeta =
    !finalized &&
    (meta.title !== doc.title ||
      meta.customer !== doc.customer ||
      meta.issueDate !== formatDate(doc.issueDate));

  const hasUnsavedChanges = !finalized && (hasUnsavedMeta || drafts.some((d) => dirtyKeys.has(d.key)));

  function openFinalizeDialog() {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
      return;
    }
    setShowFinalizeDialog(true);
  }

  async function handleSaveAllAndFinalize() {
    setSavingAll(true);
    try {
      if (hasUnsavedMeta) {
        const ok = await handleSaveMeta();
        if (!ok) {
          setShowUnsavedDialog(false);
          return;
        }
      }
      const dirtyDrafts = drafts.filter((d) => dirtyKeys.has(d.key));
      for (const d of dirtyDrafts) {
        const ok = await saveLine(d);
        if (!ok) {
          setShowUnsavedDialog(false);
          return;
        }
      }
      setShowUnsavedDialog(false);
      setShowFinalizeDialog(true);
    } catch {
      toast("error", "Failed to save your changes. Please try again.");
      setShowUnsavedDialog(false);
    } finally {
      setSavingAll(false);
    }
  }

  function handleDiscardAndFinalize() {
    setDrafts(Object.values(savedLines).map(toDraft));
    setDirtyKeys(new Set());
    setMeta({
      title: doc!.title,
      customer: doc!.customer,
      issueDate: formatDate(doc!.issueDate),
    });
    setShowUnsavedDialog(false);
    setShowFinalizeDialog(true);
  }

  const totals: { label: string; value: string; strong?: boolean }[] = [
    { label: "Subtotal", value: formatCurrency(doc.subtotal) },
    { label: "Discount", value: formatCurrency(doc.totalDiscount) },
    { label: "Tax", value: formatCurrency(doc.totalTax) },
    { label: "Grand total", value: formatCurrency(doc.grandTotal), strong: true },
  ];

  return (
    <AppShell email={email}>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="btn btn-text px-2">
          <ArrowLeft className="h-4 w-4" />
          Documents
        </Link>
        <div className="flex items-center gap-3">
          <span
            className={`chip ${finalized ? "chip-success" : "chip"}`}
            aria-label={`Status: ${finalized ? "Finalized" : "Draft"}`}
          >
            {finalized ? (
              <Lock className="h-3 w-3" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            )}
            {finalized ? "Finalized — read-only" : "Draft"}
          </span>
          <button
            type="button"
            className="btn btn-text text-[0.9375rem]"
            onClick={() => void handleDuplicate()}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn-text text-[0.9375rem]"
            onClick={() => window.open(`/documents/${doc.id}/print`, "_blank")}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveMeta} className="card p-6 sm:p-8">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)] sm:items-end">
          <div className="row">
            <label htmlFor="title" className="label">
              Title
            </label>
            <input
              id="title"
              className="input"
              value={meta.title}
              disabled={finalized}
              onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
            />
          </div>
          <div className="row">
            <label htmlFor="customer" className="label">
              Customer
            </label>
            <input
              id="customer"
              className="input"
              value={meta.customer}
              disabled={finalized}
              onChange={(e) => setMeta((m) => ({ ...m, customer: e.target.value }))}
            />
          </div>
          <div className="row">
            <label htmlFor="issueDate" className="label">
              Issue date
            </label>
            <div className="relative">
              <CalendarDays
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary"
                aria-hidden="true"
              />
              <input
                id="issueDate"
                type="date"
                className="input pl-9"
                value={meta.issueDate}
                disabled={finalized}
                onChange={(e) => setMeta((m) => ({ ...m, issueDate: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <button
          type="submit"
          className="btn btn-primary mt-7"
          disabled={finalized || savingMeta}
        >
          <BusyIcon busy={savingMeta} />
          {!savingMeta && <Save className="h-4 w-4" aria-hidden="true" />}
          {savingMeta ? "Saving…" : "Save details"}
        </button>
      </form>

      <div className="mt-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.01em]">Line items</h2>
            <p className="mt-1 text-[0.875rem] text-secondary">
              Each row is validated and its totals are computed by the server on save.
            </p>
          </div>
          {!finalized ? (
            <button type="button" className="btn btn-secondary" onClick={addNewLine}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add line
            </button>
          ) : null}
        </div>

        <div className="card relative w-full max-w-full overflow-hidden">
          <div
            ref={tableScrollRef}
            className="max-h-[70vh] max-w-full overflow-x-auto overflow-y-auto overscroll-contain qc-hide-scrollbar"
          >
            <table className="w-full min-w-[1200px] border-collapse">
              <colgroup>
                <col className="w-auto" />
                <col className="w-28" />
                <col className="w-40" />
                <col className="w-72" />
                <col className="w-28" />
                <col className="w-40" />
                <col className="w-24" />
              </colgroup>
              <thead>
                <tr className="sticky top-0 z-10 border-b border-neutral bg-tertiary">
                  <th className="table-head px-5 py-3 text-left">Description</th>
                  <th className="table-head px-3 py-3 text-left">Qty</th>
                  <th className="table-head px-3 py-3 text-left">Unit price</th>
                  <th className="table-head px-3 py-3 text-left">Discount</th>
                  <th className="table-head px-3 py-3 text-left">Tax %</th>
                  <th className="table-head px-5 py-3 text-right">Line total</th>
                  <th className="table-head px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {drafts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <p className="text-base font-medium text-onsurface">No line items yet</p>                      <p className="mt-1 text-[0.875rem] text-secondary">
                        {finalized
                          ? "This document has no lines."
                          : "Add a line to start building your quote."}
                      </p>
                      {!finalized ? (
                        <button
                          type="button"
                          className="btn btn-secondary mt-6"
                          onClick={addNewLine}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Add the first line
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  drafts.map((draft) => {
                    const line = computedLine(draft);
                    const busy = savingLine === draft.key;
                    return (
                      <tr
                        key={draft.key}
                        className={`border-b border-neutral last:border-b-0 ${busy ? "opacity-60" : ""}`}
                      >
                        <td className="px-5 py-3">
                          <input
                            className="input"
                            placeholder="What is this line for?"
                            value={draft.description}
                            disabled={finalized}
                            onChange={(e) =>
                              updateDraft(draft.key, { description: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-3 py-3">
                          <StepperNumber
                            min={1}
                            value={draft.quantity}
                            disabled={finalized}
                            placeholder="1"
                            onChange={(v) =>
                              updateDraft(draft.key, { quantity: v })
                            }
                          />
                        </td>
                        <td className="px-3 py-3">
                          <StepperNumber
                            min={0}
                            value={draft.unitPrice}
                            disabled={finalized}
                            placeholder="0.00"
                            onChange={(v) =>
                              updateDraft(draft.key, { unitPrice: v })
                            }
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1.5">
<select
                              className="input select w-[9.5rem] shrink-0"
                              value={draft.discountType}
                              disabled={finalized}
                              onChange={(e) =>
                                updateDraft(draft.key, {
                                  discountType: e.target.value as DiscountType,
                                })
                              }
                            >
                              <option value="NONE">None</option>
                              <option value="PERCENT">Percent</option>
                              <option value="FIXED">Fixed</option>
                            </select>
                            <StepperNumber
                              min={0}
                              max={draft.discountType === "PERCENT" ? 100 : undefined}
                              value={draft.discountValue}
                              disabled={finalized || draft.discountType === "NONE"}
                              placeholder="0"
                              onChange={(v) =>
                                updateDraft(draft.key, { discountValue: v })
                              }
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <StepperNumber
                            min={0}
                            max={100}
                            value={draft.taxPercent}
                            disabled={finalized}
                            placeholder="0"
                            onChange={(v) =>
                              updateDraft(draft.key, { taxPercent: v })
                            }
                          />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="whitespace-nowrap text-[0.9375rem] font-medium">
                            {line ? formatCurrency(line.lineTotal) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!finalized ? (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="btn btn-text px-3"
                                disabled={busy}
                                onClick={() => void saveLine(draft)}
                              >
                                <BusyIcon busy={busy} />
                                {!busy && <Save className="h-3.5 w-3.5" aria-hidden="true" />}
                                {line?.id || draft.id ? "Save" : "Add"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-text px-2 text-secondary hover:text-primary"
                                disabled={busy}
                                onClick={() => setPendingDeleteLine(draft)}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span className="sr-only">Remove line</span>
                              </button>
                            </div>
                          ) : (
                            <span className="whitespace-nowrap text-[0.875rem] text-secondary">
                              {line ? `${line.quantity} × ${line.unitPrice}` : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {canScrollLeft ? (
            <button
              type="button"
              onClick={scrollTableLeft}
              className="absolute left-4 top-[calc(50%+1.5rem)] z-10 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-white/30 bg-white/20 text-onsurface shadow-lg backdrop-blur-lg transition-all hover:bg-white/35"
              aria-label="Scroll table left"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
          {canScrollRight ? (
            <button
              type="button"
              onClick={scrollTableRight}
              className="absolute right-4 top-[calc(50%+1.5rem)] z-10 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-white/30 bg-white/20 text-onsurface shadow-lg backdrop-blur-lg transition-all hover:bg-white/35"
              aria-label="Scroll table right"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="order-2 lg:order-1">
          {!finalized ? (
            <div className="card p-6 sm:p-8">
              <h2 className="text-lg font-semibold tracking-[-0.01em]">Finalize</h2>              <p className="mt-2 text-[0.875rem] leading-relaxed text-secondary">
                Finalizing locks this document and makes it read-only. The server re-validates
                every line and stores the final totals as an immutable snapshot.
              </p>
              <button
                type="button"
                className="btn btn-primary mt-6"
                onClick={() => openFinalizeDialog()}
                disabled={finalizing}
              >
                <BusyIcon busy={finalizing} />
                {!finalizing && <Lock className="h-4 w-4" aria-hidden="true" />}
                {finalizing ? "Finalizing…" : "Finalize document"}
              </button>
            </div>
          ) : (
            <div className="card border-transparent bg-tertiary/70 p-6 sm:p-8">
              <div className="flex items-center gap-2 text-[0.9375rem] font-medium text-primary">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Finalized
              </div>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-secondary">
                This document is read-only. No changes can be made and the stored totals are
                final.
              </p>
            </div>
          )}
        </div>

        <div className="order-1 lg:order-2">
          <div className="card ml-auto max-w-sm p-6 sm:p-8">
            <h2 className="label mb-5">Summary</h2>
            <dl className="space-y-3 text-[0.9375rem]">
              {totals.map((row) => (
                <div
                  key={row.label}
                  className={`flex items-baseline justify-between gap-6 ${
                    row.strong ? "border-t border-neutral pt-4 text-lg font-semibold" : ""
                  }`}
                >
                  <dt className="text-secondary">{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showFinalizeDialog}
        title="Finalize document?"
        message="Finalizing locks this document and makes it read-only. The server re-validates every line and stores the final totals as an immutable snapshot. This action cannot be undone."
        confirmLabel={finalizing ? "Finalizing…" : "Finalize"}
        busy={finalizing}
        icon={<Lock className="h-5 w-5 text-primary" aria-hidden="true" />}
        onConfirm={() => void handleFinalize()}
        onClose={() => {
          if (!finalizing) setShowFinalizeDialog(false);
        }}
      />

      <ConfirmDialog
        open={pendingDeleteLine !== null}
        title="Delete line item?"
        message={
          <>
            This will permanently remove{" "}
            <span className="font-medium text-onsurface">
              “{pendingDeleteLine?.description || "this line item"}”
            </span>{" "}
            from the document.
          </>
        }
        confirmLabel={deletingLine ? "Deleting…" : "Delete"}
        busy={deletingLine}
        icon={<Trash2 className="h-5 w-5 text-primary" aria-hidden="true" />}
        onConfirm={() => void handleDeleteLineConfirm()}
        onClose={() => {
          if (!deletingLine) setPendingDeleteLine(null);
        }}
      />

      {showUnsavedDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Unsaved changes"
        >
          <div className="card w-full max-w-sm px-6 py-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-tertiary">
              <TriangleAlert className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-onsurface">You have unsaved changes</h2>
            <div className="mt-1 text-[0.875rem] leading-relaxed text-secondary">
              Save your changes so your final totals include them, or discard them before
              finalizing.
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={() => void handleSaveAllAndFinalize()}
                disabled={savingAll}
              >
                {savingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {savingAll ? "Saving…" : "Save & finalize"}
              </button>
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={handleDiscardAndFinalize}
                disabled={savingAll}
              >
                Discard & finalize
              </button>
              <button
                type="button"
                className="btn btn-text w-full"
                onClick={() => setShowUnsavedDialog(false)}
                disabled={savingAll}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}