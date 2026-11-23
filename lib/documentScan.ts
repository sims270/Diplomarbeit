/**
 * Bildverarbeitung für den CMR-Scanner (components/CmrScanner.web.tsx):
 * Blatt im Foto finden, gerade ziehen, nach Scan aussehen lassen.
 *
 * Bewusst ohne OpenCV.js: Das wären rund 10 MB, ein weiterer Host in der
 * CSP (vercel.json) und 'wasm-unsafe-eval'. Für "helles Blatt auf
 * dunklerem Untergrund" reicht ein Schwellwert mit größter heller Fläche;
 * liegt die Erkennung daneben, schiebt der Fahrer die Ecken von Hand.
 *
 * Nur für Web, und nur aus Event-Handlern aufrufen — beim statischen
 * Vorrendern gibt es weder document noch Image.
 */

export interface Point {
  x: number;
  y: number;
}

/** Ecken im Uhrzeigersinn: oben links, oben rechts, unten rechts, unten links. */
export type Quad = [Point, Point, Point, Point];

/** A4 hochkant bei 150 dpi — gut lesbar, eine Seite bleibt unter ~400 KB. */
export const SCAN_WIDTH_PX = 1240;
export const SCAN_HEIGHT_PX = 1754;

// Fürs Geradeziehen möglichst viel Auflösung behalten: Das Blatt nimmt
// im Foto meist nur einen Teil ein und muss trotzdem 1754 px hoch werden.
// Über ~3200 px wird es am Handy speicherhungrig (iOS begrenzt die
// Canvas-Fläche auf rund 16 MP).
const MAX_SOURCE_SIDE = 3200;
/** Größe der Vorschau zum Eckenziehen — reicht auch für die Lupe. */
export const PREVIEW_MAX_SIDE = 1600;
// Für die Erkennung genügt ein kleines Bild, die Ecken werden hochgerechnet.
const DETECT_SIDE = 600;

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('canvas');
  return context;
}

/**
 * Foto laden und verkleinert auf ein Canvas zeichnen. Die EXIF-Drehung
 * wenden aktuelle Browser beim Zeichnen selbst an (image-orientation:
 * from-image ist Standard), ein Hochkant-Foto steht also richtig herum.
 */
export async function loadScaledImage(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image'));
      img.src = url;
    });
    const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = createCanvas(
      Math.max(1, Math.round(image.naturalWidth * scale)),
      Math.max(1, Math.round(image.naturalHeight * scale))
    );
    context2d(canvas).drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Verkleinerte Kopie (oder das Canvas selbst, wenn es schon klein genug ist). */
export function scaledCopy(source: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  if (scale === 1) return source;
  const canvas = createCanvas(
    Math.max(1, Math.round(source.width * scale)),
    Math.max(1, Math.round(source.height * scale))
  );
  context2d(canvas).drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Standard-Viereck mit etwas Abstand zum Rand, wenn nichts erkannt wird. */
export function defaultQuad(width: number, height: number): Quad {
  const dx = width * 0.06;
  const dy = height * 0.06;
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ];
}

// Otsu: der Schwellwert, der Hell und Dunkel im Histogramm am saubersten trennt.
function otsuThreshold(gray: Uint8ClampedArray): number {
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) histogram[gray[i]]++;

  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i];

  let sumBack = 0;
  let weightBack = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    weightBack += histogram[t];
    if (weightBack === 0) continue;
    const weightFore = gray.length - weightBack;
    if (weightFore === 0) break;
    sumBack += t * histogram[t];
    const meanBack = sumBack / weightBack;
    const meanFore = (sumAll - sumBack) / weightFore;
    const between = weightBack * weightFore * (meanBack - meanFore) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

// Einfacher Kastenfilter (horizontal, dann vertikal) gegen Rauschen und
// Schrift: Das Blatt soll als eine geschlossene helle Fläche erscheinen.
function boxBlur(src: Uint8ClampedArray, width: number, height: number, radius: number) {
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= width) continue;
        sum += src[y * width + xx];
        count++;
      }
      tmp[y * width + x] = sum / count;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= height) continue;
        sum += tmp[yy * width + x];
        count++;
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

interface Line {
  px: number;
  py: number;
  dx: number;
  dy: number;
}

