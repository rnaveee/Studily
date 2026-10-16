import { useState } from "react";
import Lightbox from "../../components/Lightbox";
import { flashcardImageUrl } from "../../lib/flashcardImages";

export default function CardFace({
  text,
  image,
  imageClassName = "max-h-56",
  textClassName = "text-lg text-fg",
  zoomable = false,
}: {
  text: string;
  image?: string | null;
  imageClassName?: string;
  textClassName?: string;
  zoomable?: boolean;
}) {
  const [zoomed, setZoomed] = useState(false);
  const body = text.trim();
  const alt = body || "Card image";
  return (
    <>
      {image && (
        <img
          src={flashcardImageUrl(image)}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onClick={
            zoomable
              ? (e) => {
                  e.stopPropagation();
                  setZoomed(true);
                }
              : undefined
          }
          title={zoomable ? "Tap to enlarge" : undefined}
          className={`mx-auto block max-w-full rounded-lg object-contain ${zoomable ? "cursor-zoom-in" : ""} ${imageClassName}`}
        />
      )}
      {zoomed && image && <Lightbox url={flashcardImageUrl(image)} alt={alt} onClose={() => setZoomed(false)} />}
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
