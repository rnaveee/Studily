const PHOTO_MAX_EDGE = 1600;
const PHOTO_QUALITY = 0.85;
const IMAGE_NAME = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_NAME.test(file.name);
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decodeBitmap(file: File): Promise<DecodedImage | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    return null;
  }
}

async function decodeElement(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

function encodeJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Photo couldn't be encoded"))),
      "image/jpeg",
      PHOTO_QUALITY,
    );
  });
}

export async function downscalePhoto(file: File): Promise<Blob> {
  const image = (await decodeBitmap(file)) ?? (await decodeElement(file));
  try {
    if (image.width < 1 || image.height < 1) throw new Error("Photo has no pixels");
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas isn't available");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    return await encodeJpeg(canvas);
  } finally {
    image.release();
  }
}
