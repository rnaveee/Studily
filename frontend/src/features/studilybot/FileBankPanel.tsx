import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RotateCw, Trash2, Upload } from "lucide-react";
import QueryError from "../../components/QueryError";
import { Skeleton } from "../../components/Skeleton";
import { ApiError, isGuestMode } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useConfirm } from "../../lib/confirm";
import { formatBytes } from "../../lib/format";
import { toast } from "../../lib/toast";
import { bankApi, type BankFile, type BankFileKind, type BankFileStatus } from "./api";
import { savedFilesMessage } from "./ChatConversation";

const EXTENSIONS = ["pdf", "docx", "pptx", "txt", "md", "markdown"];
const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.markdown";

const KINDS: BankFileKind[] = ["LECTURE", "ASSIGNMENT", "PRACTICE_EXAM", "NOTES", "OTHER"];
const KIND_LABEL: Record<BankFileKind, string> = {
  LECTURE: "Lecture",
  ASSIGNMENT: "Assignment",
  PRACTICE_EXAM: "Practice exam",
  NOTES: "Notes",
  OTHER: "Other",
};

const STATUS_PILL: Record<BankFileStatus, { label: string; className: string }> = {
  QUEUED: { label: "Queued", className: "badge-muted" },
  PROCESSING: { label: "Indexing", className: "badge-accent" },
  READY: { label: "Ready", className: "badge-green" },
  FAILED: { label: "Failed", className: "badge-red" },
};

const filesKey = (courseId: number) => ["bank", "files", courseId];
const statusKey = ["bank", "status"];

const isActive = (file: BankFile) => file.status === "QUEUED" || file.status === "PROCESSING";

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function formatQuota(bytes: number): string {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : formatBytes(bytes);
}

function isUnverified(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.code === "EMAIL_UNVERIFIED";
}

function VerifyPrompt() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--surface-hi)" }}>
      <p className="flex-1 text-[12px] text-fg-2">Verify your email to add course files for StudilyBot.</p>
      <Link to="/settings" className="btn btn-soft text-xs">
        Verify in Settings
      </Link>
    </div>
  );
}

