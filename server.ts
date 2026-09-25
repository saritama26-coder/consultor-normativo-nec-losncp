import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

import { authService } from './server/services/authService';
import { documentRepository } from './server/services/documentRepository';
import { authenticate, requireAdmin, rateLimiter, AuthenticatedRequest } from './server/middleware/authMiddleware';
import { validatePDFBuffer } from './server/utils/pdfValidator';
import { logger } from './server/utils/logger';
import {
  buildMetadataFilter,
  mapChunkToDoc,
  detectArticle,
  textContainsArticle,
  extractSection,
  splitContradictionsSection,
  validateContradictions,
  CONTRADICTIONS_HEADING,
  GENERAL_GUIDANCE_LABEL,
  RetrievedContextLike,
} from './server/services/retrieval';
import {
  DocumentMetadata,
  ConsultationMode,
  EvidenceStatus,
  CitationItem,
  CitationGroup,
  ConsultationResponse,
  TechnicalReportStructure,
  ContradictionItem,
} from './src/types/normative';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// El cliente envía el PDF como base64: 50 MB binarios pueden convertirse en ~67 MB.
// Se deja margen para el JSON sin permitir cargas arbitrariamente grandes.
app.use(express.json({ limit: '72mb' }));
app.use(rateLimiter(180, 60000));

// Las rutas que consumen Gemini tienen un límite adicional por IP para contener
// abuso y consumo accidental de cuota. El límite global sigue protegiendo al resto de la API.
const aiRateLimit = rateLimiter(30, 60000);
app.use(authenticate);

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const STORE_CONFIG_FILE = process.env.STORE_CONFIG_FILE
  ? path.resolve(process.env.STORE_CONFIG_FILE)
  : path.resolve(__dirname, 'server-file-store.json');

let cachedStoreName: string | null = null;

async function getOrCreateFileSearchStore(): Promise<string> {
  if (cachedStoreName) {
    return cachedStoreName;
  }

  // Check saved store in file
  if (fs.existsSync(STORE_CONFIG_FILE)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(STORE_CONFIG_FILE, 'utf8'));
      if (fileData.storeName) {
        const store = await ai.fileSearchStores.get({ name: fileData.storeName });
        if (store && store.name) {
          cachedStoreName = store.name;
          return cachedStoreName;
        }
      }
    } catch (e: any) {
      logger.warn('Stored storeName no accesible, buscando en FileSearchStores existentes...', e?.message);
    }
  }

  // Look through existing stores
  try {
    const listResponse = await ai.fileSearchStores.list();
    for await (const s of listResponse) {
      if (s.displayName === 'consultor-normativo-store' && s.name) {
        cachedStoreName = s.name;
        fs.writeFileSync(STORE_CONFIG_FILE, JSON.stringify({ storeName: cachedStoreName }));
        return cachedStoreName;
      }
    }
  } catch (e: any) {
    logger.warn('Error listando FileSearchStores:', e?.message);
  }

  // Create new store
  logger.info('Creando nuevo File Search Store en Gemini API...');
  const newStore = await ai.fileSearchStores.create({
    config: {
      displayName: 'consultor-normativo-store',
    },
  });

  if (!newStore || !newStore.name) {
    throw new Error('No se pudo crear el File Search Store en Gemini API.');
  }

  cachedStoreName = newStore.name;
  fs.writeFileSync(STORE_CONFIG_FILE, JSON.stringify({ storeName: cachedStoreName }));
  logger.info(`File Search Store creado exitosamente: ${cachedStoreName}`);
  return cachedStoreName;
}

// ----------------------------------------------------
// AUTHENTICATION ROUTES (Admin password protection)
// ----------------------------------------------------

/**
 * GET /api/auth/status
 * Permite al frontend saber si ADMIN_PASSWORD está configurado y si la sesión actual es admin.
 */
app.get('/api/auth/status', (req: AuthenticatedRequest, res: Response) => {
  const isConfigured = authService.isAdminPasswordConfigured();
  const isAdminLoggedIn = req.user?.role === 'administrador';

  res.json({
    isAdminConfigured: isConfigured,
    isAdminLoggedIn,
    userName: req.user?.name || 'Usuario Consultor',
    role: req.user?.role || 'usuario',
  });
});

/**
 * POST /api/auth/login
 * Inicia sesión administrativa exclusivamente con ADMIN_PASSWORD.
 */
app.post('/api/auth/login', rateLimiter(10, 15 * 60 * 1000), (req: Request, res: Response) => {
  const { password, name } = req.body;
  const result = authService.loginAdmin(password, name);

  if (!result.session) {
    res.status(401).json({ error: result.error || 'Credenciales de administrador inválidas.' });
    return;
  }

  res.json({
    success: true,
    session: result.session,
  });
});

/**
 * POST /api/auth/logout
 * Cierra la sesión activa.
 */
app.post('/api/auth/logout', (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];
    authService.logout(token);
  }
  res.json({ success: true });
});

// ----------------------------------------------------
// DOCUMENT MANAGEMENT ROUTES
// ----------------------------------------------------

/**
 * GET /api/documents
 * ACCESO LIBRE: Lista todos los documentos cargados con su metadata y estado.
 */
app.get('/api/documents', async (_req: Request, res: Response): Promise<void> => {
  try {
    const docs = documentRepository.getAll();
    res.json(docs);
  } catch (error: any) {
    logger.error('Error in GET /api/documents:', error?.message);
    res.status(500).json({ error: 'Error al listar los documentos normativos.' });
  }
});

/**
 * POST /api/documents
 * ADMINISTRADOR SOLAMENTE: Sube un PDF oficial, valida firma (%PDF-), calcula SHA-256,
 * detecta duplicados y lo indexa en File Search Store.
 */
