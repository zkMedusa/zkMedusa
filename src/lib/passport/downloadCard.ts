import { toPng } from "html-to-image";
import { getPassportDownloadFilename } from "./format";
import type { MedusaPassport } from "./types";

export async function downloadPassportCard(
  element: HTMLElement,
  passport: MedusaPassport,
): Promise<void> {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#000000",
  });

  const link = document.createElement("a");
  link.download = getPassportDownloadFilename(passport);
  link.href = dataUrl;
  link.click();
}
