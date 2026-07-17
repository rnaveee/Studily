import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { api } from "../../lib/api";
import { formatBytes } from "../../lib/format";
import { toast } from "../../lib/toast";
import type { Message } from "../../types";

function useAttachmentBlob(m: Message, enabled: boolean) {
  return useQuery({
    queryKey: ["attachment", m.conversationId, m.id],
    queryFn: () => api.getBlob(`/conversations/${m.conversationId}/messages/${m.id}/attachment`),
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

function useObjectUrl(blob: Blob | undefined) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

export default function AttachmentBubble({ message, mine }: { message: Message; mine: boolean }) {
  const attachment = message.attachment!;
  if (attachment.image) return <ImageBubble message={message} />;
  return <DocumentBubble message={message} mine={mine} />;
}

function ImageBubble({ message }: { message: Message }) {
  const attachment = message.attachment!;
  const blob = useAttachmentBlob(message, true);
  const url = useObjectUrl(blob.data);
  const ratio =
    attachment.width && attachment.height ? attachment.width / attachment.height : 4 / 3;

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: "var(--surface-hi)", width: "min(280px, 70vw)" }}
    >
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={attachment.filename}
            className="block h-auto w-full"
            style={{ aspectRatio: ratio, objectFit: "cover" }}
          />
        </a>
      ) : (
        <div className="flex items-center justify-center" style={{ aspectRatio: ratio }}>
          {blob.isError ? (
            <span className="px-3 text-center text-[12px] text-fg-3">Couldn't load image</span>
          ) : (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
          )}
        </div>
      )}
    </div>
  );
}

function DocumentBubble({ message, mine }: { message: Message; mine: boolean }) {
  const attachment = message.attachment!;
  const [fetching, setFetching] = useState(false);

  async function open() {
    if (fetching) return;
    setFetching(true);
    try {
      const blob = await api.getBlob(
        `/conversations/${message.conversationId}/messages/${message.id}/attachment`,
      );
      const url = URL.createObjectURL(
        new Blob([blob], { type: attachment.contentType }),
      );
      if (attachment.contentType === "application/pdf") {
        const win = window.open(url, "_blank");
        if (!win) downloadUrl(url, attachment.filename);
      } else {
        downloadUrl(url, attachment.filename);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Couldn't download the file — please try again.");
    } finally {
      setFetching(false);
    }
  }

  return (
    <button
      onClick={open}
      className={`flex max-w-[260px] items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left ${mine ? "text-accent-fg" : "text-fg"}`}
      style={{ background: mine ? "var(--accent)" : "var(--surface-hi)" }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: mine ? "rgba(255,255,255,0.18)" : "color-mix(in srgb, var(--accent) 12%, transparent)" }}
      >
        {fetching ? (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
        ) : (
          <FileText size={15} className={mine ? "" : "text-accent"} />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{attachment.filename}</span>
        <span className={`block text-[11px] ${mine ? "opacity-75" : "text-fg-3"}`}>
          {formatBytes(attachment.size)}
        </span>
      </span>
    </button>
  );
}

function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