app.post('/api/documents', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  let tmpPath: string | null = null;
  try {
    const {
      fileName,
      fileBase64,
      shortName,
      nombre,
      category,
      customCategory,
      tipoNorma,
      numero,
      version,
      registroOficial,
      fechaPublicacion,
      fechaVigencia,
      ultimaReforma,
      estado,
      isHistorical,
      source,
      sourceUrl,
      issuingAuthority,
      description,
      isScanned,
      pageCount,
    } = req.body;

    const docDisplayName = typeof (shortName || nombre) === 'string' ? String(shortName || nombre).trim() : '';

    if (!fileBase64 || typeof fileBase64 !== 'string' || !fileName || typeof fileName !== 'string' || !docDisplayName) {
      res.status(400).json({ error: 'Faltan datos obligatorios: archivo PDF y nombre oficial del documento.' });
      return;
    }

    // Rechazar payloads base64 malformados antes de convertirlos a Buffer.
    const normalizedBase64 = fileBase64.replace(/^data:application\/pdf;base64,/, '').replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedBase64) || normalizedBase64.length % 4 !== 0) {
      res.status(400).json({ error: 'El contenido base64 del PDF es inválido.' });
      return;
    }

    const buffer = Buffer.from(normalizedBase64, 'base64');

    // 1. Rigorous PDF Validation (magic bytes %PDF-, integrity, size)
    const validation = validatePDFBuffer(buffer, fileName);
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error || 'El archivo proporcionado no es un PDF válido.' });
      return;
    }

    // 2. Duplicate Detection via SHA-256 Hash
    const existingDuplicate = documentRepository.findByHash(validation.fileHash);
    if (existingDuplicate) {
      res.status(409).json({
        error: `Documento duplicado detectado. Este mismo archivo PDF ya se encuentra registrado como "${existingDuplicate.name}" (${existingDuplicate.category} - ${existingDuplicate.version}). Hash SHA-256: ${validation.fileHash.slice(0, 16)}...`,
        existingDoc: existingDuplicate,
      });
      return;
    }

    const storeName = await getOrCreateFileSearchStore();

    // Write file to temporary folder
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    tmpPath = path.join(os.tmpdir(), `upload_${Date.now()}_${safeName}`);
    fs.writeFileSync(tmpPath, buffer);

    // Clave estable propia: la metadata no se puede modificar después de subir (la SDK solo expone get/list/delete),
    // por eso el filtrado de recuperación se basa en la lista de docKey activos.
    const docKey = crypto.randomUUID();

    logger.info(`Subiendo PDF al File Search Store (${storeName}): ${docDisplayName}...`);
    const operation = await ai.fileSearchStores.uploadToFileSearchStore({
      fileSearchStoreName: storeName,
      file: tmpPath,
      config: {
        displayName: docDisplayName,
        mimeType: 'application/pdf',
        customMetadata: [
          { key: 'category', stringValue: category || 'Otro' },
          { key: 'version', stringValue: version || 'Vigente' },
          { key: 'shortName', stringValue: docDisplayName },
          { key: 'fileName', stringValue: fileName },
          { key: 'fileHash', stringValue: validation.fileHash },
          { key: 'estado', stringValue: estado || 'VIGENTE' },
          { key: 'docKey', stringValue: docKey },
        ],
      },
    });

    // Remove temp file
    try {
      if (tmpPath && fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
        tmpPath = null;
      }
    } catch {}

    // Resolve document resource name
    let docResourceName = '';
    if (operation.response?.documentName) {
      docResourceName = operation.response.documentName;
    } else {
      await new Promise((r) => setTimeout(r, 1500));
      const docsPager = await ai.fileSearchStores.documents.list({ parent: storeName });
      for await (const d of docsPager) {
        if (d.displayName === docDisplayName && d.name) {
          docResourceName = d.name;
          break;
        }
      }
    }

    if (!docResourceName) {
      docResourceName = operation.name?.replace('/upload/operations/', '/documents/') || `doc_${Date.now()}`;
    }

    const newDoc: DocumentMetadata = {
      id: docResourceName,
      name: docDisplayName,
      nombre: docDisplayName,
      category: category || '07 NEC (Construcción)',
      customCategory: category === 'Otro' || category === '16 Normativa Institucional / Otra' ? customCategory : undefined,
      tipoNorma: tipoNorma || 'Norma Oficial',
      numero: numero || '',
      version: version?.trim() || 'Vigente',
      registroOficial: registroOficial || '',
      fechaPublicacion: fechaPublicacion || '',
      fechaVigencia: fechaVigencia || '',
      ultimaReforma: ultimaReforma || '',
      estado: estado || 'VIGENTE',
      isActive: true,
      isHistorical: Boolean(isHistorical),
      source: source || 'Registro Oficial',
      sourceUrl: sourceUrl || '',
      issuingAuthority: issuingAuthority || 'República del Ecuador',
      description: description || '',
      fileName,
      fileSize: buffer.length,
      fileHash: validation.fileHash,
      pageCount: pageCount || undefined,
      isScanned: Boolean(isScanned),
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storeDocumentName: docResourceName,
      docKey,
      retrievalFilterKey: 'docKey',
      retrievalFilterValue: docKey,
      retrievalStatus: 'OK',
    };

    documentRepository.add(newDoc);
    logger.info(`Documento oficial "${docDisplayName}" indexado y registrado con éxito.`);
    res.json(newDoc);
  } catch (error: any) {
    if (tmpPath && fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
    }
    logger.error('Error in POST /api/documents:', error?.message);
    res.status(500).json({ error: error.message || 'Error al procesar y subir el documento al store.' });
  }
});

/**
 * PATCH /api/documents/toggle
 * ADMINISTRADOR SOLAMENTE: Activa o desactiva un documento.
 * FILTRADO REAL: Un documento desactivado queda excluido técnicamente de consultas.
 */
