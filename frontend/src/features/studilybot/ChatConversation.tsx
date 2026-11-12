import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileText, MailWarning, X } from "lucide-react";
import QueryError from "../../components/QueryError";
import { Skeleton } from "../../components/Skeleton";
import { ApiError } from "../../lib/api";
import { formatBytes } from "../../lib/format";
import { toast } from "../../lib/toast";
import Mascot, { useMascotReaction, type MascotState } from "./Mascot";
import ChatThread, { type ThreadAttachment, type ThreadItem } from "./ChatThread";
import Composer from "./Composer";
import CourseSelect from "./CourseSelect";
import FileDropZone from "./FileDropZone";
import { bankApi, botApi, streamAnswer, type BankFile, type BankFileStatus, type BotMessage } from "./api";
import { useBotStatus } from "./useBotStatus";

export const BANK_ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.markdown";

const THINKING = "thinking";
const PENDING = "pending";
const STREAMING = "streaming";

const STATUS_PILL: Record<BankFileStatus, { label: string; className: string }> = {
  QUEUED: { label: "Queued", className: "badge-muted" },
  PROCESSING: { label: "Indexing", className: "badge-accent" },
  READY: { label: "Ready", className: "badge-green" },
  FAILED: { label: "Failed", className: "badge-red" },
};

export const chatKey = (chatId: number) => ["bot", "chat", chatId] as const;

const isIndexing = (file: BankFile) => file.status === "QUEUED" || file.status === "PROCESSING";

export function isUnverifiedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.code === "EMAIL_UNVERIFIED";
}

export function FileStatusBadge({ status }: { status: BankFileStatus }) {
  const pill = STATUS_PILL[status];
  return <span className={`badge ${pill.className}`}>{pill.label}</span>;
}

export function EmailVerifyPrompt() {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-2.5 text-[12.5px] text-fg-2"
      style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
    >
      <MailWarning size={16} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1">Verify your email to add files and ask StudilyBot about them.</span>
      <Link to="/settings" className="btn btn-primary text-xs">
        Verify in Settings
      </Link>
    </div>
  );
}

function failureText(error: { code: string; message: string }): string {
  if (error.code === "BUSY") return "StudilyBot is still working on another answer. Try again in a moment.";
  return error.message || "StudilyBot couldn't answer that. Try again.";
}

function toRow(message: BotMessage): ThreadItem {
  return {
    id: message.id,
    mine: message.role === "USER",
    body: message.content,
    citations: message.citations,
    attachments: message.attachments?.map((file) => ({ key: String(file.fileId), name: file.name })),
  };
}

export function mascotStateFor(s: {
  busy: boolean;
  streaming: boolean;
  failed: boolean;
  reaction: MascotState | null;
}): MascotState {
  if (s.busy) return s.streaming ? "explaining" : "thinking";
  if (s.failed) return "confused";
  return s.reaction ?? "idle";
}

function ThinkingRow({ label = "Thinking…" }: { label?: string }) {
  return (
    <div role="status" aria-label={`StudilyBot: ${label}`} className="chat-in flex items-center gap-2.5">
      <Mascot crop="head" size={30} state="thinking" />
      <span className="text-[13px] text-fg-3">{label}</span>
    </div>
  );
}

function FileChip({ file }: { file: BankFile }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] text-fg-2"
      style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
    >
      <FileText size={12} className="shrink-0 text-fg-3" />
      <span className="min-w-0 truncate" title={file.statusDetail ?? file.name}>
        {file.name}
      </span>
      <FileStatusBadge status={file.status} />
    </span>
  );
}

const BANK_EXTENSIONS = BANK_ACCEPT.split(",").map((ext) => ext.slice(1));
const READY_POLL_MS = 2000;
const READY_WAIT_MS = 90_000;

const extensionOf = (name: string) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();