// Gerade durch eine Punktwolke (kleinste Abstandsquadrate senkrecht zur
// Geraden): Richtung ist die Hauptachse der Kovarianz.
function fitLine(xs: number[], ys: number[], indices: number[]): Line | null {
  if (indices.length < 8) return null;
  let mx = 0;
  let my = 0;
  for (const i of indices) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= indices.length;
  my /= indices.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const i of indices) {
    const ex = xs[i] - mx;
    const ey = ys[i] - my;
    sxx += ex * ex;
    sxy += ex * ey;
    syy += ey * ey;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { px: mx, py: my, dx: Math.cos(angle), dy: Math.sin(angle) };
}

function intersect(a: Line, b: Line): Point | null {
  const denominator = a.dx * b.dy - a.dy * b.dx;
  // Fast parallele Seiten (unter ~20°) ergeben keine brauchbare Ecke.
  if (Math.abs(denominator) < 0.34) return null;
  const s = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / denominator;
  return { x: a.px + s * a.dx, y: a.py + s * a.dy };
}

function quadArea(quad: Quad): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const p = quad[i];
    const q = quad[(i + 1) % 4];
    sum += p.x * q.y - q.x * p.y;
  }
  return sum / 2;
}

function isConvex(quad: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const c = quad[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross === 0) return false;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/**
 * Ecken verfeinern: Jeder Randpunkt der Fläche wird der nächsten Seite des
 * groben Vierecks zugeordnet, durch jede Seite eine Gerade gelegt, die Ecken
 * sind die Schnittpunkte. Punkte nahe den Ecken zählen nicht — dort ist das
 * Blatt oft abgerundet, geknickt oder vom Daumen verdeckt. Zwei Durchgänge,
 * der zweite mit engerer Toleranz, damit Schrift und Löcher am Rand nicht
 * mitziehen. Liefert null, wenn das Ergebnis unplausibel aussieht.
 */
function refineQuad(xs: number[], ys: number[], rough: Quad, width: number, height: number): Quad | null {
  const diagonal = Math.hypot(width, height);
  let quad = rough;
  for (const tolerance of [0.04 * diagonal, 0.015 * diagonal]) {
    const sides: number[][] = [[], [], [], []];
    for (let i = 0; i < xs.length; i++) {
      let bestSide = -1;
      let bestDistance = tolerance;
      for (let side = 0; side < 4; side++) {
        const a = quad[side];
        const b = quad[(side + 1) % 4];
        const vx = b.x - a.x;
        const vy = b.y - a.y;
        const lengthSq = vx * vx + vy * vy;
        if (lengthSq === 0) continue;
        const t = ((xs[i] - a.x) * vx + (ys[i] - a.y) * vy) / lengthSq;
        if (t < 0.1 || t > 0.9) continue;
        const distance = Math.abs((xs[i] - a.x) * vy - (ys[i] - a.y) * vx) / Math.sqrt(lengthSq);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestSide = side;
        }
      }
      if (bestSide >= 0) sides[bestSide].push(i);
    }

    const lines = sides.map((indices) => fitLine(xs, ys, indices));
    const next: Point[] = [];
    for (let corner = 0; corner < 4; corner++) {
      const before = lines[(corner + 3) % 4];
      const after = lines[corner];
      const point = before && after ? intersect(before, after) : null;
      if (!point) return null;
      next.push(point);
    }
    quad = next as Quad;
  }

  // Leicht über den Bildrand hinaus ist in Ordnung (Ecke knapp abgeschnitten),
  // weit draußen heißt: die Geraden passen nicht.
  const margin = 0.05;
  for (const p of quad) {
    if (p.x < -width * margin || p.x > width * (1 + margin)) return null;
    if (p.y < -height * margin || p.y > height * (1 + margin)) return null;
  }
  const clamped = quad.map((p) => ({
    x: Math.min(Math.max(p.x, 0), width),
    y: Math.min(Math.max(p.y, 0), height),
  })) as Quad;
  if (!isConvex(clamped)) return null;
  const ratio = Math.abs(quadArea(clamped)) / Math.max(Math.abs(quadArea(rough)), 1);
  if (ratio < 0.8 || ratio > 1.5) return null;
  return clamped;
}

/**
 * Sucht das Blatt im Foto und liefert seine vier Ecken in Koordinaten des
 * übergebenen Canvas. Vorgehen: verkleinern, Graustufen, weichzeichnen,
 * Otsu-Schwellwert, größte helle Fläche suchen. Grobe Ecken sind die Punkte
 * mit kleinster/größter Summe bzw. Differenz von x und y; danach werden an
 * die vier Blattseiten Geraden angepasst (refineQuad).
 */
