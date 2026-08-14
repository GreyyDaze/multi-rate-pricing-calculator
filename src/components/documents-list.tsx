"use client";

import Link from "next/link";
import { Copy, FileText, Loader2, Plus, Printer, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { createDocument, deleteDocument, duplicateDocument, listDocuments } from "@/lib/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { ApiError, type DocumentView } from "@/lib/api";

const STATUS_LABEL: Record<DocumentView["status"], string> = {
  DRAFT: "Draft",
  FINALIZED: "Finalized",
};

export function DocumentsList({ email }: { email?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [docs, setDocs] = useState<DocumentView[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DocumentView | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await listDocuments();
        if (!cancelled) setDocs(res.documents);
      } catch (err) {
        if (!cancelled)
          toast(
            "error",
            err instanceof ApiError ? err.message : "Failed to load documents.",
          );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  async function handleNew() {
    setBusy(true);
    try {
      const res = await createDocument({
        title: "Untitled document",
        customer: "New customer",
      });
      router.push(`/documents/${res.document.id}`);
    } catch (err) {
      toast(
        "error",
        err instanceof ApiError ? err.message : "Failed to create a document.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate(doc: DocumentView) {
    setBusy(true);
    try {
      const res = await duplicateDocument(doc.id);
      router.push(`/documents/${res.document.id}`);
      toast("success", "Document duplicated as a draft.");
    } catch (err) {
      toast(
        "error",
        err instanceof ApiError ? err.message : "Failed to duplicate the document.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDocument(pendingDelete.id);
      setDocs((prev) =>
        prev ? prev.filter((d) => d.id !== pendingDelete.id) : prev,
      );
      setPendingDelete(null);
      toast("success", "Document deleted.");
    } catch (err) {
      toast(
        "error",
        err instanceof ApiError
          ? err.message
          : "Failed to delete the document.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const stats = docs
    ? {
        total: docs.length,
        drafts: docs.filter((d) => d.status === "DRAFT").length,
        finalized: docs.filter((d) => d.status === "FINALIZED").length,
      }
    : null;

  const statCards: { label: string; value: string }[] = stats
    ? [
        { label: "Total documents", value: String(stats.total) },
        { label: "Drafts", value: String(stats.drafts) },
        { label: "Finalized", value: String(stats.finalized) },
      ]
    : [];

  return (
    <AppShell email={email}>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] sm:text-2xl">
            Documents
          </h1>
          <p className="mt-2 text-[0.9375rem] text-secondary">
            Draft, edit, duplicate and finalize quotes and invoices with server-computed totals.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary shrink-0"
          onClick={handleNew}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
          {busy ? "Creating…" : "New document"}
        </button>
      </div>

      {docs === null ? (
        <div className="flex min-h-[50vh] items-center justify-center gap-3 text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="text-[0.9375rem]">Loading documents…</span>
        </div>
      ) : (
        <>
          {stats ? (
            <ul className="mb-8 grid grid-cols-3 gap-4">
              {statCards.map((card) => (
                <li key={card.label} className="card px-6 py-5">
                  <p className="text-[0.8125rem] font-medium text-secondary">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-[-0.01em]">
                    {card.value}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          {docs.length === 0 ? (
            <div className="card px-8 py-20 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-tertiary text-primary">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="mt-6 text-xl font-semibold tracking-[-0.01em]">
                No documents yet
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-[0.9375rem] text-secondary">
                Create your first quote or invoice and the server will keep
                every total accurate and final.
              </p>
              <button
                type="button"
                className="btn btn-primary mt-8"
                onClick={handleNew}
                disabled={busy}
              >
                {busy ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                {busy ? "Creating…" : "Create your first document"}
              </button>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-neutral">
              <li className="hidden grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-neutral bg-tertiary/60 px-6 py-3 text-[0.8125rem] font-medium text-secondary sm:grid">
                <span>Document</span>
                <span className="grid w-136 shrink-0 grid-cols-[7rem_6rem_17rem] items-center gap-4">
                  <span className="text-left">Amount</span>
                  <span className="text-center">Status</span>
                  <span className="text-right">Actions</span>
                </span>
              </li>
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="border-b border-neutral last:border-b-0"
                >
                  <Link
                    href={`/documents/${doc.id}`}
                    className="grid grid-cols-1 items-center gap-2 px-6 py-5 transition-colors hover:bg-tertiary/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.9375rem] font-medium">
                        {doc.title}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-secondary">
                        {doc.customer} · {formatDate(doc.issueDate)}
                      </p>
                    </div>
                    <div className="grid w-full shrink-0 grid-cols-[7rem_6rem_17rem] items-center gap-4 sm:w-136">
                      <span className="text-left font-medium">
                        {formatCurrency(doc.grandTotal)}
                      </span>
                      <span className="flex justify-center">
                        <span
                          className={`${doc.status === "FINALIZED" ? "chip chip-success" : "chip"}`}
                        >
                          {STATUS_LABEL[doc.status]}
                        </span>
                      </span>
                      <span className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="btn btn-text px-2 text-[0.875rem] text-secondary hover:text-primary"
                          title="Open printable view"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(`/documents/${doc.id}/print`, "_blank");
                          }}
                        >
                          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                          Print
                        </button>
                        <button
                          type="button"
                          className="btn btn-text px-2 text-[0.875rem] text-secondary hover:text-primary"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleDuplicate(doc);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          Duplicate
                        </button>
                        {doc.status === "DRAFT" ? (
                          <button
                            type="button"
                            className="btn btn-text px-2 text-[0.875rem] text-secondary hover:text-primary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPendingDelete(doc);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Delete
                          </button>
                        ) : null}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete document?"
        message={
          <>
            This will permanently delete{" "}
            <span className="font-medium text-onsurface">
              “{pendingDelete?.title}”
            </span>{" "}
            and all its line items. This action cannot be undone.
          </>
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        busy={deleting}
        icon={
          <TriangleAlert className="h-5 w-5 text-primary" aria-hidden="true" />
        }
        onConfirm={() => void handleDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </AppShell>
  );
}
