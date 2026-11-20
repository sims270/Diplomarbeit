/**
 * Macht im Browser aus dem HTML eines Transportauftrags
 * (lib/transportauftragPdf.ts, lib/ownOrderPdf.ts) eine echte PDF-Datei —
 * zum Speichern in einen Ordner und zum Anhängen an eine Mail. Bisher ging
 * das HTML im Web nur an den Druckdialog, eine Datei entstand dabei nicht.
 *
 * Jede <div class="page"> wird zu einem A4-Blatt. Gezeichnet wird über ein
 * SVG mit <foreignObject>: Der Browser setzt das HTML darin mit seiner
 * eigenen Layout-Engine, also genau so wie im Druckdialog — inklusive der
 * eingebetteten Briefkopf-Schrift. Jede Seite kommt als JPEG in die PDF.
 * Text lässt sich darin nicht markieren; zum Ablegen, Drucken und Mailen
 * reicht das, und das Layout muss nicht ein zweites Mal gebaut werden.
 *
 * Die PDF-Datei schreiben wir selbst (writePdf unten), statt eine
 * Bibliothek wie jspdf zu nehmen: Für "ein Bild pro Seite" sind das wenige
 * Zeilen, und jspdf lässt sich mit dem statischen Web-Build von Expo nicht
 * bauen (Metro zieht beim Vorrendern dessen Node-Fassung).
 *
 * Nur für Web.
 */

// A4 in CSS-Pixeln (96 dpi): 210 mm x 297 mm.
const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;
// A4 in PDF-Punkt (1/72 Zoll).
const PAGE_WIDTH_PT = 595.28;
const PAGE_HEIGHT_PT = 841.89;
// Doppelte Auflösung: scharf beim Drucken, Datei bleibt bei ~1 MB.
const SCALE = 2;
const JPEG_QUALITY = 0.9;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('PDF-Seite konnte nicht gezeichnet werden.'));
    image.src = src;
  });
}

// toDataURL statt toBlob: läuft ohne Rückruf und damit in jedem Browser
// gleich (toBlob blieb in Tests mit mehreren Seiten hängen).
export function canvasToJpeg(canvas: HTMLCanvasElement, quality = JPEG_QUALITY): Uint8Array {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function renderPage(pageXhtml: string, css: string): Promise<Uint8Array> {
  // CDATA, weil das CSS sonst als XML gelesen würde. "]]>" kommt darin nicht vor.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH_PX * SCALE}" height="${PAGE_HEIGHT_PX * SCALE}" viewBox="0 0 ${PAGE_WIDTH_PX} ${PAGE_HEIGHT_PX}">` +
    `<foreignObject x="0" y="0" width="${PAGE_WIDTH_PX}" height="${PAGE_HEIGHT_PX}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${PAGE_WIDTH_PX}px;height:${PAGE_HEIGHT_PX}px;background:#fff;overflow:hidden">` +
    `<style><![CDATA[${css}]]></style>` +
    pageXhtml +
    `</div></foreignObject></svg>`;

  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  // Die eingebettete Schrift ist eine data:-URL im SVG selbst; decode()
  // wartet, bis das Bild vollständig gesetzt ist.
  await image.decode().catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH_PX * SCALE;
  canvas.height = PAGE_HEIGHT_PX * SCALE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PDF-Seite konnte nicht gezeichnet werden.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvasToJpeg(canvas);
}

/**
 * Minimale PDF 1.4: je Seite ein JPEG über die ganze Seite. JPEG darf
 * unverändert hinein (Filter DCTDecode), es braucht also keine Kompression.
 * Aufbau: Objekte hintereinander, am Ende die Tabelle mit ihren
 * Byte-Positionen (xref) — daran findet ein PDF-Programm jedes Objekt.
 *
 * Exportiert, weil der CMR-Scanner (components/CmrScanner.web.tsx) seine
 * entzerrten Seiten genauso als A4-Blätter ablegt. Alle Seiten müssen dafür
 * dieselbe Pixelgröße haben.
 */
export function writePdf(pages: Uint8Array[], widthPx: number, heightPx: number): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string | Uint8Array[]) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body.forEach(push);
    push('\nendobj\n');
  };

  // Objekt 1: Katalog, 2: Seitenliste, dann je Seite: Seite, Inhalt, Bild.
  const pageId = (i: number) => 3 + i * 3;
  const objectCount = 2 + pages.length * 3;

  // Die Binärzeichen in der zweiten Zeile sagen Programmen, dass die Datei
  // Binärdaten enthält (übliche PDF-Konvention).
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(
    2,
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] >>`
  );

  pages.forEach((jpeg, i) => {
    const id = pageId(i);
    const content = `q ${PAGE_WIDTH_PT} 0 0 ${PAGE_HEIGHT_PT} 0 0 cm /Im0 Do Q`;
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH_PT} ${PAGE_HEIGHT_PT}] ` +
        `/Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`
    );
    object(id + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    object(id + 2, [
      encoder.encode(
        `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
      ),
      jpeg,
      encoder.encode('\nendstream'),
    ]);
  });

  const xrefOffset = length;
  push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objectCount; id++) {
    push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export async function htmlToPdfBlob(html: string): Promise<Blob> {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const css = Array.from(parsed.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');
  const pages = Array.from(parsed.querySelectorAll('.page'));
  if (pages.length === 0) throw new Error('Das Dokument hat keine Seiten.');

  const serializer = new XMLSerializer();
  const jpegs: Uint8Array[] = [];
  for (const page of pages) {
    // Jede Seite in einem eigenen <body>: Schrift und Schriftgröße hängen
    // im CSS am body-Selektor, ohne ihn käme die Browser-Standardschrift.
    const body = parsed.createElement('body');
    body.appendChild(page.cloneNode(true));
    jpegs.push(await renderPage(serializer.serializeToString(body), css));
  }

  return writePdf(jpegs, PAGE_WIDTH_PX * SCALE, PAGE_HEIGHT_PX * SCALE);
}
