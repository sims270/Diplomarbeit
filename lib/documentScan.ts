/**
 * Bildverarbeitung für den CMR-Scanner (components/CmrScanner.web.tsx):
 * Blatt im Foto finden, gerade ziehen, nach Scan aussehen lassen.
 *
 * Bewusst ohne OpenCV.js: Das wären rund 10 MB, ein weiterer Host in der
 * CSP (vercel.json) und 'wasm-unsafe-eval'. Stattdessen mehrere einfache
 * Merkmale (Helligkeit, Papierfarbe, Sättigung, Kanten), von denen das am
 * besten bewertete Viereck gewinnt (detectCornersInPixels); liegt die
 * Erkennung trotzdem daneben, schiebt der Fahrer die Ecken von Hand.
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
// Mit "above" zählen nur Werte darüber (feiner Schwellwert in
// detectCornersInPixels).
function otsuThreshold(gray: Uint8ClampedArray, above = -1): number {
  const histogram = new Array<number>(256).fill(0);
  let total = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] > above) {
      histogram[gray[i]]++;
      total++;
    }
  }

  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i];

  let sumBack = 0;
  let weightBack = 0;
  let best = 0;
  let threshold = above >= 0 ? above : 127;
  for (let t = 0; t < 256; t++) {
    weightBack += histogram[t];
    if (weightBack === 0) continue;
    const weightFore = total - weightBack;
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

interface Components {
  labels: Int32Array;
  /** Fläche je Label (Index 0 ist frei, Labels beginnen bei 1). */
  areas: number[];
  /** Stößt die Fläche an alle vier Bildränder? */
  touchesAll: boolean[];
}

/** Zusammenhängende Flächen (4er-Nachbarschaft) in einer 0/1-Maske beschriften. */
function labelComponents(mask: Uint8Array, width: number, height: number, stack: Int32Array): Components {
  const labels = new Int32Array(width * height);
  const areas = [0];
  const touchesAll = [false];
  let nextLabel = 0;
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] !== 0 || mask[start] === 0) continue;
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
      if (x > 0 && labels[index - 1] === 0 && mask[index - 1] === 1) {
        labels[index - 1] = nextLabel;
        stack[top++] = index - 1;
      }
      if (x < width - 1 && labels[index + 1] === 0 && mask[index + 1] === 1) {
        labels[index + 1] = nextLabel;
        stack[top++] = index + 1;
      }
      if (y > 0 && labels[index - width] === 0 && mask[index - width] === 1) {
        labels[index - width] = nextLabel;
        stack[top++] = index - width;
      }
      if (y < height - 1 && labels[index + width] === 0 && mask[index + width] === 1) {
        labels[index + width] = nextLabel;
        stack[top++] = index + width;
      }
    }
    areas.push(area);
    touchesAll.push(touchesLeft && touchesRight && touchesTop && touchesBottom);
  }
  return { labels, areas, touchesAll };
}

/**
 * Flutet vom Bildrand aus alle Pixel mit allowed = 1. Liefert eine Maske
 * mit 1 für jeden erreichten Pixel.
 */
