import { useId, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2, Upload, X } from "lucide-react";
import QueryError from "../../components/QueryError";
import { Skeleton } from "../../components/Skeleton";
import { api, ApiError } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import {
  parseReport,
  type FeynmanKind,
  type FeynmanMessage,
  type FeynmanReport,
  type FeynmanSession,
  type FeynmanTurn,
} from "../feynman/feynmanApi";
import BotLayout, { BOT_PATHS } from "./BotLayout";
import ChatThread, { type ThreadItem } from "./ChatThread";
import Composer from "./Composer";
import CourseSelect from "./CourseSelect";
import ReportCard from "./ReportCard";
import { BANK_ACCEPT, EmailVerifyPrompt, FileStatusBadge, isUnverifiedError } from "./ChatConversation";
import { bankApi, type BankFile } from "./api";

const MAX_MATERIALS = 3;
const MAX_MESSAGE = 4000;
const LIMIT_NOTICE = `StudilyBot reads up to ${MAX_MATERIALS} materials per session. Remove one to add another.`;

const sessionKey = (sessionId: number) => ["feynman", "session", sessionId] as const;

interface RecallRow extends ThreadItem {
  kind: FeynmanKind;
  report: FeynmanReport | null;
}

function rowFor(message: FeynmanMessage): RecallRow {
  return {
    id: message.id,
    mine: message.role === "USER",
    body: message.body,
    kind: message.kind,
    report: message.kind === "REPORT" ? parseReport(message.body) : null,
  };
}

function errorToast(error: unknown, fallback: string) {
  toast.error(error instanceof Error && error.message ? error.message : fallback);
}

function echoes(messages: FeynmanMessage[], body: string): boolean {
  const last = messages[messages.length - 1];
  return last?.role === "USER" && last.body === body;
}

export default function RecallMode() {
  const { id } = useParams();
  const sessionId = id ? Number(id) : null;
  return (
    <BotLayout mode="RECALL" activeId={sessionId}>
      {sessionId === null ? <NewSession /> : <SessionView key={sessionId} sessionId={sessionId} />}
    </BotLayout>
  );
}

function NewSession() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const focusId = useId();
  const [courseId, setCourseId] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [uploads, setUploads] = useState<File[]>([]);
  const [focus, setFocus] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const materials = picked.length + uploads.length;

  const start = useMutation({
    mutationFn: (args: { courseId: number; bankFileIds: number[]; uploads: File[]; focus: string }) => {
      const form = new FormData();
      form.append("courseId", String(args.courseId));
      args.bankFileIds.forEach((fileId) => form.append("bankFileIds", String(fileId)));
      args.uploads.forEach((file) => form.append("files", file));
      if (args.focus) form.append("focus", args.focus);
      return api.post<FeynmanSession>("/feynman/sessions", form);
    },
    onSuccess: (session) => {
      qc.setQueryData(sessionKey(session.id), session);
      void qc.invalidateQueries({ queryKey: ["bot", "chats"] });
      void qc.invalidateQueries({ queryKey: ["bank", "files"] });
      navigate(`${BOT_PATHS.RECALL}/${session.id}`);
    },
    onError: (error) => {
      if (isUnverifiedError(error)) setNeedsVerify(true);
      else errorToast(error, "Couldn't start that session. Try again.");
    },
  });

  function changeCourse(next: number | null) {
    setCourseId(next);
    setPicked([]);
    setNotice(null);
  }

  function addUploads(list: File[]) {
    const room = MAX_MATERIALS - materials;
    if (room <= 0) {
      setNotice(LIMIT_NOTICE);
      return;
    }
    setNotice(list.length > room ? `Only ${room} more ${room === 1 ? "file fits" : "files fit"} in one session.` : null);
    setUploads((current) => [...current, ...list.slice(0, room)]);
  }

  function submit() {
    if (courseId === null || materials === 0 || start.isPending) return;
    start.mutate({ courseId, bankFileIds: picked, uploads, focus: focus.trim() });
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mx-auto flex w-full max-w-xl flex-col gap-5"
      >
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-fg">Teach it back</h1>
          <p className="text-[13px] leading-relaxed text-fg-3">
            Pick a course and its lecture material. StudilyBot plays the student while you explain, then scores what
            you understood.
          </p>
        </div>

        <CourseSelect value={courseId} onChange={changeCourse} allowNone={false} />

        {courseId !== null && (
          <CourseMaterials
            courseId={courseId}
            picked={picked}
            uploads={uploads}
            onPick={setPicked}
            onUploads={addUploads}
            onRemoveUpload={(index) => setUploads((current) => current.filter((_, i) => i !== index))}
            onLimit={() => setNotice(LIMIT_NOTICE)}
          />
        )}

        <div className="min-w-0">
          <label htmlFor={focusId} className="field-label">
            What to focus on (optional)
          </label>
          <textarea
            id={focusId}
            rows={3}
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="For example: the second half, or why friction slows a rolling ball"
            className="input"
            style={{ minHeight: 84, resize: "vertical" }}
          />
        </div>

        {notice && (
          <p role="alert" className="text-[12px] text-red">
            {notice}
          </p>
        )}
        {courseId !== null && materials === 0 && (
          <p className="text-[12px] text-fg-3">Pick or upload at least one file to start.</p>
        )}
        {needsVerify && <EmailVerifyPrompt />}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={courseId === null || materials === 0 || start.isPending}
        >
          {start.isPending ? "Reading your files…" : "Start session"}
        </button>
      </form>
    </div>
  );
}