app.patch('/api/documents/toggle', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.body;
    if (!id) {
      res.status(400).json({ error: 'Se requiere el identificador del documento.' });
      return;
    }

    const updated = documentRepository.toggleActive(id);
    if (!updated) {
      res.status(404).json({ error: 'Documento no encontrado.' });
      return;
    }

    logger.info(`Estado activo cambiado para ${updated.name}: ${updated.isActive ? 'ACTIVO' : 'INACTIVO'}`);
    res.json({ success: true, doc: updated });
  } catch (error: any) {
    logger.error('Error in PATCH /api/documents/toggle:', error?.message);
    res.status(500).json({ error: 'Error al cambiar estado de activación del documento.' });
  }
});

/**
 * PATCH /api/documents/:id
 * ADMINISTRADOR SOLAMENTE: Edición de metadatos del documento.
 */
app.patch('/api/documents/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // Campos de identidad y de filtrado de recuperación no son editables desde la interfaz.
    const {
      id: _id,
      isActive: _isActive,
      docKey: _docKey,
      retrievalFilterKey: _rk,
      retrievalFilterValue: _rv,
      retrievalStatus: _rs,
      storeDocumentName: _sd,
      fileHash: _fh,
      ...updates
    } = req.body || {};

    if (!id) {
      res.status(400).json({ error: 'Identificador de documento no especificado.' });
      return;
    }

    const updated = documentRepository.update(id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Documento no encontrado.' });
      return;
    }

    logger.info(`Metadatos actualizados para documento ${id} (${updated.name}).`);
    res.json({ success: true, doc: updated });
  } catch (error: any) {
    logger.error('Error in PATCH /api/documents/:id:', error?.message);
    res.status(500).json({ error: 'Error al actualizar metadatos del documento.' });
  }
});

/**
 * DELETE /api/documents
 * ADMINISTRADOR SOLAMENTE: Elimina el documento tanto de FileSearchStore como del repositorio local.
 */
app.delete('/api/documents', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.body;
    if (!id) {
      res.status(400).json({ error: 'Se requiere el ID del documento a eliminar.' });
      return;
    }

    logger.info(`Eliminando documento del File Search Store: ${id}...`);
    try {
      await ai.fileSearchStores.documents.delete({ name: id });
    } catch (e: any) {
      logger.warn('Advertencia al eliminar del store de Gemini (puede no existir remotamente):', e?.message);
    }

    const deleted = documentRepository.delete(id);
    res.json({ success: deleted, deletedId: id });
  } catch (error: any) {
    logger.error('Error in DELETE /api/documents:', error?.message);
    res.status(500).json({ error: 'Error al eliminar el documento.' });
  }
});

// ----------------------------------------------------
// CONSULTATION & RETRIEVAL ENGINE (ACCESO LIBRE)
// ----------------------------------------------------

/**
 * Extracción heurística de respaldo de puntos clave en caso de fallo o timeout de LLM.
 */