export function detectDocumentCorners(source: HTMLCanvasElement): Quad {
  const small = scaledCopy(source, DETECT_SIDE);
  const scale = small.width / source.width;
  const { width, height } = small;
  const { data } = context2d(small).getImageData(0, 0, width, height);

  const grayRaw = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < grayRaw.length; i++, p += 4) {
    grayRaw[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  const gray = boxBlur(grayRaw, width, height, 2);
  const threshold = otsuThreshold(gray);

  // Zusammenhängende helle Flächen (4er-Nachbarschaft) beschriften.
  const labels = new Int32Array(width * height);
  const stack = new Int32Array(width * height);
  let bestLabel = 0;
  let bestArea = 0;
  let bestEdgeLabel = 0;
  let bestEdgeArea = 0;
  let nextLabel = 0;
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] !== 0 || gray[start] <= threshold) continue;
    nextLabel++;
    let area = 0;
    let touchesLeft = false;
    let touchesRight = false;
    let touchesTop = false;
    let touchesBottom = false;
    let top = 0;
    stack[top++] = start;
    labels[start] = nextLabel;
    while (top > 0) {
      const index = stack[--top];
      area++;
      const x = index % width;
      const y = (index - x) / width;
      if (x === 0) touchesLeft = true;
      if (x === width - 1) touchesRight = true;
      if (y === 0) touchesTop = true;
      if (y === height - 1) touchesBottom = true;
      const neighbours = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];
      for (const n of neighbours) {
        if (n >= 0 && labels[n] === 0 && gray[n] > threshold) {
          labels[n] = nextLabel;
          stack[top++] = n;
        }
      }
    }
    // Eine Fläche, die an alle vier Bildränder stößt, ist oft ein heller
    // Tisch o. Ä. — oder das Blatt füllt das Foto fast ganz aus. Deshalb nur
    // nachrangig nehmen, wenn es keine andere große helle Fläche gibt.
    const touchesAllEdges = touchesLeft && touchesRight && touchesTop && touchesBottom;
    if (touchesAllEdges) {
      if (area > bestEdgeArea) {
        bestEdgeArea = area;
        bestEdgeLabel = nextLabel;
      }
    } else if (area > bestArea) {
      bestArea = area;
      bestLabel = nextLabel;
    }
  }

  const minArea = labels.length * 0.2;
  const label = bestArea >= minArea ? bestLabel : bestEdgeArea >= minArea ? bestEdgeLabel : 0;
  if (label === 0) return defaultQuad(source.width, source.height);

  // Hintergrund, der vom Bildrand aus erreichbar ist. Löcher in der Fläche
  // (Schrift, Stempel, Linien) gehören nicht dazu — ihre Ränder sind keine
  // Blattkante und würden die Geraden in refineQuad nach innen ziehen.
  const outside = new Uint8Array(width * height);
  let top = 0;
  const pushOutside = (index: number) => {
    if (outside[index] === 0 && labels[index] !== label) {
      outside[index] = 1;
      stack[top++] = index;
    }
  };
  for (let x = 0; x < width; x++) {
    pushOutside(x);
    pushOutside((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    pushOutside(y * width);
    pushOutside(y * width + width - 1);
  }
  while (top > 0) {
    const index = stack[--top];
    const x = index % width;
    if (x > 0) pushOutside(index - 1);
    if (x < width - 1) pushOutside(index + 1);
    if (index >= width) pushOutside(index - width);
    if (index < (height - 1) * width) pushOutside(index + width);
  }

  // Grobe Ecken und gleichzeitig die Randpunkte der Fläche sammeln
  // (Pixelmitte, daher +0.5).
  let tl = { x: 0, y: 0, v: Infinity };
  let br = { x: 0, y: 0, v: -Infinity };
  let tr = { x: 0, y: 0, v: -Infinity };
  let bl = { x: 0, y: 0, v: Infinity };
  const edgeXs: number[] = [];
  const edgeYs: number[] = [];
  for (let index = 0; index < labels.length; index++) {
    if (labels[index] !== label) continue;
    const x = index % width;
    const y = (index - x) / width;
    const px = x + 0.5;
    const py = y + 0.5;
    const sum = px + py;
    const diff = px - py;
    if (sum < tl.v) tl = { x: px, y: py, v: sum };
    if (sum > br.v) br = { x: px, y: py, v: sum };
    if (diff > tr.v) tr = { x: px, y: py, v: diff };
    if (diff < bl.v) bl = { x: px, y: py, v: diff };
    const isEdge =
      x === 0 ||
      y === 0 ||
      x === width - 1 ||
      y === height - 1 ||
      outside[index - 1] === 1 ||
      outside[index + 1] === 1 ||
      outside[index - width] === 1 ||
      outside[index + width] === 1;
    if (isEdge) {
      edgeXs.push(px);
      edgeYs.push(py);
    }
  }

  const rough: Quad = [
    { x: tl.x, y: tl.y },
    { x: tr.x, y: tr.y },
    { x: br.x, y: br.y },
    { x: bl.x, y: bl.y },
  ];
  const quad = refineQuad(edgeXs, edgeYs, rough, width, height) ?? rough;
  return quad.map((p) => ({ x: p.x / scale, y: p.y / scale })) as Quad;
}

/**
 * Homographie, die das Rechteck (0,0)–(w,h) auf das Viereck abbildet:
 * 8 Unbekannte aus 4 Punktpaaren, gelöst per Gauß-Elimination.
 */
function homography(quad: Quad, width: number, height: number): number[] {
  const dest: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = dest[i];
    const { x, y } = quad[i];
    a.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
    a.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const p = a[col][col];
    if (Math.abs(p) < 1e-12) throw new Error('quad');
    for (let k = col; k < 9; k++) a[col][k] /= p;
    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      if (factor === 0) continue;
      for (let k = col; k < 9; k++) a[row][k] -= factor * a[col][k];
    }
  }
  return a.map((row) => row[8]);
}

