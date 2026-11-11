import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Eye, MessageSquare } from "lucide-react";
import QueryError from "../../components/QueryError";
import SegmentedToggle from "../../components/SegmentedToggle";
import { Skeleton } from "../../components/Skeleton";
import { ApiError } from "../../lib/api";
import BotLayout from "./BotLayout";
import BotMascot from "./BotMascot";
import ChatThread from "./ChatThread";
import Composer from "./Composer";
import CourseSelect from "./CourseSelect";
import HelpChatPanel from "./HelpChatPanel";
import ProblemCard, { GradeCard } from "./ProblemCard";
import { botApi, type BotChat, type BotMessage, type BotStatus, type Difficulty } from "./api";
import { downscalePhoto, isImageFile } from "./photo";
import { useBotStatus } from "./useBotStatus";

const PRACTICE_PATH = "/study/studilybot/practice";
const CLASS_HINT = "Questions from your own lectures, assignments and practice exams";
const COURSE_FILES_ERROR = /add some course files/i;

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
  { value: "CLASS", label: "Class-accurate" },
];

const BUSY_LABEL: Record<"next" | "reveal" | "answer", string> = {
  next: "Writing your next problem",
  reveal: "Working out the solution",
  answer: "Checking your work",
};

const WARN_STYLE = {
  background: "color-mix(in srgb, var(--yellow) 12%, var(--surface))",
  border: "1px solid var(--line)",
};

const ERROR_STYLE = {
  background: "color-mix(in srgb, var(--red) 10%, var(--surface))",
  border: "1px solid var(--line)",
};

const BUBBLE_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  boxShadow: "var(--card-shadow)",
};

const keepFocus = (event: MouseEvent) => event.preventDefault();

const chatKey = (id: number) => ["bot", "chat", id] as const;

type Busy = keyof typeof BUSY_LABEL | "ask";

type Notice = { kind: "limit" } | { kind: "files" } | { kind: "error"; text: string };

interface PhotoDraft {
  blob: Blob;
  url: string;
}

interface HelpState {
  chatId: number;
  question: string | null;
  nonce: number;
}

type Row =
  | { kind: "message"; id: number; mine: boolean; body: string; message: BotMessage }
  | { kind: "busy"; id: "busy"; mine: false; body: ""; label: string }
  | { kind: "actions"; id: "actions"; mine: false; body: "" };

function toNotice(error: unknown, fallback: string): Notice {
  if (error instanceof ApiError) {
    if (error.status === 429) return { kind: "limit" };
    if (error.status === 400 && COURSE_FILES_ERROR.test(error.message)) return { kind: "files" };
    if (error.status >= 400 && error.status < 500 && error.message) return { kind: "error", text: error.message };
  }
  return { kind: "error", text: fallback };
}

function practicePaused(status: BotStatus | undefined): boolean {
  return !!status && (!status.enabled || status.practicePaused);
}

function lastProblemIndex(messages: BotMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].kind === "PROBLEM") return index;
  }
  return -1;
}

function Banner({ tone, children }: { tone: "warn" | "error"; children: ReactNode }) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className="rounded-xl px-4 py-2.5 text-[13px] leading-relaxed text-fg-2"
      style={isError ? ERROR_STYLE : WARN_STYLE}
    >
      {children}
    </div>
  );
}

function NoticeBanner({ notice, courseId }: { notice: Notice; courseId: number | null }) {
  if (notice.kind === "limit") {
    return <Banner tone="warn">You're going a little fast. Give it a minute, then try again.</Banner>;
  }
  if (notice.kind === "files") {
    return (
      <Banner tone="warn">
        Add some course files first, then I can write problems from them.{" "}
        {courseId !== null && (
          <Link to={`/courses/${courseId}`} className="font-medium text-accent">
            Open the File bank
          </Link>
        )}
      </Banner>
    );
  }
  return <Banner tone="error">{notice.text}</Banner>;
}