function extractAlgorithmicKeyPoints(text: string): string[] {
  if (!text) return [];
  const clean = text.replace(/###\s*[^\n]+/g, '').replace(/\[(?:Documento|Pág)[^\]]+\]/g, '');
  const sentences = clean
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && !s.toLowerCase().startsWith('nota:'));

  if (sentences.length === 0) {
    return [text.slice(0, 160) + '...'];
  }

  const scored = sentences.map((s) => {
    let score = 0;
    if (/\b(?:art|artículo|numeral|ley|decreto|resolución|norma|nec|losncp|rglosncp)\b/i.test(s)) score += 3;
    if (/\b(?:\d+\s*(?:días|meses|años|%|cm|m|kg|mpa|dólares|usd))\b/i.test(s)) score += 3;
    if (/\b(?:deberá|obligatorio|fiscalizador|contratista|multa|sanción|garantía|anticipo|prohibición)\b/i.test(s)) score += 2;
    if (/\b(?:responsabilidad|plazo|recepción|planilla|especificación|control|aprobación)\b/i.test(s)) score += 2;
    return { sentence: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map((item) => item.sentence.replace(/^[-*•\s]+/, '').trim());
}

/**
 * Genera un resumen conciso de 3 a 5 puntos clave para facilitar la rápida comprensión
 * de normativas complejas en obra y fiscalización (NEC, LOSNCP, SERCOP, LOCGE).
 */
async function generateKeyPointsSummary(question: string, directAnswer: string): Promise<string[]> {
  try {
    const prompt = `Actúa como especialista técnico-jurídico en la normativa de la construcción (NEC) y contratación pública ecuatoriana (LOSNCP, SERCOP, Contraloría).
Genera un breve resumen de exactamente 3 a 5 PUNTOS CLAVE para facilitar la rápida comprensión de esta normativa técnica compleja por parte de un arquitecto o fiscalizador en obra pública.

CONSULTA: "${question.slice(0, 400)}"
RESPUESTA Y NORMATIVA ANALIZADA:
"${directAnswer.slice(0, 3000)}"

REGLAS ESTRICTAS:
- Devuelve EXACTAMENTE entre 3 y 5 viñetas, una por línea, comenzando cada una con un guion simple "- ".
- Cada punto debe ser sumamente claro, sintético y accionable (máximo 28 palabras).
- Destaca parámetros numéricos (plazos en días hábiles/término, porcentajes, resistencias de materiales, tolerancias), obligaciones ineludibles o responsabilidades de fiscalización/contratista.
- No incluyas títulos, introducciones, ni texto antes o después de las viñetas.`;

    const res = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const outputText = res.text || '';
    const lines = outputText
      .split('\n')
      .map((l) => l.replace(/^[-*•\d\.\s]+/, '').trim())
      .filter((l) => l.length > 10 && !l.toLowerCase().startsWith('ningun'));

    if (lines.length >= 2) {
      return lines.slice(0, 5);
    }
  } catch (err: any) {
    logger.warn('Fallo en generateKeyPointsSummary con Gemini, usando extracción algorítmica:', err?.message);
  }

  return extractAlgorithmicKeyPoints(directAnswer);
}

/**
 * POST /api/consultar
 * Motor de Consulta Normativo Técnico-Legal.
 * ACCESO LIBRE (No requiere contraseña).
 *
 * Cumple con:
 * 1. Filtrado Real de Documentos Activos (solo busca en activos y descarta evidencias de inactivos).
 * 2. 4 Capas Separadas: Respuesta, Fundamento Normativo, Aplicación al Caso, Observaciones/Advertencias.
 * 3. 3 Modos: Rápida, Análisis Normativo, Informe Técnico.
 * 4. Citas Literales Grounded con formato: [Documento] – Art./Numeral [X] – Pág. [N del PDF].
 * 5. Estados: FOUND, PARTIAL, NOT_FOUND, CONFLICT, INSUFFICIENT_EVIDENCE.
 * 6. Sin alucinaciones: si no existe evidencia, indica "No se encuentra en los documentos cargados."
 * 7. Resumen de Puntos Clave para rápida comprensión de normativas complejas.
 */
app.post('/api/consultar', aiRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const { question, mode = 'rapida', isHistorical = false } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'La pregunta no puede estar vacía.' });
      return;
    }

    // 1. FILTRADO TÉCNICO ESTRICTO: solo documentos activos y filtrables en el store.
    // El filtro se aplica EN la recuperación (metadataFilter), no después.
    const activeDocs = documentRepository.getRetrievableDocuments(Boolean(isHistorical));
    const metadataFilter = buildMetadataFilter(activeDocs);

    if (activeDocs.length === 0 || !metadataFilter) {
      res.status(400).json({
        error:
          'No existen documentos normativos activos y recuperables para realizar consultas. Carga o activa al menos un documento en la biblioteca (los documentos marcados "Requiere volver a subir" no participan en la recuperación).',
      });
      return;
    }

    const storeName = await getOrCreateFileSearchStore();

    const activeListText = activeDocs
      .map((d) => `• "${d.name}" (${d.tipoNorma || 'Norma'} | ${d.category} | Versión: ${d.version} | Estado: ${d.estado || 'VIGENTE'})`)
      .join('\n');

    // System prompt tailored for Ecuadorian public works architect & supervisor
    const consultationModePrompt =
      mode === 'informe'
        ? `MODO SOLICITADO: INFORME TÉCNICO FORMAL.
Estructura tu respuesta técnica en los siguientes acápites obligatorios, cada uno con encabezado "### " seguido del nombre del acápite:
1. ANTECEDENTES Y OBJETO: Contexto técnico de la consulta en obra pública o contratación.
2. BASE LEGAL Y NORMATIVA TÉCNICA: Identificación de las normas y artículos aplicables.
3. ANÁLISIS TÉCNICO-JURÍDICO: Examen riguroso de las disposiciones encontradas y su vinculación con la consulta.
4. FUNDAMENTO TÉCNICO DE OBRA: Repercusiones prácticas en fiscalización, recepción, costos, planos, calidad o garantías.
5. CONCLUSIONES Y RECOMENDACIONES: Criterio técnico categórico derivado estrictamente de las normas.`
        : mode === 'analisis'
        ? `MODO SOLICITADO: ANÁLISIS NORMATIVO DETALLADO.
Proporciona:
- Respuesta técnica directa y fundamentada.
- Una sección con encabezado "### APLICACIÓN PRÁCTICA AL CASO" sobre obra pública, arquitectura o fiscalización, basada solo en las disposiciones recuperadas.
- Observaciones y advertencias técnicas o limitaciones identificadas.`
        : `MODO SOLICITADO: CONSULTA RÁPIDA.
Responde de forma concisa, precisa y directa con lenguaje técnico-institucional de fiscalización.`;

    const systemInstruction = `Eres el "Consultor Normativo Ecuador (NEC · LOSNCP · SERCOP · Contraloría · Normativa Técnica)", un asesor técnico-legal de máximo rigor para un arquitecto de obra pública y fiscalizador en Ecuador.

DOCUMENTOS OFICIALES ACTIVOS EN LA BIBLIOTECA (ÚNICOS PERMITIDOS):
${activeListText}

CONSULTA DEL ARQUITECTO / FISCALIZADOR:
"${question.trim()}"

${consultationModePrompt}

REGLAS ESTRICTAS DE RESPETO A LA EVIDENCIA (PROHIBIDAS LAS ALUCINACIONES):
1. Responde ÚNICAMENTE con base en la información literal recuperada de los documentos activos listados arriba.
2. Si la información NO se encuentra en los documentos activos, responde exactamente con la frase inicial:
   "No se encuentra en los documentos cargados."
   Seguido de una breve orientación de qué norma del ordenamiento ecuatoriano podría contener la disposición, aclarando explícitamente: "(Nota: Sugerencia orientativa no verificada en los documentos cargados)".
3. NO inventes artículos, numerales, páginas, reformas, leyes ni contenido ausente en la evidencia.
4. No uses las palabras "contradicción" o "discrepancia" para declarar conflictos en el texto: los conflictos se reportan SOLO en la sección estructurada del punto 7.
5. Cita siempre el documento oficial, artículo o numeral correspondiente.
6. RESUMEN DE PUNTOS CLAVE: Al final de tu respuesta técnica, incluye obligatoriamente una sección con encabezado:
### PUNTOS CLAVE DE LA NORMATIVA
- [Punto clave 1: Regla fundamental o disposición técnica esencial]
- [Punto clave 2: Plazo legal, porcentaje, tolerancia o parámetro cuantitativo aplicable]
- [Punto clave 3: Obligación práctica o precaución indispensable para el fiscalizador/contratista en obra pública]
(Proporciona entre 3 y 5 viñetas concisas y directas para rápida comprensión).
7. CONTRADICCIONES: Al final, incluye obligatoriamente la sección:
### ${CONTRADICTIONS_HEADING}
seguida ÚNICAMENTE de un arreglo JSON. Si no hay conflictos reales entre disposiciones recuperadas, escribe []. Si los hay, un objeto por par en conflicto:
[{"normaA": "<nombre exacto del documento A tal como aparece en la lista>", "articuloA": "<Art./numeral A>", "normaB": "<nombre exacto del documento B>", "articuloB": "<Art./numeral B>", "descripcion": "<en qué consiste el conflicto>"}]
Solo incluye pares en los que ambos artículos estén en los fragmentos recuperados.`;

    // Attempt generateContent with File Search grounding
    let response: any = null;
    const modelsToTry = ['gemini-flash-latest', 'gemini-3.8-flash'];

    for (const model of modelsToTry) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: systemInstruction,
            config: {
              tools: [
                {
                  fileSearch: {
                    fileSearchStoreNames: [storeName],
                    metadataFilter,
                  },
                },
              ],
            },
          });
          if (response) break;
        } catch (err: any) {
          logger.warn(`Error llamando a Gemini (${model}, intento ${attempt + 1}):`, err.status || err.message);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          }
        }
      }
      if (response) break;
    }

    if (!response) {
      throw new Error('El servicio de consulta no pudo procesar la solicitud en este momento. Por favor reintenta en unos instantes.');
    }

    // Separar la sección estructurada de contradicciones antes de procesar el texto visible
    const { cleanText: generatedText, rawJson: contradictionsJson } = splitContradictionsSection(response.text || '');
    const candidate = response.candidates?.[0];
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];

    // MAPEO ESTRICTO DE EVIDENCIA: cada fragmento se atribuye solo a su documento de origen.
    // Si no se puede mapear de forma inequívoca a un documento activo, se DESCARTA (nunca se reasigna).
    const citationsByDocMap = new Map<string, CitationGroup>();
    const usedDocsSet = new Set<string>();
    let discardedChunks = 0;

    for (const chunk of groundingChunks) {
      const rc = chunk.retrievedContext as RetrievedContextLike | undefined;
      if (!rc || !rc.text) continue;

      const literalQuote = rc.text.trim();
      const matchedDoc = mapChunkToDoc(rc, activeDocs);

      if (!matchedDoc) {
        discardedChunks++;
        logger.warn(
          `Fragmento descartado: no se pudo mapear a un documento activo (title="${rc.title || ''}", uri="${rc.uri || ''}").`
        );
        continue;
      }

      const docName = matchedDoc.name;
      const category = matchedDoc.category;
      usedDocsSet.add(matchedDoc.id);

      // Página: "Pág. N del PDF" solo si la API la entrega; si no, "Pág.: no determinada"
      let pageNumberStr = 'Pág.: no determinada';
      if (rc.pageNumber !== undefined && rc.pageNumber !== null && Number(rc.pageNumber) > 0) {
        pageNumberStr = `Pág. ${rc.pageNumber} del PDF`;
      }

      // Artículo/numeral: si el fragmento contiene más de una referencia, se rotula como no determinado
      const articleOrNumeral = detectArticle(literalQuote);

      if (!citationsByDocMap.has(docName)) {
        citationsByDocMap.set(docName, {
          documentName: docName,
          category,
          citations: [],
        });
      }

      const group = citationsByDocMap.get(docName)!;
      if (!group.citations.some((c) => c.literalQuote === literalQuote)) {
        group.citations.push({
          documentName: docName,
          category,
          articleOrNumeral,
          pageNumber: pageNumberStr,
          literalQuote,
          // Verificada: texto literal de retrievedContext.text de un documento activo mapeado
          verified: true,
        });
      }
    }

    if (discardedChunks > 0) {
      logger.warn(`${discardedChunks} fragmento(s) descartado(s) por no poder atribuirse con certeza.`);
    }

    const citationsByDocument = Array.from(citationsByDocMap.values());
    const totalCitationsCount = citationsByDocument.reduce((acc, g) => acc + g.citations.length, 0);

    // Determine Evidence Status & Confidence Level
    const notFoundRegex = /no se encuentra en los documentos/i;
    const isNotFound =
      notFoundRegex.test(generatedText) ||
      (citationsByDocument.length === 0 && generatedText.toLowerCase().includes('no se encuentra'));

    let status: EvidenceStatus = 'FOUND';
    let confidenceLevel: 'ALTO' | 'PARCIAL' | 'INSUFICIENTE' = 'ALTO';
    let confidenceLabel = `RESPALDO ALTO · ${totalCitationsCount} citas literales recuperadas`;

    if (isNotFound) {
      status = 'NOT_FOUND';
      confidenceLevel = 'INSUFICIENTE';
      confidenceLabel = 'SIN RESPALDO EN DOCUMENTOS ACTIVOS';
    } else if (totalCitationsCount === 0) {
      status = 'INSUFFICIENT_EVIDENCE';
      confidenceLevel = 'INSUFICIENTE';
      confidenceLabel = 'EVIDENCIA INSUFICIENTE RECUPERADA';
    } else if (totalCitationsCount < 2) {
      status = 'PARTIAL';
      confidenceLevel = 'PARCIAL';
      confidenceLabel = `RESPALDO PARCIAL · ${totalCitationsCount} cita recuperada`;
    }

    // Contradicciones: solo a partir de la sección estructurada y validadas contra la evidencia recuperada
    const contradictionItems: ContradictionItem[] = validateContradictions(contradictionsJson, citationsByDocument);
    let contradictionsText: string | null = null;

    if (contradictionItems.length > 0) {
      status = 'CONFLICT';
      contradictionsText = contradictionItems
        .map((c) => `${c.normA} (${c.articleA}) frente a ${c.normB} (${c.articleB}): ${c.observation || 'conflicto señalado por el modelo; revisar ambos textos literales.'}`)
        .join('\n');
      confidenceLabel = 'CONTRADICCIÓN NORMATIVA CON RESPALDO EN AMBAS CITAS';
    }

    let directAnswer = generatedText;
    let unverifiedSuggestion: string | null = null;
    let keyPointsSummary: string[] = [];

    // Extracción de la sección de Puntos Clave si fue generada con encabezado en generatedText
    const keyPointsSectionMatch = generatedText.match(/(?:###\s*PUNTOS CLAVE[^\n]*|PUNTOS CLAVE DE LA NORMATIVA|PUNTOS CLAVE)[:\s]*([\s\S]*?)(?=(?:\n###|\n[1-9]\.|\nCITAS|\nFUNDAMENTO|$))/i);
    if (keyPointsSectionMatch && keyPointsSectionMatch[1]) {
      const parsedBullets = keyPointsSectionMatch[1]
        .split('\n')
        .map((l: string) => l.replace(/^[-*•\d\.\s]+/, '').trim())
        .filter((l: string) => l.length > 8 && !l.toLowerCase().startsWith('ningun'));
      if (parsedBullets.length >= 2) {
        keyPointsSummary = parsedBullets.slice(0, 5);
        // Limpiamos la sección de puntos clave de directAnswer para no duplicarla
        directAnswer = directAnswer.replace(/(?:###\s*PUNTOS CLAVE[^\n]*|PUNTOS CLAVE DE LA NORMATIVA|PUNTOS CLAVE)[:\s]*[\s\S]*?(?=(?:\n###|\n[1-9]\.|\nCITAS|\nFUNDAMENTO|$))/i, '').trim();
      }
    }

    if (isNotFound) {
      directAnswer = 'No se encuentra en los documentos cargados.';
      const suggestionMatch = generatedText.match(/(?:sugerencia|podría contenerla|orientativ|norma)[\s\S]*/i);
      if (suggestionMatch && !suggestionMatch[0].startsWith('No se encuentra')) {
        unverifiedSuggestion = suggestionMatch[0].trim();
      } else {
        unverifiedSuggestion =
          'Se sugiere verificar en otras normas del marco técnico-jurídico ecuatoriano (ej. normas INEN, ordenanzas cantonales del GAD correspondiente o COA). (Nota: Sugerencia orientativa no verificada en los documentos cargados).';
      }

      keyPointsSummary = [];
    } else if (keyPointsSummary.length === 0) {
      // Si el modelo no generó los puntos clave en el formato exacto, generarlos con el sintetizador
      keyPointsSummary = await generateKeyPointsSummary(question, directAnswer);
    }

    // Sin texto fijo presentado como análisis: la aplicación al caso solo existe si el modelo la desarrolló
    // en su respuesta (modo análisis). Nada se inventa en el servidor.
    const caseApplicationText =
      status === 'FOUND' || status === 'PARTIAL' || status === 'CONFLICT'
        ? extractSection(generatedText, /^APLICACI[ÓO]N (PR[ÁA]CTICA )?AL CASO/i)
        : '';
    const caseApplication = caseApplicationText || undefined;

    const observations = `${GENERAL_GUIDANCE_LABEL}: herramienta de apoyo. Verifique siempre los artículos y textos literales en el documento oficial publicado en el Registro Oficial.`;

    // Informe técnico: solo secciones desarrolladas por el modelo en su respuesta; si no existen, quedan vacías.
    let technicalReport: TechnicalReportStructure | undefined;
    if (mode === 'informe' && !isNotFound) {
      const usedDocsForReport = activeDocs.filter((d) => usedDocsSet.has(d.id));
      technicalReport = {
        antecedentes: `Consulta planteada: "${question.trim()}".`,
        objeto: extractSection(generatedText, /^ANTECEDENTES Y OBJETO/i),
        baseLegal: usedDocsForReport.map((d) => `${d.name} (${d.tipoNorma || 'Norma'} - ${d.version})`).join('; '),
        analisis: directAnswer,
        fundamentoTecnico: extractSection(generatedText, /^FUNDAMENTO T[ÉE]CNICO/i),
        conclusiones: extractSection(generatedText, /^CONCLUSIONES/i),
        recomendaciones: '',
      };
    }

    // Used vs Unused documents list
    const usedDocuments = activeDocs
      .filter((d) => usedDocsSet.has(d.id))
      .map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        version: d.version,
        isOfficial: true,
      }));

    const unusedDocuments = activeDocs
      .filter((d) => !usedDocsSet.has(d.id))
      .map((d) => ({
        id: d.id,
        name: d.name,
      }));

    // Formatted raw text for clipboard copying
    let rawFormattedText = `CONSULTOR NORMATIVO ECUADOR\nNEC · LOSNCP · SERCOP · CONTRALORÍA\n\n`;
    rawFormattedText += `CONSULTA: ${question.trim()}\n`;
    rawFormattedText += `ESTADO DE EVIDENCIA: ${confidenceLabel}\n\n`;
    rawFormattedText += `RESPUESTA TÉCNICA:\n${directAnswer}\n\n`;

    if (keyPointsSummary.length > 0) {
      rawFormattedText += `PUNTOS CLAVE DE LA NORMATIVA:\n`;
      keyPointsSummary.forEach((p) => {
        rawFormattedText += `• ${p}\n`;
      });
      rawFormattedText += `\n`;
    }

    if (contradictionsText) {
      rawFormattedText += `CONTRADICCIÓN NORMATIVA:\n${contradictionsText}\n\n`;
    }

    if (unverifiedSuggestion) {
      rawFormattedText += `SUGERENCIA ORIENTATIVA:\n${unverifiedSuggestion}\n\n`;
    }

    if (citationsByDocument.length > 0) {
      rawFormattedText += `FUNDAMENTO NORMATIVO (Citas Literales):\n`;
      citationsByDocument.forEach((group) => {
        rawFormattedText += `\n[${group.documentName} - ${group.category}]\n`;
        group.citations.forEach((c) => {
          rawFormattedText += `[${c.documentName}] – ${c.articleOrNumeral} – ${c.pageNumber}\n`;
          rawFormattedText += `Texto literal: "${c.literalQuote}"\n\n`;
        });
      });
    }

    rawFormattedText += `DOCUMENTOS CONSULTADOS: ${activeDocs.map((d) => d.name).join(', ')}\n`;
    rawFormattedText += `Herramienta de apoyo. Verifique siempre las citas en el documento oficial.`;

    const resultPayload: ConsultationResponse = {
      status,
      confidenceLevel,
      confidenceLabel,
      mode: mode as ConsultationMode,
      directAnswer,
      keyPointsSummary,
      foundInDocuments: !isNotFound && totalCitationsCount > 0,
      unverifiedSuggestion,
      contradictions: contradictionsText,
      contradictionItems,
      citationsByDocument,
      caseApplication,
      observations,
      technicalReport,
      rawFormattedText,
      usedDocuments,
      unusedDocuments,
      queryDate: new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(new Date()),
      searchedDocuments: activeDocs.map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        version: d.version,
      })),
    };

    res.json(resultPayload);
  } catch (error: any) {
    logger.error('Error in /api/consultar:', error?.message);
    res.status(500).json({
      error: error.message || 'Error al procesar la consulta con Gemini File Search.',
    });
  }
});