/**
 * Schneidet das Viereck aus und zieht es auf A4 hochkant gerade. Für jeden
 * Zielpixel wird die Stelle im Foto berechnet und bilinear interpoliert.
 */
export function warpToA4(source: HTMLCanvasElement, quad: Quad): HTMLCanvasElement {
  const width = SCAN_WIDTH_PX;
  const height = SCAN_HEIGHT_PX;
  const [h0, h1, h2, h3, h4, h5, h6, h7] = homography(quad, width, height);
  const src = context2d(source).getImageData(0, 0, source.width, source.height).data;
  const sw = source.width;
  const sh = source.height;

  const target = createCanvas(width, height);
  const ctx = context2d(target);
  const out = ctx.createImageData(width, height);
  const dst = out.data;

  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      const w = h6 * u + h7 * v + 1;
      let x = (h0 * u + h1 * v + h2) / w;
      let y = (h3 * u + h4 * v + h5) / w;
      x = Math.min(Math.max(x, 0), sw - 1.001);
      y = Math.min(Math.max(y, 0), sh - 1.001);
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      const o = (v * width + u) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * fx;
        const bottom = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * fx;
        dst[o + c] = top + (bottom - top) * fy;
      }
      dst[o + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);
  return target;
}

/**
 * "Scan-Look": Schatten und graues Papier werden weiß, Schrift bleibt dunkel.
 * Jeder Pixel wird durch die mittlere Helligkeit seiner Umgebung geteilt
 * (Beleuchtungsausgleich), danach wird der Kontrast gestreckt. Farbe bleibt
 * erhalten — Stempel und Unterschriften in Blau sollen erkennbar bleiben.
 */
export function enhanceScan(canvas: HTMLCanvasElement): void {
  const ctx = context2d(canvas);
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  // Integralbild der Helligkeit: jeder Mittelwert in konstanter Zeit.
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      rowSum += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + rowSum;
    }
  }

  // Radius deutlich größer als ein Buchstabe, kleiner als ein Schatten.
  const radius = Math.round(width / 40);
  // Ab hier gilt ein Pixel als Papier (weiß), darunter wird abgedunkelt.
  const white = 0.92;
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const area = (x1 - x0) * (y1 - y0);
      const mean =
        (integral[y1 * stride + x1] -
          integral[y0 * stride + x1] -
          integral[y1 * stride + x0] +
          integral[y0 * stride + x0]) /
        area;
      const background = Math.max(mean, 1);
      const p = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const ratio = data[p + c] / background;
        // Unter "white" auf 0..255 strecken (Kurve > 1 macht Schrift
        // satter), darüber reines Weiß.
        const value = ratio >= white ? 255 : ((ratio / white) ** 1.6) * 255;
        data[p + c] = value;
      }
    }
  }

  ctx.putImageData(image, 0, 0);
}

/** Dreht das Viereck um eine Ecke weiter — die Seite kommt um 90° gedreht heraus. */
export function rotateQuad(quad: Quad): Quad {
  return [quad[3], quad[0], quad[1], quad[2]];
}
