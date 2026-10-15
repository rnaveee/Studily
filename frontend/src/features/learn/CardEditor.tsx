import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { ApiError } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import { imagesFrom, pastedImages } from "../../lib/clipboardImages";
import {
  FLASHCARD_IMAGE_TYPES,
  MAX_FLASHCARD_IMAGE_BYTES,
  flashcardImageUrl,
  uploadFlashcardImage,
} from "../../lib/flashcardImages";
import { toast } from "../../lib/toast";

export interface CardDraft {
  front: string;
  back: string;
  frontImage: string | null;
  backImage: string | null;
}

export const EMPTY_CARD: CardDraft = { front: "", back: "", frontImage: null, backImage: null };

export function cardIsComplete(c: {
  front: string;
  back: string;
  frontImage?: string | null;
  backImage?: string | null;
}): boolean {
  return (!!c.front.trim() || !!c.frontImage) && (!!c.back.trim() || !!c.backImage);
}

export default function CardEditor({
  value,
  onChange,
  onUploadingChange,
  autoFocus = false,
  footer,
  onSubmit,
}: {
  value: CardDraft;
  onChange: (next: CardDraft) => void;
  onUploadingChange?: (uploading: boolean) => void;
  autoFocus?: boolean;
  footer: ReactNode;
  onSubmit: () => void;
}) {
  const [uploading, setUploading] = useState<{ front: boolean; back: boolean }>({ front: false, back: false });
  const latest = useRef(value);
  latest.current = value;
  const busy = uploading.front || uploading.back;

  useEffect(() => {
    onUploadingChange?.(busy);
  }, [busy, onUploadingChange]);

  function setBusy(side: "front" | "back", value: boolean) {
    setUploading((u) => ({ ...u, [side]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || !cardIsComplete(value)) return;
        onSubmit();
      }}
      className="space-y-3"
    >
      <SideField
        label="Front"
        placeholder="Question or term"
        text={value.front}
        image={value.frontImage}
        uploading={uploading.front}
        autoFocus={autoFocus}
        onText={(front) => onChange({ ...latest.current, front })}
        onImage={(frontImage) => onChange({ ...latest.current, frontImage })}
        onBusy={(busy) => setBusy("front", busy)}
      />
      <SideField
        label="Back"
        placeholder="Answer or definition"
        text={value.back}
        image={value.backImage}
        uploading={uploading.back}
        onText={(back) => onChange({ ...latest.current, back })}
        onImage={(backImage) => onChange({ ...latest.current, backImage })}
        onBusy={(busy) => setBusy("back", busy)}
      />
      {footer}
    </form>
  );
}

export function SideField({
  label,
  placeholder,
  text,
  image,
  uploading,
  autoFocus = false,
  onText,
  onImage,
  onBusy,
}: {
  label: string;
  placeholder: string;
  text: string;
  image: string | null;
  uploading: boolean;
  autoFocus?: boolean;
  onText: (text: string) => void;
  onImage: (key: string | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const requireAuth = useRequireAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX_FLASHCARD_IMAGE_BYTES) {
      toast.error("Images must be smaller than 10MB");
      return;
    }
    onBusy(true);
    try {
      const saved = await uploadFlashcardImage(file);
      onImage(saved.key);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't upload that image");
    } finally {
      onBusy(false);
    }
  }

  function take(files: File[]) {
    const file = files[0];
    if (file) requireAuth(() => upload(file));
  }

  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        setDragging(false);
        const files = imagesFrom(e.dataTransfer);
        if (files.length === 0) return;
        e.preventDefault();
        take(files);
      }}
      className="rounded-lg transition-shadow"
      style={dragging ? { boxShadow: "0 0 0 2px var(--accent)" } : undefined}
    >
      <label className="field-label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          className="input"
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => onText(e.target.value)}
          onPaste={(e) => {
            const files = pastedImages(e);
            if (files.length === 0) return;
            e.preventDefault();
            take(files);
          }}
          placeholder={image ? `${placeholder} (optional)` : placeholder}
        />
        {!image && (
          <button
            type="button"
            onClick={() => requireAuth(() => fileRef.current?.click())}
            disabled={uploading}
            aria-label={`Add an image to the ${label.toLowerCase()}`}
            title="Add an image (or paste one)"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-60"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={FLASHCARD_IMAGE_TYPES}
          className="hidden"
          onChange={(e) => {
            take([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>
      {image && (
        <div className="relative mt-2 inline-block">
          <img
            src={flashcardImageUrl(image)}
            alt={`${label} image`}
            className="block max-h-32 max-w-full rounded-lg border border-line object-contain"
          />
          <button
            type="button"
            onClick={() => onImage(null)}
            aria-label={`Remove the ${label.toLowerCase()} image`}
            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-fg-2 shadow transition-colors hover:text-red"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