/**
 * POST /api/generar-resumen-puntos-clave
 * Genera o actualiza un breve resumen de puntos clave a partir de una respuesta técnica
 * para facilitar la rápida comprensión de normativas complejas en obra.
 */
app.post('/api/generar-resumen-puntos-clave', aiRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const { question, directAnswer } = req.body;
    if (!directAnswer || typeof directAnswer !== 'string' || !directAnswer.trim()) {
      res.status(400).json({ error: 'Se requiere el contenido de directAnswer para generar los puntos clave.' });
      return;
    }
    if (directAnswer.trim().length > 30000) {
      res.status(400).json({ error: 'El contenido supera el máximo de 30.000 caracteres.' });
      return;
    }

    const keyPoints = await generateKeyPointsSummary(question || 'Consulta normativa técnica', directAnswer.trim());
    res.json({
      success: true,
      keyPoints,
    });
  } catch (error: any) {
    logger.error('Error in /api/generar-resumen-puntos-clave:', error?.message);
    res.status(500).json({
      error: error.message || 'Error al generar el resumen de puntos clave.',
    });
  }
});

/**
 * POST /api/consultar-articulo
 * Consulta directa de un artículo dentro de UN cuerpo normativo activo.
 * La recuperación se filtra solo a ese documento y el estado FOUND exige un fragmento
 * de ese documento que contenga el artículo solicitado.
 * (La ruta /api/buscar se eliminó: no estaba conectada a la interfaz.)
 */