function CourseMaterials({
  courseId,
  picked,
  uploads,
  onPick,
  onUploads,
  onRemoveUpload,
  onLimit,
}: {
  courseId: number;
  picked: number[];
  uploads: File[];
  onPick: (ids: number[]) => void;
  onUploads: (files: File[]) => void;
  onRemoveUpload: (index: number) => void;
  onLimit: () => void;
}) {
  const bank = useQuery({ queryKey: ["bank", "status"], queryFn: () => bankApi.status() });
  const bankOn = bank.data?.enabled === true;
  const files = useQuery({
    queryKey: ["bank", "files", courseId],
    queryFn: () => bankApi.courseFiles(courseId),
    enabled: bankOn,
  });
  const materials = picked.length + uploads.length;

  function toggle(file: BankFile) {
    if (picked.includes(file.id)) onPick(picked.filter((id) => id !== file.id));
    else if (materials >= MAX_MATERIALS) onLimit();
    else onPick([...picked, file.id]);
  }

  let body: ReactNode;
  if (bank.isLoading) {
    body = <Skeleton height={56} />;
  } else if (bank.isError) {
    body = <QueryError onRetry={() => void bank.refetch()} message="Couldn't load the file bank." />;
  } else if (!bankOn) {
    body = <p className="text-[13px] text-fg-2">File bank isn't set up yet.</p>;
  } else {
    body = (
      <>
        {files.isLoading ? (
          <Skeleton height={56} />
        ) : files.isError ? (
          isUnverifiedError(files.error) ? (
            <EmailVerifyPrompt />
          ) : (
            <QueryError onRetry={() => void files.refetch()} message="Couldn't load this course's files." />
          )
        ) : (files.data ?? []).length === 0 ? (
          <p className="text-[13px] text-fg-3">No files in this course yet. Upload some below.</p>
        ) : (
          <ul className="space-y-2">
            {(files.data ?? []).map((file) => {
              const checked = picked.includes(file.id);
              return (
                <li key={file.id}>
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{
                      background: checked
                        ? "color-mix(in srgb, var(--accent) 10%, var(--surface-hi))"
                        : "var(--surface-hi)",
                      border: `1px solid ${checked ? "var(--accent)" : "transparent"}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(file)}
                      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />
                    <FileText size={14} className="shrink-0 text-fg-3" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-fg" title={file.name}>
                      {file.name}
                    </span>
                    <FileStatusBadge status={file.status} />
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="btn btn-soft cursor-pointer text-xs">
            <Upload size={13} />
            Upload files
            <input
              type="file"
              multiple
              accept={BANK_ACCEPT}
              className="hidden"
              onChange={(e) => {
                onUploads(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-[11px] text-fg-3">Uploads are saved to this course's files.</span>
        </div>

        {uploads.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {uploads.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="inline-flex max-w-full items-center gap-2 rounded-full py-1 pl-3 pr-1.5 text-[12px] text-fg-2"
                style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
              >
                <span className="min-w-0 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveUpload(index)}
                  aria-label={`Remove ${file.name}`}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-fg-3 transition-colors hover:text-fg"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="field-label">Materials</span>
        <span className="text-[11px] text-fg-3">
          {materials} of {MAX_MATERIALS} chosen
        </span>
      </div>
      {body}
    </div>
  );
}

function SessionView({ sessionId }: { sessionId: number }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [needsVerify, setNeedsVerify] = useState(false);
  const key = sessionKey(sessionId);
  const session = useQuery({
    queryKey: key,
    queryFn: () => api.get<FeynmanSession>(`/feynman/sessions/${sessionId}`),
  });

  function append(turn: FeynmanTurn, sent?: FeynmanMessage) {
    qc.setQueryData<FeynmanSession>(key, (old) => {
      if (!old) return old;
      const echoed = sent !== undefined && echoes(old.messages, sent.body);
      return {
        ...old,
        status: turn.status,
        score: turn.score,
        messages: [...old.messages, ...(sent && !echoed ? [sent] : []), ...turn.messages],
      };
    });
    void qc.invalidateQueries({ queryKey: ["bot", "chats"] });
  }

  function failed(error: unknown, fallback: string) {
    if (isUnverifiedError(error)) setNeedsVerify(true);
    else errorToast(error, fallback);
  }

  const send = useMutation({
    mutationFn: (body: string) => api.post<FeynmanTurn>(`/feynman/sessions/${sessionId}/messages`, { body }),
    onSuccess: (turn, body) =>
      append(turn, { id: -Date.now(), role: "USER", kind: "CHAT", body, createdAt: new Date().toISOString() }),
    onError: (error) => failed(error, "Couldn't send that. Try again."),
  });

  const finish = useMutation({
    mutationFn: () => api.post<FeynmanTurn>(`/feynman/sessions/${sessionId}/finish`),
    onSuccess: (turn) => append(turn),
    onError: (error) => failed(error, "Couldn't write your report. Try again."),
  });

  const addFiles = useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      return api.post<FeynmanSession>(`/feynman/sessions/${sessionId}/documents`, form);
    },
    onSuccess: (updated) => {
      qc.setQueryData(key, updated);
      void qc.invalidateQueries({ queryKey: ["bank", "files"] });
    },
    onError: (error) => failed(error, "Couldn't add those files. Try again."),
  });

  const remove = useMutation({
    mutationFn: () => api.del<void>(`/feynman/sessions/${sessionId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bot", "chats"] });
      navigate(BOT_PATHS.RECALL, { replace: true });
    },
    onError: (error) => errorToast(error, "Couldn't delete that session. Try again."),
  });

  async function confirmRemove() {
    const ok = await confirm({
      title: "Delete this session?",
      message: "This removes the session and its report. Files in the course bank stay.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) remove.mutate();
  }

  if (session.isLoading) {
    return (
      <div className="space-y-3 p-4 md:p-8">
        <Skeleton height={24} width="45%" />
        <Skeleton height={140} />
      </div>
    );
  }

  if (session.isError || !session.data) {
    const missing = session.error instanceof ApiError && session.error.status === 404;
    return (
      <div className="p-4 md:p-8">
        <QueryError
          onRetry={() => void session.refetch()}
          message={missing ? "This session isn't here anymore." : undefined}
        />
      </div>
    );
  }

  const s = session.data;
  const active = s.status === "ACTIVE";
  const busy = send.isPending || finish.isPending;

  const rows: RecallRow[] = s.messages.map(rowFor);
  if (send.isPending && send.variables && !echoes(s.messages, send.variables)) {
    rows.push({ id: "pending", mine: true, body: send.variables, kind: "CHAT", report: null });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 space-y-2 px-3 py-3 md:px-8" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-56">
            <h1 className="truncate text-[15px] font-semibold text-fg">{s.title}</h1>
            <p className="truncate text-[12px] text-fg-3">
              {s.courseName ?? "No course"}
              {s.focus ? ` · Focus: ${s.focus}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {active && (
              <button type="button" onClick={() => finish.mutate()} disabled={busy} className="btn btn-soft text-xs">
                Finish and see my report
              </button>
            )}
            <button
              type="button"
              onClick={() => void confirmRemove()}
              disabled={remove.isPending}
              className="btn btn-ghost text-xs"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        </div>
        <details className="mx-auto w-full max-w-3xl text-[12px] text-fg-2">
          <summary className="cursor-pointer text-fg-3 transition-colors hover:text-fg">
            Materials ({s.documents.length})
          </summary>
          <div className="mt-2 space-y-2">
            {s.documents.length === 0 ? (
              <p className="text-fg-3">No materials yet.</p>
            ) : (
              <ul className="space-y-1">
                {s.documents.map((doc) => (
                  <li key={doc.id} className="truncate">
                    {doc.fileName} · {Math.round(doc.sizeBytes / 1024)} KB
                  </li>
                ))}
              </ul>
            )}
            {active && (
              <label className="btn btn-ghost cursor-pointer text-xs">
                <Upload size={13} />
                Add files
                <input
                  type="file"
                  multiple
                  accept={BANK_ACCEPT}
                  className="hidden"
                  disabled={addFiles.isPending}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []).slice(0, MAX_MATERIALS);
                    e.target.value = "";
                    if (files.length) addFiles.mutate(files);
                  }}
                />
              </label>
            )}
          </div>
        </details>
      </header>

      <ChatThread
        items={rows}
        renderItem={(row) =>
          row.kind === "REPORT" ? (row.report ? <ReportCard report={row.report} /> : null) : undefined
        }
        typing={busy}
        typingLabel={finish.isPending ? "StudilyBot is writing your report" : "StudilyBot is thinking"}
        empty={
          <p className="px-4 py-10 text-center text-[13px] leading-relaxed text-fg-3">
            Explain the first idea from your material in your own words. StudilyBot will ask follow-ups.
          </p>
        }
      />

      {needsVerify && (
        <div className="mx-auto w-full max-w-3xl px-3 pb-2 md:px-6">
          <EmailVerifyPrompt />
        </div>
      )}

      {active ? (
        <Composer
          onSend={(text) => {
            if (text.length > MAX_MESSAGE) {
              toast.error("Keep it under 4,000 characters.");
              return;
            }
            send.mutate(text);
          }}
          busy={busy}
          placeholder="Explain it in your own words…"
          sendLabel="Send explanation"
        />
      ) : (
        <div
          className="shrink-0 px-4 py-4 text-center text-[13px] text-fg-2"
          style={{ borderTop: "1px solid var(--line)", background: "var(--surface)" }}
        >
          Session complete · {s.score ?? 0}%
        </div>
      )}
    </div>
  );
}