export function savedFilesMessage(names: string[], where: string | null): string {
  const bank = where ? `${where}'s file bank` : "the file bank";
  if (names.length === 0) return `Saved to ${bank}`;
  if (names.length === 1) return `Saved ${names[0]} to ${bank}`;
  if (names.length <= 3) return `Saved ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} to ${bank}`;
  return `Saved ${names.slice(0, 2).join(", ")} and ${names.length - 2} more files to ${bank}`;
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function waitUntilRead(courseId: number, fileIds: number[]): Promise<BankFile[]> {
  const deadline = Date.now() + READY_WAIT_MS;
  let latest: BankFile[] = [];
  for (;;) {
    const files = await bankApi.courseFiles(courseId);
    latest = files.filter((file) => fileIds.includes(file.id));
    if (latest.length === fileIds.length && !latest.some(isIndexing)) return latest;
    if (Date.now() > deadline) return latest;
    await sleep(READY_POLL_MS);
  }
}

interface Staged {
  id: string;
  file: File;
}

type Phase = "saving" | "reading" | "asking";

interface Turn {
  question: string;
  attachments: ThreadAttachment[];
  phase: Phase;
  reply: string;
  saved: BotMessage | null;
}

interface Failure {
  question: string;
  fileIds: number[];
  attachments: ThreadAttachment[];
  message: string;
}

export interface ChatConversationProps {
  chatId: number;
  compact?: boolean;
  initialQuestion?: string | null;
  onInitialQuestionSent?: () => void;
}

function workingLine(phase: Phase, attachments: ThreadAttachment[]): string {
  const verb = phase === "saving" ? "Saving" : "Reading";
  if (attachments.length === 1) return `${verb} ${attachments[0].name}…`;
  return `${verb} your ${attachments.length} files…`;
}

const pendingFiles = new Map<number, File[]>();

export function useStagedFiles(locked: boolean) {
  const bankStatus = useQuery({ queryKey: ["bank", "status"], queryFn: () => bankApi.status() });
  const [staged, setStaged] = useState<Staged[]>([]);

  function take(files: File[]) {
    if (files.length === 0 || locked) return;
    const limits = bankStatus.data;
    const unreadable = files.find((file) => !BANK_EXTENSIONS.includes(extensionOf(file.name)));
    if (unreadable) {
      toast.error(`${unreadable.name} isn't a type StudilyBot can read. Use PDF, Word, PowerPoint, text or Markdown.`);
      return;
    }
    const tooBig = limits ? files.find((file) => file.size > limits.maxFileBytes) : undefined;
    if (tooBig && limits) {
      toast.error(`${tooBig.name} is larger than ${formatBytes(limits.maxFileBytes)}.`);
      return;
    }
    const max = limits?.maxFilesPerRequest ?? 10;
    const room = Math.max(0, max - staged.length);
    if (files.length > room) toast.error(`Attach up to ${max} files to one message.`);
    const stamp = Date.now();
    setStaged([...staged, ...files.slice(0, room).map((file, i) => ({ id: `${stamp}-${i}`, file }))]);
  }

  return {
    staged,
    files: staged.map((item) => item.file),
    take,
    restore: (files: File[]) => setStaged(files.map((file, i) => ({ id: `${Date.now()}-${i}`, file }))),
    remove: (id: string) => setStaged((current) => current.filter((item) => item.id !== id)),
    clear: () => setStaged([]),
    composerItems: staged.map((item) => ({ id: item.id, name: item.file.name })),
  };
}

export function SaveToCourse({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-2">
      <span>Save to</span>
      <div className="min-w-[180px] flex-1 sm:max-w-xs">
        <CourseSelect hideLabel label="Course to save these files to" allowNone={false} value={value} onChange={onChange} />
      </div>
      <span className="basis-full text-[11px] text-fg-3">This chat will use that course's files from now on.</span>
    </div>
  );
}

export function handOffFiles(chatId: number, files: File[]) {
  if (files.length) pendingFiles.set(chatId, files);
}

export default function ChatConversation({
  chatId,
  compact = false,
  initialQuestion = null,
  onInitialQuestionSent,
}: ChatConversationProps) {
  const qc = useQueryClient();
  const status = useBotStatus();
  const key = chatKey(chatId);
  const chat = useQuery({
    queryKey: key,
    queryFn: () => botApi.chat(chatId),
    refetchInterval: (query) => (query.state.data?.files.some(isIndexing) ? 4000 : false),
  });
  const [turn, setTurn] = useState<Turn | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [reaction, react] = useMascotReaction();
  const sentInitial = useRef(false);
  const attach = useStagedFiles(busy);
  const [pickedCourse, setPickedCourse] = useState<number | null>(null);


  function patchTurn(patch: Partial<Turn>) {
    setTurn((current) => (current ? { ...current, ...patch } : current));
  }

  async function saveFiles(files: File[], attachments: ThreadAttachment[]): Promise<number[] | null> {
    let courseId = chat.data?.courseId ?? null;
    let courseName = chat.data?.courseName ?? null;
    try {
      if (courseId == null) {
        if (pickedCourse == null) throw new Error("Pick a course to save these files to.");
        const moved = await botApi.setCourse(chatId, pickedCourse);
        qc.setQueryData(key, moved);
        void qc.invalidateQueries({ queryKey: ["bot", "chats"] });
        courseId = moved.courseId;
        courseName = moved.courseName;
      }
      const created = await botApi.uploadToChat(chatId, files);
      toast.success(savedFilesMessage(created.map((file) => file.name), courseName));
      if (courseId != null) void qc.invalidateQueries({ queryKey: ["bank", "files", courseId] });
      void qc.invalidateQueries({ queryKey: ["bank", "status"] });
      const ids = created.map((file) => file.id);
      const named = created.map((file, i) => ({ key: String(file.id), name: file.name, note: attachments[i]?.note }));
      if (courseId == null || !created.some(isIndexing)) {
        patchTurn({ attachments: named.map((a) => ({ ...a, note: null })) });
        return ids;
      }
      patchTurn({ phase: "reading", attachments: named.map((a) => ({ ...a, note: "Reading…" })) });
      const read = await waitUntilRead(courseId, ids);
      patchTurn({
        attachments: named.map((a) => {
          const file = read.find((f) => String(f.id) === a.key);
          if (file?.status === "FAILED") return { ...a, note: "Couldn't read this file" };
          if (!file || isIndexing(file)) return { ...a, note: "Still reading" };
          return { ...a, note: null };
        }),
      });
      return ids;
    } catch (error) {
      setTurn(null);
      attach.restore(files);
      if (isUnverifiedError(error)) setNeedsVerify(true);
      else toast.error(error instanceof Error && error.message ? error.message : "Couldn't save those files. Try again.");
      return null;
    }
  }

  async function ask(question: string, options: { files?: File[]; fileIds?: number[]; attachments?: ThreadAttachment[] } = {}) {
    if (busy) return;
    const files = options.files ?? [];
    const attachments =
      options.attachments ?? files.map((file, i) => ({ key: `local-${i}-${file.name}`, name: file.name, note: "Saving…" }));
    setBusy(true);
    setFailure(null);
    setTurn({ question, attachments, phase: files.length ? "saving" : "asking", reply: "", saved: null });
    let fileIds = options.fileIds ?? [];
    if (files.length) {
      const saved = await saveFiles(files, attachments);
      if (saved === null) {
        setBusy(false);
        return;
      }
      fileIds = saved;
    }
    patchTurn({ phase: "asking" });
    const failedWith = (message: string) => ({ question, fileIds, attachments: attachments.map((a) => ({ ...a, note: null })), message });
    let saved = false;
    let failed = false;
    try {
      await streamAnswer(
        chatId,
        question,
        {
          onDelta: (text) => setTurn((current) => (current ? { ...current, reply: current.reply + text } : current)),
          onDone: (message) => {
            saved = true;
            setTurn((current) => (current ? { ...current, saved: message } : current));
          },
          onError: (error) => {
            failed = true;
            setTurn(null);
            if (error.code === "EMAIL_UNVERIFIED") setNeedsVerify(true);
            else setFailure(failedWith(failureText(error)));
          },
        },
        undefined,
        fileIds,
      );
    } catch (error) {
      if (saved) return;
      failed = true;
      setTurn(null);
      setFailure(
        failedWith(error instanceof Error && error.message ? error.message : "StudilyBot couldn't answer that. Try again."),
      );
    } finally {
      if (!saved && !failed) {
        setTurn(null);
        setFailure(failedWith("StudilyBot's answer was cut off. Try again."));
      }
      void qc.invalidateQueries({ queryKey: ["bot", "chats"] });
      await qc.invalidateQueries({ queryKey: key });
      setBusy(false);
      if (saved) react("excited", 2600);
    }
  }

  function send(text: string) {
    const files = attach.files;
    if (files.length && chat.data?.courseId == null && pickedCourse == null) return;
    attach.clear();
    void ask(text, { files });
  }

  useEffect(() => {
    if (sentInitial.current || !chat.data) return;
    const files = pendingFiles.get(chatId) ?? [];
    if (initialQuestion == null && files.length === 0) return;
    sentInitial.current = true;
    pendingFiles.delete(chatId);
    void ask(initialQuestion ?? "", { files });
    onInitialQuestionSent?.();
  }, [initialQuestion, chat.data, onInitialQuestionSent]);

  if (chat.isError) {
    const missing = chat.error instanceof ApiError && chat.error.status === 404;
    return (
      <div className="mx-auto w-full max-w-3xl p-4 md:p-8">
        <QueryError
          onRetry={() => void chat.refetch()}
          message={missing ? "This chat isn't here anymore." : "Couldn't open this chat."}
        />
      </div>
    );
  }

  if (!chat.data) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 p-4 md:p-8">
        <Skeleton height={22} width="40%" />
        <Skeleton height={64} />
      </div>
    );
  }

  const data = chat.data;
  const course = data.courseName ?? null;
  const temporary = data.temporary;
  const botOff = status.data?.enabled === false;
  const paused = status.data?.chatPaused === true;
  const canUpload = !temporary && !botOff;

  const persisted = data.messages;
  const savedId = turn?.saved?.id ?? null;
  const settled = savedId !== null && persisted.some((message) => message.id === savedId);
  const live = turn && !settled ? turn : null;

  const rows: ThreadItem[] = persisted.map(toRow);
  if (live) {
    const last = persisted[persisted.length - 1];
    const echoed =
      live.phase === "asking" &&
      last?.role === "USER" &&
      last.content === live.question &&
      (last.attachments?.length ?? 0) === live.attachments.length;
    if (!echoed) rows.push({ id: PENDING, mine: true, body: live.question, attachments: live.attachments });
    if (live.saved) rows.push(toRow(live.saved));
    else if (live.reply) rows.push({ id: STREAMING, mine: false, body: live.reply });
    else rows.push({ id: THINKING, mine: false, body: "" });
  }

  const thinkingLine =
    live && live.phase !== "asking" && live.attachments.length ? workingLine(live.phase, live.attachments) : "";
  const needsCourse = attach.staged.length > 0 && data.courseId == null;

  return (
    <FileDropZone
      onFiles={attach.take}
      disabled={!canUpload}
      label="Drop to attach"
      className="flex min-h-0 flex-1 flex-col"
    >
      <header
        className={`shrink-0 border-b border-line ${compact ? "px-3 py-2" : "px-3 py-2.5 md:px-8"}`}
        style={{ background: "var(--surface)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-fg-2">
            {course ? (
              <BookOpen size={13} className="shrink-0 text-accent" />
            ) : (
              <FileText size={13} className="shrink-0 text-accent" />
            )}
            <span className="truncate">{course ?? "Files in this chat"}</span>
          </span>
          {temporary && <span className="badge badge-muted">Help chat</span>}
          {data.files.map((file) => (
            <FileChip key={file.id} file={file} />
          ))}
        </div>
      </header>

      <ChatThread
        items={rows}
        mascot={compact ? undefined : mascotStateFor({ busy, streaming: Boolean(live?.reply), failed: failure !== null, reaction })}
        thinking={!compact && busy}
        renderItem={(item) => (item.id === THINKING ? <ThinkingRow label={thinkingLine || undefined} /> : undefined)}
        empty={
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <Mascot state="wave" size={72} shadow className={compact ? "" : "md:hidden"} />
            <p className="max-w-sm text-[13.5px] leading-relaxed text-fg-2">
              {course
                ? `Ask about ${course}. StudilyBot answers from its files and points to the slide or page.`
                : "Ask anything about your coursework. Drop slides or notes here to attach them. They're saved to a course's file bank when you send."}
            </p>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-2 px-3 md:px-6">
        {paused && (
          <p role="status" className="text-[12px] text-fg-3">
            StudilyBot chat is paused right now. Try again later.
          </p>
        )}
        {failure && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] text-fg-2"
            style={{
              background: "color-mix(in srgb, var(--red) 10%, var(--surface))",
              border: "1px solid var(--line)",
            }}
          >
            <span className="min-w-0 flex-1">{failure.message}</span>
            <button
              type="button"
              onClick={() =>
                void ask(failure.question, { fileIds: failure.fileIds, attachments: failure.attachments })
              }
              disabled={busy}
              className="btn btn-ghost text-xs"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => setFailure(null)}
              aria-label="Dismiss"
              className="grid h-7 w-7 place-items-center rounded-md text-fg-3 transition-colors hover:text-fg"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {needsVerify && <EmailVerifyPrompt />}
      </div>

      <Composer
        onSend={send}
        busy={busy}
        disabled={botOff || paused}
        placeholder={temporary ? "Ask a quick question…" : "Ask about your coursework…"}
        accept={BANK_ACCEPT}
        onFiles={canUpload ? attach.take : undefined}
        attachments={attach.composerItems}
        onRemoveAttachment={attach.remove}
        sendDisabled={needsCourse && pickedCourse == null}
        trayFooter={needsCourse ? <SaveToCourse value={pickedCourse} onChange={setPickedCourse} /> : null}
        hint={compact ? null : undefined}
      />
    </FileDropZone>
  );
}
