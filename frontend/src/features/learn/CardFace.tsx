import { flashcardImageUrl } from "../../lib/flashcardImages";

export default function CardFace({
  text,
  image,
  imageClassName = "max-h-56",
  textClassName = "text-lg text-fg",
}: {
  text: string;
  image?: string | null;
  imageClassName?: string;
  textClassName?: string;
}) {
  const body = text.trim();
  return (
    <>
      {image && (
        <img
          src={flashcardImageUrl(image)}
          alt={body || "Card image"}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`mx-auto block max-w-full rounded-lg object-contain ${imageClassName}`}
        />
      )}
      {body && <div className={`whitespace-pre-wrap break-words ${image ? "mt-3" : ""} ${textClassName}`}>{text}</div>}
    </>
  );
}

export function TileFace({ text, image, textClassName }: { text: string; image: string | null; textClassName: string }) {
  return (
    <>
      {image && (
        <img
          src={flashcardImageUrl(image)}
          alt={text.trim() || "Card image"}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="mt-1 max-h-20 w-full rounded-md object-contain"
        />
      )}
      {text.trim() && (
        <span className={`mt-1 leading-snug text-fg whitespace-pre-wrap break-words ${textClassName}`}>{text}</span>
      )}
    </>
  );
}
