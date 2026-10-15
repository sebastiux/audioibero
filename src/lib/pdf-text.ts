import { extractText, getDocumentProxy } from "unpdf";

export const MAX_PDF_BYTES = 2_000_000;

/** Texto plano de un PDF (todas las páginas, en orden). */
export async function pdfToText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  return text.join("\n");
}