function floodFromBorder(allowed: Uint8Array, width: number, height: number, stack: Int32Array): Uint8Array {
  const reached = new Uint8Array(width * height);
  let top = 0;
  const push = (index: number) => {
    if (reached[index] === 0 && allowed[index] === 1) {
      reached[index] = 1;
      stack[top++] = index;
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (top > 0) {
    const index = stack[--top];
    const x = index % width;
    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (index >= width) push(index - width);
    if (index < (height - 1) * width) push(index + width);
  }
  return reached;
}

/**
 * Größte Fläche, die nicht an alle vier Bildränder stößt. So eine Fläche ist
 * oft ein heller Tisch o. Ä. — oder das Blatt füllt das Foto fast ganz aus.
 * Deshalb nur nachrangig, wenn es keine andere große Fläche gibt.
 */
function pickLargest({ areas, touchesAll }: Components, minArea: number): number {
  let best = 0;
  let bestEdge = 0;
  for (let label = 1; label < areas.length; label++) {
    if (touchesAll[label]) {
      if (areas[label] > areas[bestEdge]) bestEdge = label;
    } else if (areas[label] > areas[best]) {
      best = label;
    }
  }
  if (areas[best] >= minArea) return best;
  if (areas[bestEdge] >= minArea) return bestEdge;
  return 0;
}

/** Fläche, die den mittleren Bildausschnitt am stärksten bedeckt. */
function pickCenter({ labels, areas }: Components, width: number, height: number): number {
  const counts = new Array<number>(areas.length).fill(0);
  for (let y = Math.floor(height * 0.4); y < Math.ceil(height * 0.6); y++) {
    for (let x = Math.floor(width * 0.4); x < Math.ceil(width * 0.6); x++) {
      counts[labels[y * width + x]]++;
    }
  }
  let best = 0;
  for (let label = 1; label < counts.length; label++) {
    if (counts[label] > counts[best]) best = label;
  }
  return best;
}

interface Candidate {
  quad: Quad;
  score: number;
}

/** Anteil der Punkte, die höchstens tolerance von einer Seite des Vierecks entfernt liegen. */
function fractionNearQuad(xs: number[], ys: number[], quad: Quad, tolerance: number): number {
  if (xs.length === 0) return 0;
  let near = 0;
  for (let i = 0; i < xs.length; i++) {
    for (let side = 0; side < 4; side++) {
      const a = quad[side];
      const b = quad[(side + 1) % 4];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const lengthSq = vx * vx + vy * vy;
      if (lengthSq === 0) continue;
      const t = Math.min(Math.max(((xs[i] - a.x) * vx + (ys[i] - a.y) * vy) / lengthSq, 0), 1);
      if (Math.hypot(xs[i] - (a.x + t * vx), ys[i] - (a.y + t * vy)) <= tolerance) {
        near++;
        break;
      }
    }
  }
  return near / xs.length;
}

/**
 * Viereck zu einer gefundenen Fläche: grobe Ecken sind die Punkte mit
 * kleinster/größter Summe bzw. Differenz von x und y, danach werden an die
 * vier Blattseiten Geraden angepasst (refineQuad). Dazu eine Bewertung, wie
 * sehr das Ergebnis nach Blatt aussieht: Füllt die Fläche das Viereck aus,
 * und liegt ihr Rand auf dessen Seiten?
 */
function sheetFromComponent(
  labels: Int32Array,
  label: number,
  width: number,
  height: number,
  stack: Int32Array
): Candidate | null {
  // Hintergrund, der vom Bildrand aus erreichbar ist. Löcher in der Fläche
  // (Schrift, Stempel, Linien) gehören nicht dazu — ihre Ränder sind keine
  // Blattkante und würden die Geraden in refineQuad nach innen ziehen.
  const notSheet = new Uint8Array(width * height);
  for (let index = 0; index < labels.length; index++) {
    if (labels[index] !== label) notSheet[index] = 1;
  }
  const outside = floodFromBorder(notSheet, width, height, stack);

  // Grobe Ecken und gleichzeitig die Randpunkte der Fläche sammeln
  // (Pixelmitte, daher +0.5).
  let tl = { x: 0, y: 0, v: Infinity };
  let br = { x: 0, y: 0, v: -Infinity };
  let tr = { x: 0, y: 0, v: -Infinity };
  let bl = { x: 0, y: 0, v: Infinity };
  const edgeXs: number[] = [];
  const edgeYs: number[] = [];
  let filledArea = 0;
  for (let index = 0; index < labels.length; index++) {
    if (outside[index] === 0) filledArea++;
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
  if (edgeXs.length === 0) return null;

  const rough: Quad = [
    { x: tl.x, y: tl.y },
    { x: tr.x, y: tr.y },
    { x: br.x, y: br.y },
    { x: bl.x, y: bl.y },
  ];
  const refined = refineQuad(edgeXs, edgeYs, rough, width, height);
  const quad = refined ?? rough;

  const quadSize = Math.abs(quadArea(quad));
  const coverage = quadSize / (width * height);
  if (coverage < 0.15) return null;
  const fill = Math.min(filledArea, quadSize) / Math.max(filledArea, quadSize, 1);
  const fit = fractionNearQuad(edgeXs, edgeYs, quad, 0.01 * Math.hypot(width, height));
  let score = fill * fit;
  if (!refined) score *= 0.5;
  // Fast das ganze Foto: meist ist Blatt und Untergrund zusammengelaufen
  // und das "Viereck" ist nur der Bildrand.
  if (coverage > 0.9) score *= 0.5;
  return { quad, score };
}

/** Median eines Kanals im mittleren Bildausschnitt (dort liegt fast immer das Blatt). */
function centerMedian(channel: Uint8ClampedArray, width: number, height: number): number {
  const histogram = new Array<number>(256).fill(0);
  let count = 0;
  for (let y = Math.floor(height * 0.35); y < Math.ceil(height * 0.65); y++) {
    for (let x = Math.floor(width * 0.35); x < Math.ceil(width * 0.65); x++) {
      histogram[channel[y * width + x]]++;
      count++;
    }
  }
  let seen = 0;
  for (let value = 0; value < 256; value++) {
    seen += histogram[value];
    if (seen * 2 >= count) return value;
  }
  return 255;
}

// Wie stark Farbunterschiede gegenüber Helligkeit zählen ("Sättigung
// hochdrehen"): Ein leicht beiger Tisch hebt sich so von weißem Papier ab.
const COLOR_GAIN = 3;
// Höchstens so viele feine Stufen je Merkmal (jede kostet ~20 ms).
const FINE_LEVELS = 4;
// Um so viel muss ein späteres Merkmal besser bewertet sein, um zu gewinnen.
const SWITCH_MARGIN = 0.05;

/**
 * Sucht das Blatt in Pixeldaten (RGBA wie aus getImageData) und liefert
 * seine vier Ecken in deren Koordinaten. Mehrere Merkmale werden probiert,
 * jedes liefert ein Viereck, das am besten bewertete gewinnt:
 *
 * 1. Helligkeit: größte helle Fläche (Otsu-Schwellwert) — helles Blatt auf
 *    dunklem Untergrund; mit zweitem, feinerem Schwellwert auch weißes
 *    Papier auf etwas weniger weißem Tisch.
 * 2. Farbabstand zur Papierfarbe aus der Bildmitte, Farbe dreifach
 *    gewichtet, ebenfalls grob und fein — helles Blatt auf leicht farbigem
 *    Untergrund, auch farbige CMR-Durchschläge.
 * 3. Sättigung: Papier ist fast farblos, der Untergrund oft nicht.
 * 4. Kanten: der feine Schatten am Blattrand — weiß auf weiß.
 *
 * Bei 2–4 ist das Blatt alles, was der Untergrund vom Bildrand aus nicht
 * erreicht. So stören Tabellenlinien und Schrift im Formular nicht.
 */
export function detectCornersInPixels(data: Uint8ClampedArray, width: number, height: number): Quad {
  const size = width * height;
  const rawR = new Uint8ClampedArray(size);
  const rawG = new Uint8ClampedArray(size);
  const rawB = new Uint8ClampedArray(size);
  for (let i = 0, p = 0; i < size; i++, p += 4) {
    rawR[i] = data[p];
    rawG[i] = data[p + 1];
    rawB[i] = data[p + 2];
  }
  const r = boxBlur(rawR, width, height, 2);
  const g = boxBlur(rawG, width, height, 2);
  const b = boxBlur(rawB, width, height, 2);

  // Helligkeit und zwei Farbachsen (rot–grün, gelb–blau).
  const gray = new Uint8ClampedArray(size);
  const red = new Float32Array(size);
  const yellow = new Float32Array(size);
  const chroma = new Uint8ClampedArray(size);
  for (let i = 0; i < size; i++) {
    gray[i] = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
    red[i] = r[i] - g[i];
    yellow[i] = (r[i] + g[i]) / 2 - b[i];
    chroma[i] = Math.max(r[i], g[i], b[i]) - Math.min(r[i], g[i], b[i]);
  }

  const stack = new Int32Array(size);

  // Ein späteres Merkmal muss deutlich besser sein: Die Reihenfolge geht von
  // genau (Helligkeit) zu robust (Kanten — deren Rand liegt ein paar Pixel
  // außerhalb, weil eine Kante mehrere Pixel breit ist).
  const pick: { best: Candidate | null } = { best: null };
  const consider = (candidate: Candidate | null) => {
    if (candidate && (!pick.best || candidate.score > pick.best.score + SWITCH_MARGIN)) {
      pick.best = candidate;
    }
  };
  // Mehr als 1 gibt die Bewertung nicht her: Ab hier kann kein späteres
  // Merkmal mehr gewinnen, der Rest wird gar nicht erst gerechnet.
  const settled = () => pick.best !== null && pick.best.score + SWITCH_MARGIN >= 1;

  // Blatt = alles, was vom Bildrand über Untergrund-Pixel nicht erreichbar ist.
  const enclosedCandidate = (background: Uint8Array) => {
    const reached = floodFromBorder(background, width, height, stack);
    const sheet = new Uint8Array(size);
    for (let i = 0; i < size; i++) sheet[i] = reached[i] === 1 ? 0 : 1;
    const components = labelComponents(sheet, width, height, stack);
    const label = pickCenter(components, width, height);
    return label === 0 ? null : sheetFromComponent(components.labels, label, width, height, stack);
  };

  // Untergrund = Wert höchstens threshold (heller bzw. ähnlicher ist Blatt).
  const belowCandidate = (values: Uint8ClampedArray, threshold: number) => {
    const background = new Uint8Array(size);
    for (let i = 0; i < size; i++) background[i] = values[i] <= threshold ? 1 : 0;
    return enclosedCandidate(background);
  };

  // Feine Schwellwerte: Otsu trennt immer die größte Lücke — zuerst Schrift
  // von allem Hellen, dann z. B. Schatten vom Rest. Deshalb Stufe für Stufe
  // nur noch die Werte darüber teilen; auf einer der Stufen liegt die Grenze
  // zwischen Papier und einem fast gleich hellen Tisch. Stufen, die mitten
  // durchs Papier schneiden, fallen bei der Bewertung durch.
  const fineCandidates = (values: Uint8ClampedArray, coarse: number) => {
    let threshold = coarse;
    for (let level = 0; level < FINE_LEVELS && !settled(); level++) {
      const next = otsuThreshold(values, threshold);
      if (next <= threshold || next >= 254) break;
      threshold = next;
      consider(belowCandidate(values, threshold));
    }
  };

  // 1. Helligkeit, grob und fein.
  {
    const threshold = otsuThreshold(gray);
    const bright = new Uint8Array(size);
    for (let i = 0; i < size; i++) bright[i] = gray[i] > threshold ? 1 : 0;
    const components = labelComponents(bright, width, height, stack);
    const label = pickLargest(components, size * 0.2);
    consider(label === 0 ? null : sheetFromComponent(components.labels, label, width, height, stack));
    fineCandidates(gray, threshold);
  }

  // 2. Farbabstand zur Papierfarbe
  if (!settled()) {
    const paperGray = centerMedian(gray, width, height);
    const paperR = centerMedian(r, width, height);
    const paperG = centerMedian(g, width, height);
    const paperB = centerMedian(b, width, height);
    const paperRed = paperR - paperG;
    const paperYellow = (paperR + paperG) / 2 - paperB;
    const similarity = new Uint8ClampedArray(size);
    for (let i = 0; i < size; i++) {
      const distance = Math.hypot(
        gray[i] - paperGray,
        COLOR_GAIN * (red[i] - paperRed),
        COLOR_GAIN * (yellow[i] - paperYellow)
      );
      similarity[i] = 255 - Math.min(255, distance);
    }
    const threshold = otsuThreshold(similarity);
    consider(belowCandidate(similarity, threshold));
    fineCandidates(similarity, threshold);
  }

  // 3. Sättigung
  if (!settled()) {
    const threshold = otsuThreshold(chroma);
    const background = new Uint8Array(size);
    for (let i = 0; i < size; i++) background[i] = chroma[i] > threshold ? 1 : 0;
    consider(enclosedCandidate(background));
  }

  // 4. Kanten (Sobel über Helligkeit und Farbe)
  if (!settled()) {
    const gradient = new Float32Array(size);
    const histogram = new Array<number>(256).fill(0);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        let sumSq = 0;
        for (const [channel, weight] of [
          [gray, 1],
          [red, COLOR_GAIN / 2],
          [yellow, COLOR_GAIN / 2],
        ] as const) {
          const gx =
            channel[i - width + 1] + 2 * channel[i + 1] + channel[i + width + 1] -
            channel[i - width - 1] - 2 * channel[i - 1] - channel[i + width - 1];
          const gy =
            channel[i + width - 1] + 2 * channel[i + width] + channel[i + width + 1] -
            channel[i - width - 1] - 2 * channel[i - width] - channel[i - width + 1];
          sumSq += (weight * weight * (gx * gx + gy * gy)) / 16;
        }
        gradient[i] = Math.sqrt(sumSq);
        histogram[Math.min(255, Math.round(gradient[i]))]++;
      }
    }
    // Schwelle über dem Bildrauschen: Der Median ist fast nur glatte Fläche.
    let seen = 0;
    let median = 0;
    const inner = (width - 2) * (height - 2);
    while (median < 255 && (seen += histogram[median]) * 2 < inner) median++;
    const threshold = Math.max(3, median * 3);

    // Kanten um einen Pixel verbreitern, damit kleine Lücken im Blattrand
    // den Untergrund nicht ins Blatt laufen lassen.
    const edge = new Uint8Array(size);
    for (let i = 0; i < size; i++) if (gradient[i] > threshold) edge[i] = 1;
    const background = new Uint8Array(size);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let isEdge = false;
        for (let dy = -1; dy <= 1 && !isEdge; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx >= 0 && xx < width && edge[yy * width + xx] === 1) {
              isEdge = true;
              break;
            }
          }
        }
        background[y * width + x] = isEdge ? 0 : 1;
      }
    }
    consider(enclosedCandidate(background));
  }

  return pick.best ? pick.best.quad : defaultQuad(width, height);
}

/**
 * Sucht das Blatt im Foto und liefert seine vier Ecken in Koordinaten des
 * übergebenen Canvas. Gerechnet wird auf einer kleinen Kopie
 * (detectCornersInPixels), die Ecken werden hochgerechnet.
 */
export function detectDocumentCorners(source: HTMLCanvasElement): Quad {
  const small = scaledCopy(source, DETECT_SIDE);
  const scale = small.width / source.width;
  const { width, height } = small;
  const { data } = context2d(small).getImageData(0, 0, width, height);
  const quad = detectCornersInPixels(data, width, height);
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
