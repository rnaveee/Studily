import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "../../lib/toast";
import BotLayout from "./BotLayout";
import BotMascot from "./BotMascot";
import ChatConversation, { chatKey } from "./ChatConversation";
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

export default function ChatMode() {
  const { id } = useParams();
  const chatId = id ? Number(id) : null;
  return (
    <BotLayout mode="CHAT" activeId={chatId}>
      {chatId === null ? <NewChat /> : <OpenChat key={chatId} chatId={chatId} />}
    </BotLayout>
  );
}

function NewChat() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const status = useBotStatus();
  const [courseId, setCourseId] = useState<number | null>(null);
  const create = useMutation({
    mutationFn: ({ course }: { course: number | null; text: string }) => botApi.createChat(course),
    onSuccess: (chat, { text }) => {
      qc.setQueryData(chatKey(chat.id), chat);
      void qc.invalidateQueries({ queryKey: ["bot", "chats"] });
      navigate(`/study/studilybot/chat/${chat.id}`, { state: { initialQuestion: text } });
    },
    onError: (error) =>
      toast.error(error instanceof Error && error.message ? error.message : "Couldn't start that chat. Try again."),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-8 text-center">
        <BotMascot size={96} />
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-fg">What are you working on?</h1>
          <p className="mx-auto max-w-md text-[13px] leading-relaxed text-fg-3">
            Pick a course to answer from its files, or just ask. Answers point back to the slide or page they came
            from.
          </p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-md px-3 pb-2 md:px-6">
        <CourseSelect value={courseId} onChange={setCourseId} noneLabel="No course — just this chat" />
      </div>
      <Composer
        onSend={(text) => create.mutate({ course: courseId, text })}
        busy={create.isPending}
        disabled={status.data?.enabled === false}
        placeholder="Ask StudilyBot anything…"
      />
    </div>
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