function BusyRow({ label }: { label: string }) {
  return (
    <div role="status" className="chat-in flex items-center gap-3 self-start rounded-2xl px-4 py-2.5" style={BUBBLE_STYLE}>
      <BotMascot size={36} mood="thinking" />
      <span className="text-[13px] text-fg-2">{label}…</span>
    </div>
  );
}

function MissingSession() {
  return (
    <div className="flex min-h-0 flex-1 items-start justify-center p-6">
      <div className="card max-w-md p-6 text-center">
        <p className="text-[14px] text-fg-2">That practice session isn't here anymore.</p>
        <Link to={PRACTICE_PATH} className="btn btn-primary mt-4">
          Start a new session
        </Link>
      </div>
    </div>
  );
}

function SessionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (error instanceof ApiError && error.status === 404) return <MissingSession />;
  return (
    <div className="flex min-h-0 flex-1 items-start justify-center p-6">
      <div className="w-full max-w-md">
        <QueryError onRetry={onRetry} message="Couldn't open this practice session." />
      </div>
    </div>
  );
}

function PracticeSetup() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const status = useBotStatus();
  const topicId = useId();
  const difficultyId = useId();
  const [courseId, setCourseId] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [topic, setTopic] = useState("");
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const paused = practicePaused(status.data);
  const dailyCapReached = status.data?.practiceRemainingToday === 0;
  const locked = paused || dailyCapReached;

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (courseId === null || starting || locked) return;
    setStarting(true);
    setNotice(null);
    try {
      const chat = await botApi.startPractice(courseId, difficulty, topic);
      qc.setQueryData(chatKey(chat.id), chat);
      void qc.invalidateQueries({ queryKey: ["bot", "chats"] });
      navigate(`${PRACTICE_PATH}/${chat.id}`);
    } catch (error) {
      setNotice(toNotice(error, "Couldn't start practice. Try again."));
      setStarting(false);
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-3 py-6 md:px-8 md:py-8">
        <div className="flex items-center gap-4">
          <BotMascot size={64} mood={starting ? "thinking" : "idle"} />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-fg">Practice</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-2">
              Best for practicing calculations like physics or math
            </p>
          </div>
        </div>

        {paused && <Banner tone="warn">Practice is taking a break right now. Try again later.</Banner>}
        {!paused && dailyCapReached && (
          <Banner tone="warn">You've used today's practice problems. Come back tomorrow.</Banner>
        )}

        <form onSubmit={start} className="card space-y-5 p-5 md:p-6">
          <CourseSelect
            value={courseId}
            onChange={setCourseId}
            allowNone={false}
            disabled={starting || paused}
          />

          <div className="space-y-2">
            <span id={difficultyId} className="field-label">
              Difficulty
            </span>
            <div role="group" aria-labelledby={difficultyId}>
              <SegmentedToggle<Difficulty>
                options={DIFFICULTY_OPTIONS}
                value={difficulty}
                onChange={setDifficulty}
                disabled={starting}
              />
            </div>
            <p className="min-h-[18px] text-[12px] text-fg-3">{difficulty === "CLASS" ? CLASS_HINT : ""}</p>
          </div>

          <div>
            <label htmlFor={topicId} className="field-label">
              Topic (optional)
            </label>
            <input
              id={topicId}
              className="input"
              value={topic}
              maxLength={120}
              disabled={starting}
              placeholder="e.g. projectile motion or integration by parts"
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>

          {notice && <NoticeBanner notice={notice} courseId={courseId} />}

          {starting && <BusyRow label="Writing your first problem" />}

          <button
            type="submit"
            onMouseDown={keepFocus}
            disabled={courseId === null || starting || locked}
            className="btn btn-primary w-full"
          >
            {starting ? "Starting…" : "Start practice"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PracticeSession({ chatId }: { chatId: number }) {
  const qc = useQueryClient();
  const status = useBotStatus();
  const chat = useQuery({ queryKey: chatKey(chatId), queryFn: () => botApi.chat(chatId) });
  const [busy, setBusy] = useState<Busy | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [photo, setPhoto] = useState<PhotoDraft | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [helpChatId, setHelpChatId] = useState<number | null>(null);
  const [help, setHelp] = useState<HelpState | null>(null);
  const photoRef = useRef<PhotoDraft | null>(null);
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
      photoRef.current = null;
    };
  }, []);

  const data: BotChat | undefined = chat.data;
  const messages = data?.messages ?? [];
  const paused = practicePaused(status.data);
  const chatPaused = !!status.data && (!status.data.enabled || status.data.chatPaused);
  const dailyCapReached = status.data?.practiceRemainingToday === 0;
  const locked = paused || dailyCapReached || busy !== null;
  const latest = lastProblemIndex(messages);
  const solved =
    latest >= 0 && messages.slice(latest + 1).some((message) => message.kind === "GRADE" && message.grade?.solution != null);

  function replacePhoto(next: PhotoDraft | null) {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
    photoRef.current = next;
    setPhoto(next);
  }

  function appendMessages(incoming: BotMessage[]) {
    qc.setQueryData<BotChat>(chatKey(chatId), (old) => {
      if (!old) return old;
      const known = new Set(old.messages.map((message) => message.id));
      const fresh = incoming.filter((message) => !known.has(message.id));
      return fresh.length ? { ...old, messages: [...old.messages, ...fresh] } : old;
    });
  }

  function refreshChats() {
    void qc.invalidateQueries({ queryKey: ["bot", "chats"] });
  }

  function openHelp(helpChat: number, question: string | null) {
    setHelp((prev) => {
      if (question === null && prev?.chatId === helpChat) return prev;
      return { chatId: helpChat, question, nonce: (prev?.nonce ?? 0) + 1 };
    });
  }

  async function run<T>(kind: Busy, fallback: string, task: () => Promise<T>): Promise<T | null> {
    setBusy(kind);
    setNotice(null);
    try {
      return await task();
    } catch (error) {
      setNotice(toNotice(error, fallback));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function nextProblem() {
    const message = await run("next", "Couldn't write the next problem. Try again.", () => botApi.nextProblem(chatId));
    if (!message) return;
    appendMessages([message]);
    refreshChats();
  }

  async function revealSolution() {
    const message = await run("reveal", "Couldn't get the solution. Try again.", () => botApi.reveal(chatId));
    if (!message) return;
    appendMessages([message]);
    refreshChats();
  }

  async function submitAnswer(text: string) {
    const draft = photoRef.current;
    if (!text && !draft) return;
    if (draft) replacePhoto(null);
    const result = await run("answer", "Couldn't check that answer. Try again.", () =>
      botApi.answer(chatId, text, draft?.blob ?? null),
    );
    if (!result) return;
    appendMessages(result.grade ? [result.userMessage, result.grade] : [result.userMessage]);
    refreshChats();
    if (result.helpChatId !== null) {
      setHelpChatId(result.helpChatId);
      openHelp(result.helpChatId, result.question ?? null);
    }
  }

  async function askStudilyBot() {
    if (helpChatId !== null) {
      openHelp(helpChatId, null);
      return;
    }
    const created = await run("ask", "Couldn't open StudilyBot right now. Try again.", () =>
      botApi.createChat(data?.courseId ?? null, chatId),
    );
    if (!created) return;
    refreshChats();
    setHelpChatId(created.id);
    openHelp(created.id, null);
  }

  async function pickPhoto(file: File) {
    if (!isImageFile(file)) {
      setNotice({ kind: "error", text: "Photos only. Add a JPEG, PNG or WebP image of your working." });
      return;
    }
    setPreparing(true);
    try {
      const blob = await downscalePhoto(file);
      if (alive.current) replacePhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setNotice({ kind: "error", text: "That photo couldn't be read. Try another one." });
    } finally {
      setPreparing(false);
    }
  }

  if (chat.isPending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 md:p-8">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          <Skeleton height={24} width="40%" />
          <Skeleton height={140} />
        </div>
      </div>
    );
  }

  if (chat.isError) {
    return <SessionError error={chat.error} onRetry={() => void chat.refetch()} />;
  }

  const rows: Row[] = messages.map(
    (message): Row => ({
      kind: "message",
      id: message.id,
      mine: message.role === "USER",
      body: message.content,
      message,
    }),
  );
  const busyLabel = busy && busy !== "ask" ? BUSY_LABEL[busy] : null;
  if (busyLabel) rows.push({ kind: "busy", id: "busy", mine: false, body: "", label: busyLabel });
  rows.push({ kind: "actions", id: "actions", mine: false, body: "" });

  function renderRow(row: Row): ReactNode {
    if (row.kind === "busy") return <BusyRow label={row.label} />;
    if (row.kind === "actions") {
      return (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() => void nextProblem()}
            disabled={locked}
            className="btn btn-primary"
          >
            <ArrowRight size={14} />
            Next problem
          </button>
          {latest >= 0 && !solved && (
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => void revealSolution()}
              disabled={locked}
              className="btn btn-ghost"
            >
              <Eye size={14} />
              Show solution
            </button>
          )}
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() => void askStudilyBot()}
            disabled={busy !== null || chatPaused}
            className="btn btn-soft"
          >
            <MessageSquare size={14} />
            Ask StudilyBot
          </button>
        </div>
      );
    }
    const { message } = row;
    if (message.kind === "PROBLEM" && message.problem) return <ProblemCard problem={message.problem} />;
    if (message.kind === "GRADE" && message.grade) return <GradeCard grade={message.grade} />;
    return undefined;
  }

  const lockedMessage = paused
    ? "Practice is taking a break right now. Try again later."
    : dailyCapReached
      ? "You've used today's practice problems. Come back tomorrow."
      : null;

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatThread<Row> items={rows} renderItem={renderRow} />

        {(lockedMessage || notice) && (
          <div className="shrink-0 px-3 pb-2 md:px-8">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
              {lockedMessage && <Banner tone="warn">{lockedMessage}</Banner>}
              {notice && <NoticeBanner notice={notice} courseId={data?.courseId ?? null} />}
            </div>
          </div>
        )}

        <Composer
          onSend={(text) => void submitAnswer(text)}
          busy={busy !== null || preparing}
          disabled={paused || dailyCapReached || latest < 0}
          placeholder="Type your answer, or add a photo of your working…"
          sendLabel="Send answer"
          onCamera={(file) => void pickPhoto(file)}
          attachments={photo ? [{ id: "photo", name: "Photo of your work", previewUrl: photo.url }] : []}
          onRemoveAttachment={() => replacePhoto(null)}
        />
      </section>

      {help && (
        <HelpChatPanel
          chatId={help.chatId}
          question={help.question}
          questionKey={help.nonce}
          onQuestionSent={() => setHelp((prev) => (prev ? { ...prev, question: null } : prev))}
          onClose={() => setHelp(null)}
        />
      )}
    </div>
  );
}

export default function PracticeMode() {
  const { id } = useParams();

  if (id === undefined) {
    return (
      <BotLayout mode="PRACTICE">
        <PracticeSetup />
      </BotLayout>
    );
  }

  const chatId = Number(id);
  if (!Number.isInteger(chatId) || chatId <= 0) {
    return (
      <BotLayout mode="PRACTICE">
        <MissingSession />
      </BotLayout>
    );
  }

  return (
    <BotLayout mode="PRACTICE" activeId={chatId}>
      <PracticeSession key={chatId} chatId={chatId} />
    </BotLayout>
  );
}