app.post('/api/consultar-articulo', aiRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const { norma, normaId, articulo } = req.body || {};
    if ((!norma && !normaId) || !articulo || typeof articulo !== 'string' || !articulo.trim()) {
      res.status(400).json({ error: 'Debe especificar el cuerpo normativo y el número de artículo.' });
      return;
    }

    const retrievable = documentRepository.getRetrievableDocuments(true);
    let doc: DocumentMetadata | undefined;
    if (normaId) {
      doc = retrievable.find((d) => d.id === normaId);
    } else {
      const byName = retrievable.filter((d) => d.name.trim().toLowerCase() === String(norma).trim().toLowerCase());
      if (byName.length > 1) {
        res.status(400).json({ error: 'Existe más de un documento activo con ese nombre. Seleccione el documento desde la lista.' });
        return;
      }
      doc = byName[0];
    }

    if (!doc) {
      res.status(404).json({
        error: 'La norma solicitada no existe, está inactiva o requiere volver a subirse, por lo que no puede consultarse.',
      });
      return;
    }

    const metadataFilter = buildMetadataFilter([doc]);
    if (!metadataFilter) {
      res.status(400).json({ error: 'El documento no tiene clave de filtrado en el store. Debe volver a subirse.' });
      return;
    }

    const storeName = await getOrCreateFileSearchStore();
    const art = articulo.trim();
    const prompt = `Localiza textualmente el ${art} en la norma "${doc.name}". Transcribe el texto íntegro encontrado. Si no aparece en los fragmentos recuperados, responde exactamente: "No se encuentra en los documentos cargados."`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [storeName],
              metadataFilter,
            },
          },
        ],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const match = chunks
      .map((c: any) => c.retrievedContext as RetrievedContextLike | undefined)
      .find((rc) => rc?.text && mapChunkToDoc(rc, [doc!])?.id === doc!.id && textContainsArticle(rc.text, art));

    if (!match) {
      res.json({
        norma: doc.name,
        articulo: art,
        status: 'NOT_FOUND',
        textoEncontrado: 'No se encuentra en los documentos cargados.',
        pagina: 'Pág.: no determinada',
        interpretacion: null,
      });
      return;
    }

    res.json({
      norma: doc.name,
      articulo: art,
      status: 'FOUND',
      textoEncontrado: match.text!.trim(),
      pagina: match.pageNumber && Number(match.pageNumber) > 0 ? `Pág. ${match.pageNumber} del PDF` : 'Pág.: no determinada',
      interpretacion: response.text || null,
    });
  } catch (error: any) {
    logger.error('Error in /api/consultar-articulo:', error?.message);
    res.status(500).json({ error: 'Error al consultar el artículo especificado.' });
  }
});