export default function FileBankPanel({ courseId }: { courseId: number }) {
  const { user } = useAuth();
  const guest = isGuestMode();
  const verified = !!user?.emailVerified;
  const qc = useQueryClient();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const dragDepth = useRef(0);

  const status = useQuery({
    queryKey: statusKey,
    queryFn: () => bankApi.status(),
    enabled: !guest && verified,
  });
  const limits = status.data;
  const bankOn = limits?.enabled === true;

  const files = useQuery({
    queryKey: filesKey(courseId),
    queryFn: () => bankApi.courseFiles(courseId),
    enabled: !guest && verified && bankOn,
    refetchInterval: (query) => (query.state.data?.some(isActive) ? 4000 : false),
  });

  const statusUpdatedAt = status.dataUpdatedAt;
  const filesUpdatedAt = files.dataUpdatedAt;
  useEffect(() => {
    if (statusUpdatedAt || filesUpdatedAt) setNeedsVerify(false);
  }, [statusUpdatedAt, filesUpdatedAt]);

  function reportError(error: unknown, fallback: string) {
    if (isUnverified(error)) {
      setNeedsVerify(true);
      return;
    }
    toast.error(error instanceof Error && error.message ? error.message : fallback);
  }

  function replaceFile(updated: BankFile) {
    qc.setQueryData<BankFile[]>(filesKey(courseId), (old) =>
      old?.map((file) => (file.id === updated.id ? updated : file)),
    );
  }

  const upload = useMutation({
    mutationFn: (picked: File[]) => bankApi.upload(courseId, picked),
    onSuccess: (created) => {
      toast.success(savedFilesMessage(created.map((file) => file.name), null));
      qc.invalidateQueries({ queryKey: filesKey(courseId) });
      qc.invalidateQueries({ queryKey: statusKey });
    },
    onError: (error) => reportError(error, "Couldn't upload those files. Try again."),
  });

  const setKind = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: BankFileKind }) => bankApi.setKind(id, kind),
    onSuccess: replaceFile,
    onError: (error) => reportError(error, "Couldn't change that file's kind."),
  });

  const retry = useMutation({
    mutationFn: (id: number) => bankApi.retry(id),
    onSuccess: replaceFile,
    onError: (error) => reportError(error, "Couldn't retry that file."),
  });

  const remove = useMutation({
    mutationFn: (id: number) => bankApi.remove(id),
    onSuccess: (_, id) => {
      qc.setQueryData<BankFile[]>(filesKey(courseId), (old) => old?.filter((file) => file.id !== id));
      qc.invalidateQueries({ queryKey: statusKey });
    },
    onError: (error) => reportError(error, "Couldn't remove that file."),
  });

  async function confirmRemove(file: BankFile) {
    const ok = await confirm({
      title: `Remove ${file.name}?`,
      message: "StudilyBot won't use this file anymore.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) remove.mutate(file.id);
  }

  function addFiles(picked: File[]) {
    if (picked.length === 0 || !limits) return;
    const rejected = picked.find((file) => !EXTENSIONS.includes(extensionOf(file.name)));
    if (rejected) {
      setNotice(`${rejected.name} isn't a type StudilyBot can read. Use PDF, Word, PowerPoint, text or Markdown.`);
      return;
    }
    if (picked.length > limits.maxFilesPerRequest) {
      setNotice(`Add up to ${limits.maxFilesPerRequest} files at a time.`);
      return;
    }
    const tooBig = picked.find((file) => file.size > limits.maxFileBytes);
    if (tooBig) {
      setNotice(`${tooBig.name} is larger than ${formatBytes(limits.maxFileBytes)}.`);
      return;
    }
    if (limits.fileCount + picked.length > limits.maxFiles) {
      setNotice(`Your file bank holds up to ${limits.maxFiles} files. Remove some to add more.`);
      return;
    }
    const total = picked.reduce((sum, file) => sum + file.size, 0);
    if (limits.usedBytes + total > limits.quotaBytes) {
      setNotice("Those files would go over your file bank's storage limit. Remove some and try again.");
      return;
    }
    setNotice(null);
    upload.mutate(picked);
  }

  function onDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(!upload.isPending);
  }

  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (upload.isPending) return;
    addFiles(Array.from(e.dataTransfer.files));
  }

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">File bank</h2>
      {bankOn && limits && (
        <span className="text-[11px] text-fg-3">
          {formatQuota(limits.usedBytes)} of {formatQuota(limits.quotaBytes)} used
        </span>
      )}
    </div>
  );

  let body: ReactNode;
  if (guest) {
    body = (
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[12px] text-fg-2">Sign up free to add your own course files for StudilyBot.</p>
        <Link to="/signup" className="btn btn-soft text-xs">
          Create a free account
        </Link>
      </div>
    );
  } else if (!verified) {
    body = <VerifyPrompt />;
  } else if (status.isLoading) {
    body = <Skeleton height={40} />;
  } else if (status.isError) {
    body = <QueryError onRetry={() => status.refetch()} message="Couldn't load the file bank." />;
  } else if (!bankOn) {
    body = <p className="text-[12px] text-fg-3">File bank isn't set up yet.</p>;
  } else if (needsVerify) {
    body = <VerifyPrompt />;
  } else {
    body = (
      <div className="space-y-2">
        <div
          onDragEnter={onDragEnter}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 transition-colors"
          title={`PDF, Word, PowerPoint, text or Markdown · up to ${formatBytes(limits?.maxFileBytes ?? 0)} each`}
          style={{
            borderColor: dragging ? "var(--accent)" : "var(--line)",
            background: dragging ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
          }}
        >
          <Upload className="shrink-0 text-fg-3" size={14} />
          <p className="min-w-0 flex-1 truncate text-[12px] text-fg-2">Drop slides, notes or past exams</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="btn btn-soft shrink-0 py-1 text-xs"
          >
            {upload.isPending ? "Uploading…" : "Choose files"}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>

        {notice && (
          <p role="alert" className="text-[12px] text-red">
            {notice}
          </p>
        )}

        {files.isLoading ? (
          <Skeleton height={36} />
        ) : files.isError ? (
          isUnverified(files.error) ? (
            <VerifyPrompt />
          ) : (
            <QueryError onRetry={() => files.refetch()} message="Couldn't load this course's files." />
          )
        ) : (files.data ?? []).length === 0 ? (
          <p className="text-[12px] text-fg-3">No files yet. StudilyBot answers from the files you add here.</p>
        ) : (
          <ul className="space-y-1.5">
            {(files.data ?? []).map((file) => {
              const pill = STATUS_PILL[file.status];
              const unit = /\.pptx$/i.test(file.name) ? "slides" : "pages";
              return (
                <li key={file.id} className="rounded-xl px-3 py-1.5" style={{ background: "var(--surface-hi)" }}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <FileText size={13} className="shrink-0 text-fg-3" />
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="truncate text-[12px] font-medium text-fg" title={file.name}>
                        {file.name}
                      </div>
                      <div className="text-[11px] text-fg-3">
                        {formatBytes(file.sizeBytes)}
                        {file.pageCount ? ` · ${file.pageCount} ${unit}` : ""}
                      </div>
                      {file.statusDetail && (
                        <div className={`mt-0.5 text-[11px] ${file.status === "FAILED" ? "text-red" : "text-fg-3"}`}>
                          {file.statusDetail}
                        </div>
                      )}
                    </div>
                    <select
                      aria-label={`Kind of ${file.name}`}
                      className="input"
                      value={file.kind}
                      disabled={setKind.isPending}
                      onChange={(e) => setKind.mutate({ id: file.id, kind: e.target.value as BankFileKind })}
                      style={{ width: "auto", padding: "3px 26px 3px 8px", fontSize: 11 }}
                    >
                      {KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {KIND_LABEL[kind]}
                        </option>
                      ))}
                    </select>
                    <span className={`badge ${pill.className}`}>
                      {file.status === "PROCESSING" && (
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      )}
                      {pill.label}
                    </span>
                    {file.status === "FAILED" && (
                      <button
                        type="button"
                        onClick={() => retry.mutate(file.id)}
                        disabled={retry.isPending}
                        className="btn btn-ghost text-xs"
                      >
                        <RotateCw size={12} />
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => confirmRemove(file)}
                      aria-label={`Remove ${file.name}`}
                      className="shrink-0 rounded-md p-1 text-fg-3 transition-colors hover:text-red"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      {header}
      {body}
    </section>
  );
}
