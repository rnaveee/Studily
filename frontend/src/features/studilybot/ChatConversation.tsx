import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileText, MailWarning, X } from "lucide-react";
import QueryError from "../../components/QueryError";
import { Skeleton } from "../../components/Skeleton";
import { ApiError } from "../../lib/api";
import { toast } from "../../lib/toast";
import Mascot, { useMascotReaction, type MascotState } from "./Mascot";
import ChatThread, { type ThreadItem } from "./ChatThread";
import Composer from "./Composer";
import { botApi, streamAnswer, type BankFile, type BankFileStatus, type BotMessage } from "./api";
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

function ThinkingRow() {
  return (
    <div role="status" aria-label="StudilyBot is thinking" className="chat-in flex items-center gap-2.5">
      <Mascot crop="head" size={30} state="thinking" />
      <span className="text-[13px] text-fg-3">Thinking…</span>
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

interface Turn {
  question: string;
  reply: string;
  saved: BotMessage | null;
}

interface Failure {
  question: string;
  message: string;
}

export interface ChatConversationProps {
  chatId: number;
  compact?: boolean;
  initialQuestion?: string | null;
  onInitialQuestionSent?: () => void;
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

  async function ask(question: string) {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    setTurn({ question, reply: "", saved: null });
    let saved = false;
    let failed = false;
    try {
      await streamAnswer(chatId, question, {
        onDelta: (text) => setTurn((current) => (current ? { ...current, reply: current.reply + text } : current)),
        onDone: (message) => {
          saved = true;
          react("happy");
          setTurn((current) => (current ? { ...current, saved: message } : current));
        },
        onError: (error) => {
          failed = true;
          setTurn(null);
          if (error.code === "EMAIL_UNVERIFIED") setNeedsVerify(true);
          else setFailure({ question, message: failureText(error) });
        },
      });
    } catch (error) {
      failed = true;
      setTurn(null);
      setFailure({
        question,
        message: error instanceof Error && error.message ? error.message : "StudilyBot couldn't answer that. Try again.",
      });
    } finally {
      if (!saved && !failed) {
        setTurn(null);
        setFailure({ question, message: "StudilyBot's answer was cut off. Try again." });
      }
      void qc.invalidateQueries({ queryKey: ["bot", "chats"] });
      await qc.invalidateQueries({ queryKey: key });
      setBusy(false);
    }
  }

  const upload = useMutation({
    mutationFn: (files: File[]) => botApi.uploadToChat(chatId, files),
    onSuccess: (created) => {
      toast.success(created.length === 1 ? "Added 1 file" : `Added ${created.length} files`);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (error) => {
      if (isUnverifiedError(error)) setNeedsVerify(true);
      else toast.error(error instanceof Error && error.message ? error.message : "Couldn't add those files. Try again.");
    },
  });

  useEffect(() => {
    if (!initialQuestion || sentInitial.current || !chat.data) return;
    sentInitial.current = true;
    void ask(initialQuestion);
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
    const echoed = last?.role === "USER" && last.content === live.question;
    if (!echoed) rows.push({ id: PENDING, mine: true, body: live.question });
    if (live.saved) rows.push(toRow(live.saved));
    else if (live.reply) rows.push({ id: STREAMING, mine: false, body: live.reply });
    else rows.push({ id: THINKING, mine: false, body: "" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
        renderItem={(item) => (item.id === THINKING ? <ThinkingRow /> : undefined)}
        empty={
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <Mascot state="wave" size={72} shadow className={compact ? "" : "md:hidden"} />
            <p className="max-w-sm text-[13.5px] leading-relaxed text-fg-2">
              {course
                ? `Ask about ${course}. StudilyBot answers from its files and points to the slide or page.`
                : "Ask anything about your coursework. Attach slides or notes and StudilyBot answers from them."}
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
              onClick={() => void ask(failure.question)}
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
        onSend={(text) => void ask(text)}
        busy={busy}
        disabled={botOff || paused}
        placeholder={temporary ? "Ask a quick question…" : "Ask about your coursework…"}
        accept={BANK_ACCEPT}
        onFiles={canUpload ? (files) => upload.mutate(files) : undefined}
        hint={compact ? null : undefined}
      />
    </div>
  );
}
