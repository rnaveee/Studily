export interface ChatConversationProps {
  chatId: number;
  compact?: boolean;
  initialQuestion?: string | null;
  onInitialQuestionSent?: () => void;
}

export default function ChatConversation({ chatId }: ChatConversationProps) {
  return <div data-chat-id={chatId} />;
}
