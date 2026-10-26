const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const SLIDE_PATH = /^ppt\/slides\/slide\d+\.xml$/;

async function pptxSlideCount(file: File): Promise<number | null> {
  const tailSize = Math.min(file.size, 65_557);
  const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer());
  let eocd = -1;
  for (let i = tailSize - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const entries = tail.getUint16(eocd + 10, true);
  const size = tail.getUint32(eocd + 12, true);
  const offset = tail.getUint32(eocd + 16, true);
  if (offset === 0xffffffff || offset + size > file.size) return null;
  const dir = new DataView(await file.slice(offset, offset + size).arrayBuffer());
  const decoder = new TextDecoder();
  let slides = 0;
  let at = 0;
  for (let n = 0; n < entries && at + 46 <= dir.byteLength; n++) {
    if (dir.getUint32(at, true) !== CENTRAL_SIGNATURE) return null;
    const nameLength = dir.getUint16(at + 28, true);
    const extraLength = dir.getUint16(at + 30, true);
    const commentLength = dir.getUint16(at + 32, true);
    const name = decoder.decode(new Uint8Array(dir.buffer, dir.byteOffset + at + 46, nameLength));
    if (SLIDE_PATH.test(name)) slides++;
    at += 46 + nameLength + extraLength + commentLength;
  }
  return slides > 0 ? slides : null;
}

async function pdfPageCount(file: File): Promise<number | null> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), stopAtErrors: false });
  try {
    const doc = await task.promise;
    return doc.numPages;
  } finally {
    await task.destroy();
  }
}

export async function countPages(file: File, unit: "page" | "slide"): Promise<number | null> {
  try {
    return unit === "page" ? await pdfPageCount(file) : await pptxSlideCount(file);
  } catch {
    return null;
  }
}
