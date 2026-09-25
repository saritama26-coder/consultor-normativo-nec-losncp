export type UserRole = 'usuario' | 'administrador';

export interface UserSession {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  token: string;
  expiresAt: string;
}

export type NormativeStatus =
  | 'VIGENTE'
  | 'REFORMADA'
  | 'DEROGADA'
  | 'PARCIALMENTE_REFORMADA'
  | 'HISTÓRICA'
  | 'NO_VERIFICADA';

export type NormativeCategory =
  | '01 Constitución'
  | '02 Contratación Pública'
  | '03 LOSNCP'
  | '04 RGLOSNCP'
  | '05 SERCOP'
  | '06 Contraloría (LOCGE)'
  | '07 NEC (Construcción)'
  | '08 INEN'
  | '09 Seguridad y Salud'
  | '10 Accesibilidad'
  | '11 Ambiente'
  | '12 ARCSA'
  | '13 Bomberos'
  | '14 COOTAD (GADs)'
  | '15 Ordenanzas'
  | '16 Normativa Institucional / Otra'
  | 'CRE'
  | 'NEC'
  | 'LOSNCP'
  | 'RGLOSNCP'
  | 'LOCGE'
  | 'COOTAD'
  | 'COA'
  | 'Ley'
  | 'Otro';

export interface PDFPageContent {
  pageNumber: number;
  text: string;
}

export interface NormativeDocument {
  id: string; // Identificador único (resource name de Gemini o ID interno)
  name: string; // Nombre corto oficial (ej. "LOSNCP Reformada 2024")
  nombre?: string; // Alias para compatibilidad técnica
  category: NormativeCategory | string;
  customCategory?: string;
  version: string; // Ej. "Codificación 2024" o "Edición 2015"
  fileName: string;
  fileSize: number;
  pageCount?: number;
  isScanned?: boolean; // Aviso si el PDF contiene poco texto seleccionable
  isActive: boolean; // Activo para consultas (documentos inactivos quedan estrictamente excluidos)
  uploadedAt: string;
  updatedAt?: string;
  fileHash?: string; // Hash SHA-256 para control de integridad y duplicados
  tipoNorma?: string; // Ley Orgánica, Decreto Ejecutivo, Resolución SERCOP, Norma Técnica NEC, etc.
  numero?: string;
  registroOficial?: string;
  fechaPublicacion?: string;
  fechaVigencia?: string;
  ultimaReforma?: string;
  estado?: NormativeStatus;
  isHistorical?: boolean;
  source?: string;
  sourceUrl?: string;
  officialSource?: string;
  issuingAuthority?: string;
  description?: string;
  storeDocumentName?: string;
  /** Clave estable propia (UUID) enviada como customMetadata "docKey" al File Search Store. */
  docKey?: string;
  /** Campo de customMetadata usado para filtrar la recuperación (docKey; fileHash solo para documentos heredados). */
  retrievalFilterKey?: 'docKey' | 'fileHash';
  retrievalFilterValue?: string;
  /**
   * Estado de recuperabilidad frente al File Search Store:
   * OK: filtrable y existente. SIN_CLAVE: sin docKey/fileHash en el store (debe volver a subirse).
   * NO_EXISTE_EN_STORE: el registro local no tiene documento real en el store.
   * PENDIENTE_REVISION: documento hallado en el store sin registro local (restaurado inactivo).
   */
  retrievalStatus?: 'OK' | 'SIN_CLAVE' | 'NO_EXISTE_EN_STORE' | 'PENDIENTE_REVISION';
}

export type DocumentMetadata = NormativeDocument;

export type ConsultationMode = 'rapida' | 'analisis' | 'informe';

export type EvidenceStatus =
  | 'FOUND'
  | 'PARTIAL'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_EVIDENCE';

export interface EvidenceCitation {
  documentName: string;
  documentType?: string;
  registryOfficial?: string;
  article: string; // Ej. "Art. 74", "Art. 92 numeral 2"
  numeral?: string;
  literal?: string;
  chapter?: string;
  section?: string;
  disposition?: string;
  pagePdf: string; // "Pág. 15 del PDF" o estrictamente "Pág.: no determinada"
  pageOfficial?: string; // "Pág. 8 del Registro Oficial" cuando conste
  quote: string; // Fragmento literal exacto tomado del grounding
  source?: string;
  verified: boolean; // Si el fragmento coincide con la evidencia recuperada
}

export interface DocumentCitationsGroup {
  documentName: string;
  documentType?: string;
  category: string;
  version?: string;
  citations: CitationItem[];
}

export interface CitationItem {
  documentName: string;
  category: string;
  articleOrNumeral: string;
  pageNumber: string;
  literalQuote: string;
  verified?: boolean;
}

export interface CitationGroup {
  documentName: string;
  category: string;
  citations: CitationItem[];
}

export interface ContradictionItem {
  normA: string;
  articleA: string;
  contentA: string;
  normB: string;
  articleB: string;
  contentB: string;
  relationType:
    | 'CONTRADICCIÓN'
    | 'COMPLEMENTARIEDAD'
    | 'REFORMA'
    | 'NORMA_POSTERIOR'
    | 'NORMA_ESPECIAL'
    | 'NORMA_GENERAL'
    | 'RELACIÓN_DIRECTA';
  observation: string;
}

export interface TechnicalReportStructure {
  antecedentes: string;
  objeto: string;
  baseLegal: string;
  analisis: string;
  fundamentoTecnico: string;
  conclusiones: string;
  recomendaciones: string;
}

export interface ConsultationResponse {
  directAnswer: string;
  foundInDocuments: boolean;
  unverifiedSuggestion: string | null;
  contradictions: string | null;
  citationsByDocument: CitationGroup[];
  rawFormattedText?: string;
  searchedDocuments?: {
    id: string;
    name: string;
    category: string;
    version: string;
  }[];
  // Enhanced evidence & structured consultation fields
  status?: EvidenceStatus;
  confidenceLevel?: 'ALTO' | 'PARCIAL' | 'INSUFICIENTE';
  confidenceLabel?: string;
  mode?: ConsultationMode;
  caseApplication?: string;
  observations?: string;
  technicalReport?: TechnicalReportStructure;
  contradictionItems?: ContradictionItem[];
  relatedNorms?: string[];
  warnings?: string[];
  usedDocuments?: { id: string; name: string; category: string; version: string; isOfficial?: boolean }[];
  unusedDocuments?: { id: string; name: string }[];
  queryDate?: string;
  keyPointsSummary?: string[]; // Breve resumen de puntos clave para comprensión rápida de normativas complejas
}

export type StructuredConsultationResponse = ConsultationResponse;

export interface ConsultationHistoryItem {
  id: string;
  question: string;
  response: ConsultationResponse;
  timestamp: string;
  documentNames: string[];
  mode?: ConsultationMode;
  tags?: string[];
}

export interface DirectArticleQueryResult {
  norma: string;
  articulo: string;
  status: 'FOUND' | 'NOT_FOUND';
  textoEncontrado?: string;
  interpretacion?: string;
  normativaRelacionada?: string[];
  reformasRelacionadas?: string[];
  fuente?: string;
  pagina?: string;
  rawResponse?: string;
}

export interface NormativeBookmark {
  id: string;
  documentName: string;
  category: string;
  articleOrNumeral: string;
  pageNumber: string;
  excerpt: string;
  questionContext?: string;
  projectName?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}
