import { DocumentMetadata, ContradictionItem, CitationGroup } from '../types';

/**
 * Utilidades de integridad de la evidencia para File Search.
 * Sintaxis del filtro: AIP-160 (https://google.aip.dev/160), la misma que muestra la
 * documentación oficial de File Search: metadata_filter: 'author = "Robert Graves"'.
 */

const escapeFilterValue = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Construye el metadataFilter con las claves de los documentos recuperables. Devuelve null si no hay ninguno. */
export function buildMetadataFilter(docs: DocumentMetadata[]): string | null {
  const clauses = docs
    .filter((d) => d.retrievalFilterKey && d.retrievalFilterValue)
    .map((d) => `${d.retrievalFilterKey} = "${escapeFilterValue(d.retrievalFilterValue!)}"`);
  if (clauses.length === 0) return null;
  return Array.from(new Set(clauses)).join(' OR ');
}

type ChunkMetadata = { key?: string; stringValue?: string };
export interface RetrievedContextLike {
  text?: string;
  title?: string;
  uri?: string;
  pageNumber?: number;
  fileSearchStore?: string;
  customMetadata?: ChunkMetadata[];
}

/**
 * Mapea un fragmento recuperado a su documento de origen. Si no se puede determinar
 * de forma inequívoca, devuelve undefined (el fragmento debe descartarse, nunca reasignarse).
 */
export function mapChunkToDoc(rc: RetrievedContextLike, docs: DocumentMetadata[]): DocumentMetadata | undefined {
  const md = rc.customMetadata || [];
  const getMd = (k: string) => md.find((m) => m.key === k)?.stringValue;

  const docKey = getMd('docKey');
  if (docKey) {
    return docs.find((d) => d.docKey === docKey || (d.retrievalFilterKey === 'docKey' && d.retrievalFilterValue === docKey));
  }

  const fileHash = getMd('fileHash');
  if (fileHash) {
    const byHash = docs.filter(
      (d) =>
        (d.retrievalFilterKey === 'fileHash' && d.retrievalFilterValue?.toLowerCase() === fileHash.toLowerCase()) ||
        (d.fileHash && d.fileHash.toLowerCase() === fileHash.toLowerCase())
    );
    return byHash.length === 1 ? byHash[0] : undefined;
  }

  if (rc.uri) {
    const byUri = docs.filter((d) => d.storeDocumentName && rc.uri!.includes(d.storeDocumentName));
    if (byUri.length === 1) return byUri[0];
  }

  const title = (rc.title || '').trim().toLowerCase();
  if (title) {
    const byTitle = docs.filter((d) => d.name.trim().toLowerCase() === title);
    if (byTitle.length === 1) return byTitle[0];
  }

  return undefined;
}

const ARTICLE_RE =
  /(?:Art(?:[íi]culo)?\.?\s*(\d+(?:\.\d+)*(?:\s*(?:bis|ter|quater))?)|Numeral\s*(\d+(?:\.\d+)*)|Disposici[óo]n\s+(General|Transitoria|Final|Derogatoria|Reformatoria)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ\d]+))/gi;

/**
 * Determina el artículo/numeral de un fragmento. Si hay más de una referencia distinta,
 * no se elige ninguna: se rotula como no determinado con certeza.
 */