/**
 * Reconciliación del registro local con el File Search Store (fuente de verdad de los documentos).
 * - Entradas locales sin documento real en el store: se eliminan (si el listado remoto trae documentos)
 *   o se marcan NO_EXISTE_EN_STORE (si el listado viene vacío, por prudencia).
 * - Documentos del store sin registro local: se restauran INACTIVOS y PENDIENTE_REVISION,
 *   para no reactivar sin revisión una norma que el administrador pudo haber desactivado.
 * - Clave de filtrado: docKey del store; en su defecto fileHash (documentos heredados);
 *   sin ninguna, SIN_CLAVE (excluido de la recuperación hasta volver a subirlo).
 */
async function reconcileWithStore(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY no configurada: se omite la reconciliación con el File Search Store.');
    return;
  }

  const storeName = await getOrCreateFileSearchStore();
  const remote = new Map<string, { displayName?: string; customMetadata?: { key?: string; stringValue?: string }[]; sizeBytes?: string; createTime?: string }>();
  const pager = await ai.fileSearchStores.documents.list({ parent: storeName });
  for await (const d of pager) {
    if (d.name) remote.set(d.name, d);
  }

  const mdValue = (md: { key?: string; stringValue?: string }[] | undefined, k: string) =>
    md?.find((m) => m.key === k)?.stringValue;

  const localByStoreName = new Map<string, DocumentMetadata>();
  for (const doc of documentRepository.getAll()) {
    const storeDocName = doc.storeDocumentName || doc.id;
    localByStoreName.set(storeDocName, doc);
    const r = remote.get(storeDocName);

    if (!r) {
      if (remote.size > 0) {
        documentRepository.delete(doc.id);
        logger.warn(`Reconciliación: "${doc.name}" (${storeDocName}) no existe en el File Search Store. Entrada local eliminada.`);
      } else if (doc.retrievalStatus !== 'NO_EXISTE_EN_STORE') {
        documentRepository.update(doc.id, { retrievalStatus: 'NO_EXISTE_EN_STORE' });
        logger.warn(`Reconciliación: el store no devolvió documentos; "${doc.name}" marcado NO_EXISTE_EN_STORE.`);
      }
      continue;
    }

    const docKey = mdValue(r.customMetadata, 'docKey');
    const fileHash = mdValue(r.customMetadata, 'fileHash');
    const updates: Partial<DocumentMetadata> = {};
    if (docKey) {
      Object.assign(updates, { docKey, retrievalFilterKey: 'docKey', retrievalFilterValue: docKey, retrievalStatus: 'OK' });
    } else if (fileHash) {
      Object.assign(updates, { retrievalFilterKey: 'fileHash', retrievalFilterValue: fileHash, retrievalStatus: 'OK' });
      if (!doc.fileHash) updates.fileHash = fileHash;
    } else {
      Object.assign(updates, { retrievalFilterKey: undefined, retrievalFilterValue: undefined, retrievalStatus: 'SIN_CLAVE' });
      logger.warn(`Reconciliación: "${doc.name}" no tiene docKey ni fileHash en el store. Debe volver a subirse para participar en consultas.`);
    }

    const changed = (Object.keys(updates) as (keyof DocumentMetadata)[]).some((k) => doc[k] !== updates[k]);
    if (changed) documentRepository.update(doc.id, updates);
  }

  for (const [name, r] of remote) {
    if (localByStoreName.has(name)) continue;
    const md = r.customMetadata;
    const docKey = mdValue(md, 'docKey');
    const fileHash = mdValue(md, 'fileHash');
    const displayName = r.displayName || mdValue(md, 'shortName') || name;
    const now = new Date().toISOString();
    documentRepository.add({
      id: name,
      name: displayName,
      nombre: displayName,
      category: mdValue(md, 'category') || 'Otro',
      version: mdValue(md, 'version') || 'No verificada',
      estado: (mdValue(md, 'estado') as DocumentMetadata['estado']) || 'NO_VERIFICADA',
      fileName: mdValue(md, 'fileName') || `${displayName}.pdf`,
      fileSize: Number(r.sizeBytes) || 0,
      fileHash: fileHash || '',
      isActive: false,
      isHistorical: false,
      uploadedAt: r.createTime || now,
      updatedAt: now,
      storeDocumentName: name,
      docKey,
      retrievalFilterKey: docKey ? 'docKey' : fileHash ? 'fileHash' : undefined,
      retrievalFilterValue: docKey || fileHash || undefined,
      retrievalStatus: docKey || fileHash ? 'PENDIENTE_REVISION' : 'SIN_CLAVE',
    });
    logger.warn(`Reconciliación: documento del store sin registro local restaurado INACTIVO para revisión: "${displayName}".`);
  }

  logger.info(`Reconciliación completada: ${remote.size} documento(s) en el store, ${documentRepository.getAll().length} en el registro.`);
}

// Production and Vite middleware
async function startServer() {
  if (!process.env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY no está configurada. Las consultas con IA y la administración documental permanecerán inactivas hasta configurar el Secret.');
  }

  try {
    await reconcileWithStore();
  } catch (err: any) {
    logger.error('No se pudo reconciliar el registro con el File Search Store:', err?.message);
  }

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    logger.info(`Servidor Consultor Normativo Ecuador escuchando en http://0.0.0.0:${PORT}`);
    if (authService.isAdminPasswordConfigured()) {
      logger.info('ADMIN_PASSWORD configurado correctamente en Secrets.');
    } else {
      logger.warn('ADMIN_PASSWORD no está configurado en Secrets. Las funciones de administración documental estarán deshabilitadas hasta configurar el Secret.');
    }
  });
}

startServer();
