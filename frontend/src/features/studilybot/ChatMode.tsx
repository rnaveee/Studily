import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "../../lib/toast";
import BotLayout from "./BotLayout";
import Mascot from "./Mascot";
import ChatConversation, {
  CHAT_ACCEPT,
  SaveToCourse,
  chatKey,
  handOffFiles,
  handOffImages,
  isImageAttachment,
  splitDrop,
  useStagedFiles,
  useStagedImages,
  type StagedImage,
} from "./ChatConversation";
import FileDropZone from "./FileDropZone";
import Composer from "./Composer";
import CourseSelect from "./CourseSelect";
import { botApi } from "./api";
import { useBotStatus } from "./useBotStatus";

function readInitialQuestion(state: unknown): string | null {
  if (state && typeof state === "object" && "initialQuestion" in state && typeof state.initialQuestion === "string") {
    return state.initialQuestion;
  }
  return null;
}

function readCourseId(state: unknown): number | null {
  if (state && typeof state === "object" && "courseId" in state && typeof state.courseId === "number") {
    return state.courseId;
  }
  return null;
}

export default function ChatMode() {
  const { id } = useParams();
  const chatId = id ? Number(id) : null;
  const location = useLocation();
  const navigate = useNavigate();
  const [draftCourse, setDraftCourse] = useState<number | null>(() => readCourseId(location.state));
  const open = useQuery({
    queryKey: chatKey(chatId ?? 0),
    queryFn: () => botApi.chat(chatId as number),
    enabled: chatId !== null,
  });

  useEffect(() => {
    if (chatId === null) setDraftCourse(readCourseId(location.state));
  }, [chatId, location.key]);

  const shown = chatId === null ? draftCourse : (open.data?.courseId ?? null);

  function pickCourse(next: number | null) {
    if (chatId === null) {
      setDraftCourse(next);
    } else if (next !== shown) {
      navigate("/study/studilybot/chat", { state: { courseId: next } });
    }
  }

  return (
    <BotLayout
      mode="CHAT"
      activeId={chatId}
      toolbar={
        <CourseSelect
          hideLabel
          value={shown}
          onChange={pickCourse}
          disabled={chatId !== null && !open.data}
          noneLabel="No course — just this chat"
        />
      }
    >
      {chatId === null ? (
        <NewChat courseId={draftCourse} onCourse={setDraftCourse} />
      ) : (
        <OpenChat key={chatId} chatId={chatId} />
      )}
    </BotLayout>
  );
}

function NewChat({ courseId, onCourse }: { courseId: number | null; onCourse: (id: number | null) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const status = useBotStatus();
  const botOff = status.data?.enabled === false;
  const create = useMutation({
    mutationFn: ({ course }: { course: number | null; text: string; files: File[]; images: StagedImage[] }) =>
      botApi.createChat(course),
    onSuccess: (chat, { text, files, images }) => {
      qc.setQueryData(chatKey(chat.id), chat);
      handOffFiles(chat.id, files);
      handOffImages(chat.id, images);
      void qc.invalidateQueries({ queryKey: ["bot", "chats"] });
      navigate(`/study/studilybot/chat/${chat.id}`, { state: { initialQuestion: text } });
    },
    onError: (error, { files, images }) => {
      attach.restore(files);
      pics.restore(images);
      toast.error(error instanceof Error && error.message ? error.message : "Couldn't start that chat. Try again.");
    },
  });
  const attach = useStagedFiles(create.isPending);
  const pics = useStagedImages(create.isPending);
  const needsCourse = attach.staged.length > 0 && courseId == null;

  function send(text: string) {
    if (needsCourse) return;
    const files = attach.files;
    const images = pics.images;
    attach.clear();
    pics.clear();
    create.mutate({ course: courseId, text, files, images });
  }

  const takeDropped = (files: File[]) => splitDrop(files, (images) => void pics.take(images), attach.take);

  return (
    <FileDropZone
      onFiles={takeDropped}
      disabled={botOff}
      label="Drop to attach"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-8 text-center">
        <Mascot state="wave" size={88} shadow />
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-fg">What are you working on?</h1>
          <p className="mx-auto max-w-md text-[13px] leading-relaxed text-fg-3">
            Pick a course at the top to answer from its files, or just ask. Drop slides or notes here to attach them.
            Answers point back to the slide or page they came from.
          </p>
        </div>
      </div>
      <Composer
        onSend={send}
        busy={create.isPending}
        disabled={botOff}
        placeholder="Ask StudilyBot anything…"
        accept={CHAT_ACCEPT}
        onFiles={botOff ? undefined : takeDropped}
        onCamera={botOff ? undefined : (file) => void pics.take([file])}
        onPasteImages={(files) => void pics.take(files)}
        attachments={[...pics.composerItems, ...attach.composerItems]}
        onRemoveAttachment={(id) => (isImageAttachment(id) ? pics.remove(id) : attach.remove(id))}
        sendDisabled={needsCourse}
        trayFooter={needsCourse ? <SaveToCourse value={courseId} onChange={onCourse} /> : null}
      />
    </FileDropZone>
  );
}

function OpenChat({ chatId }: { chatId: number }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <ChatConversation
      chatId={chatId}
      initialQuestion={readInitialQuestion(location.state)}
      onInitialQuestionSent={() => navigate(location.pathname, { replace: true, state: null })}
    />
  );
}