export function detectArticle(text: string): string {
  const found = new Map<string, string>();
  for (const m of text.matchAll(ARTICLE_RE)) {
    let label: string;
    if (m[1]) label = `Art. ${m[1].replace(/\s+/g, ' ').trim()}`;
    else if (m[2]) label = `Numeral ${m[2]}`;
    else label = `Disposición ${m[3]} ${m[4]}`;
    const norm = label.toLowerCase();
    if (!found.has(norm)) found.set(norm, label);
  }
  const labels = Array.from(found.values());
  if (labels.length === 0) return 'Art./numeral no identificado en el fragmento';
  if (labels.length === 1) return labels[0];
  return `Art. no determinado con certeza (el fragmento menciona: ${labels.slice(0, 5).join(', ')}${labels.length > 5 ? '…' : ''})`;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Comprueba si el texto literal contiene el artículo/numeral solicitado (ej. "Art. 74", "74", "Disposición Transitoria Primera"). */
export function textContainsArticle(text: string, articulo: string): boolean {
  const num = articulo.match(/\d+(?:\.\d+)*/);
  if (num) {
    const n = escapeRe(num[0]);
    const re = new RegExp(`(?:Art(?:[íi]culo)?\\.?|Numeral)\\s*${n}(?![\\d.]*\\d)`, 'i');
    return re.test(text);
  }
  const phrase = articulo.trim().toLowerCase().replace(/\s+/g, ' ');
  return phrase.length > 3 && text.toLowerCase().replace(/\s+/g, ' ').includes(phrase);
}

const cleanHeadingLine = (l: string) => l.replace(/[*_]/g, '').replace(/^[#\s]*(?:\d+[.)]\s*)?/, '').trim();
const isHeadingLine = (l: string) => {
  const raw = l.replace(/[*_]/g, '').trim();
  return /^#{1,6}\s/.test(raw) || /^\d+[.)]\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,\-/]{5,}(?::|$)/.test(raw);
};

/**
 * Extrae el cuerpo de una sección del texto del modelo cuyo encabezado coincide con headingRe
 * (admite "### TÍTULO", "4. TÍTULO:" y negritas). Termina en el siguiente encabezado.
 */
export function extractSection(text: string, headingRe: RegExp): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => isHeadingLine(l) && headingRe.test(cleanHeadingLine(l)));
  if (start === -1) return '';
  const body: string[] = [];
  const headingText = cleanHeadingLine(lines[start]);
  const colon = headingText.indexOf(':');
  if (colon !== -1 && headingText.slice(colon + 1).trim()) body.push(headingText.slice(colon + 1).trim());
  for (let i = start + 1; i < lines.length; i++) {
    if (isHeadingLine(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join('\n').trim();
}

export const CONTRADICTIONS_HEADING = 'CONTRADICCIONES_JSON';

/** Separa la sección estructurada de contradicciones del texto visible. */
export function splitContradictionsSection(text: string): { cleanText: string; rawJson: string | null } {
  const idx = text.search(new RegExp(`#{2,}\\s*${CONTRADICTIONS_HEADING}`, 'i'));
  if (idx === -1) return { cleanText: text, rawJson: null };
  const after = text.slice(idx);
  const nextHeading = after.slice(3).search(/\n#{2,}\s/);
  const section = nextHeading === -1 ? after : after.slice(0, nextHeading + 3);
  const rest = nextHeading === -1 ? '' : after.slice(nextHeading + 3);
  const jsonMatch = section.match(/\[[\s\S]*\]/);
  return {
    cleanText: (text.slice(0, idx) + rest).trim(),
    rawJson: jsonMatch ? jsonMatch[0] : null,
  };
}

interface RawContradiction {
  normaA?: string;
  articuloA?: string;
  normaB?: string;
  articuloB?: string;
  descripcion?: string;
}

/**
 * Convierte la salida estructurada del modelo en ContradictionItem, aceptando solo pares
 * cuyas dos citas existen en la evidencia recuperada (documento mapeado + artículo presente en el texto literal).
 */
export function validateContradictions(rawJson: string | null, citationGroups: CitationGroup[]): ContradictionItem[] {
  if (!rawJson) return [];
  let parsed: RawContradiction[];
  try {
    const data = JSON.parse(rawJson);
    parsed = Array.isArray(data) ? data : [];
  } catch {
    return [];
  }

  const findEvidence = (norma?: string, articulo?: string) => {
    if (!norma || !articulo) return null;
    const n = norma.trim().toLowerCase();
    const group = citationGroups.find((g) => g.documentName.trim().toLowerCase() === n);
    if (!group) return null;
    const cit = group.citations.find((c) => c.verified && textContainsArticle(c.literalQuote, articulo));
    return cit ? { group, cit } : null;
  };

  const items: ContradictionItem[] = [];
  for (const r of parsed) {
    const a = findEvidence(r.normaA, r.articuloA);
    const b = findEvidence(r.normaB, r.articuloB);
    if (!a || !b) continue;
    if (a.group.documentName === b.group.documentName && a.cit.literalQuote === b.cit.literalQuote) continue;
    items.push({
      normA: a.group.documentName,
      articleA: `${r.articuloA} – ${a.cit.pageNumber}`,
      contentA: a.cit.literalQuote,
      normB: b.group.documentName,
      articleB: `${r.articuloB} – ${b.cit.pageNumber}`,
      contentB: b.cit.literalQuote,
      relationType: 'CONTRADICCIÓN',
      observation: (r.descripcion || '').trim(),
    });
  }
  return items;
}

export const GENERAL_GUIDANCE_LABEL = 'Orientación general — no extraída de los documentos cargados';
