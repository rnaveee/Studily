import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Camera, FileText, Paperclip, Send, X } from "lucide-react";

export interface ComposerAttachment {
  id: string;
  name: string;
  previewUrl?: string | null;
}

const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

export default function Composer({
  onSend,
  busy = false,
  disabled = false,
  placeholder = "Message StudilyBot…",
  accept,
  onFiles,
  onCamera,
  attachments = [],
  onRemoveAttachment,
  hint = "Enter to send · Shift+Enter for a new line",
  sendLabel = "Send message",
  sendDisabled = false,
  trayFooter,
}: {
  onSend: (text: string) => void;
  busy?: boolean;
  disabled?: boolean;
  placeholder?: string;
  accept?: string;
  onFiles?: (files: File[]) => void;
  onCamera?: (file: File) => void;
  attachments?: ComposerAttachment[];
  onRemoveAttachment?: (id: string) => void;
  hint?: ReactNode;
  sendLabel?: string;
  sendDisabled?: boolean;
  trayFooter?: ReactNode;
}) {
  const [text, setText] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const blocked = busy || disabled;
  const canSend = !blocked && !sendDisabled && (text.trim().length > 0 || attachments.length > 0);

  function resize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function submit() {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
    const el = areaRef.current;
    if (el) {
      el.style.height = "auto";
      el.focus();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  function takeFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length && onFiles) onFiles(files);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="relative shrink-0 px-3 pt-2.5 md:px-6 md:pb-4"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--line)",
        paddingBottom: "var(--composer-pb, calc(env(safe-area-inset-bottom, 0px) + 12px))",
      }}
    >
      {attachments.length > 0 && (
        <ul className="mx-auto mb-2 flex max-w-3xl gap-2 overflow-x-auto pb-1 pt-1">
          {attachments.map((item) => (
            <li key={item.id} className="relative shrink-0">
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  className="block h-14 w-14 rounded-xl object-cover"
                  style={{ border: "1px solid var(--line)" }}
                />
              ) : (
                <div
                  className="flex h-14 max-w-[200px] items-center gap-2 rounded-xl px-3"
                  style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
                >
                  <FileText size={14} className="shrink-0 text-accent" />
                  <span className="truncate text-[12px] font-medium text-fg" title={item.name}>
                    {item.name}
                  </span>
                </div>
              )}
              {onRemoveAttachment && (
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => onRemoveAttachment(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-fg"
                  style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
                >
                  <X size={11} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {attachments.length > 0 && trayFooter && <div className="mx-auto mb-2 max-w-3xl">{trayFooter}</div>}

      <div className="mx-auto flex max-w-3xl items-end gap-2">
        {onFiles && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={accept}
              className="hidden"
              onChange={(e) => {
                takeFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => fileRef.current?.click()}
              disabled={blocked}
              aria-label="Attach files"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-50"
            >
              <Paperclip size={17} />
            </button>
          </>
        )}
        {onCamera && (
          <>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onCamera(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => cameraRef.current?.click()}
              disabled={blocked}
              aria-label="Take a photo"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-50"
            >
              <Camera size={17} />
            </button>
          </>
        )}
        <textarea
          ref={areaRef}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          enterKeyHint="send"
          aria-label="Message"
          onChange={(e) => {
            setText(e.target.value);
            resize(e.target);
          }}
          onKeyDown={onKeyDown}
          className="input min-w-0 flex-1"
          style={{
            minHeight: 40,
            maxHeight: 160,
            resize: "none",
            overflowY: "auto",
            lineHeight: 1.45,
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 12,
            paddingRight: 12,
            borderRadius: "var(--radius)",
          }}
        />
        <button
          type="submit"
          onMouseDown={keepFocus}
          disabled={!canSend}
          aria-label={sendLabel}
          className="btn btn-primary shrink-0"
          style={{ height: 40, width: 40, padding: 0, borderRadius: "var(--radius)" }}
        >
          {busy ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent-fg/40 border-t-accent-fg" />
          ) : (
            <Send size={15} />
          )}
        </button>
      </div>

      {hint && (
        <p className="mx-auto mt-1.5 hidden max-w-3xl text-[11px] text-fg-3 md:block">{hint}</p>
      )}
    </form>
  );
}
