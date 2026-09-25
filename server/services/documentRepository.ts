import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DocumentMetadata, NormativeStatus } from '../types';
import { logger } from '../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Ruta configurable: permite apuntar a un volumen persistente (p. ej. Cloud Storage montado)
// para que el registro sobreviva a redespliegues del contenedor.
const DOCS_STATE_FILE = process.env.DOCS_STATE_FILE
  ? path.resolve(process.env.DOCS_STATE_FILE)
  : path.resolve(__dirname, '../../server-docs-state.json');

class DocumentRepository {
  private docs: Map<string, DocumentMetadata> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(DOCS_STATE_FILE)) {
        const raw = fs.readFileSync(DOCS_STATE_FILE, 'utf8');
        const data = JSON.parse(raw);

        // Migrate any previous schema to complete DocumentMetadata
        for (const [key, val] of Object.entries(data)) {
          const item = val as any;
          const migrated: DocumentMetadata = {
            id: item.id || key,
            name: item.name || item.nombre || 'Documento Normativo',
            nombre: item.nombre || item.name || 'Documento Normativo',
            tipoNorma: item.tipoNorma || 'Norma Oficial',
            numero: item.numero || '',
            version: item.version || 'Vigente',
            fechaPublicacion: item.fechaPublicacion || '',
            registroOficial: item.registroOficial || '',
            fechaVigencia: item.fechaVigencia || '',
            ultimaReforma: item.ultimaReforma || '',
            estado: (item.estado as NormativeStatus) || 'VIGENTE',
            isActive: item.isActive !== undefined ? item.isActive : true,
            isHistorical: Boolean(item.isHistorical),
            source: item.source || 'Registro Oficial',
            sourceUrl: item.sourceUrl || '',
            officialSource: item.officialSource || '',
            issuingAuthority: item.issuingAuthority || 'República del Ecuador',
            fileHash: item.fileHash || '',
            pageCount: item.pageCount,
            isScanned: Boolean(item.isScanned),
            description: item.description || '',
            category: item.category || 'Otro',
            customCategory: item.customCategory,
            fileName: item.fileName || 'documento.pdf',
            fileSize: item.fileSize || 0,
            uploadedAt: item.uploadedAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString(),
            storeDocumentName: item.storeDocumentName || item.id,
            docKey: item.docKey,
            retrievalFilterKey: item.retrievalFilterKey,
            retrievalFilterValue: item.retrievalFilterValue,
            retrievalStatus: item.retrievalStatus,
          };
          this.docs.set(migrated.id, migrated);
        }
        logger.info(`Cargados ${this.docs.size} documentos normativos en memoria.`);
      }
    } catch (err: any) {
      logger.error('Error cargando server-docs-state.json:', err.message);
    }
  }

  private save(): void {
    try {
      const obj: Record<string, DocumentMetadata> = {};
      for (const [key, val] of this.docs.entries()) {
        obj[key] = val;
      }
      fs.writeFileSync(DOCS_STATE_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err: any) {
      logger.error('Error guardando server-docs-state.json:', err.message);
    }
  }

  getAll(): DocumentMetadata[] {
    return Array.from(this.docs.values());
  }

  getById(id: string): DocumentMetadata | undefined {
    return this.docs.get(id);
  }

  getActiveDocuments(includeHistorical = false): DocumentMetadata[] {
    return Array.from(this.docs.values()).filter((doc) => {
      if (!doc.isActive) return false;
      if (!includeHistorical && doc.isHistorical) return false;
      return true;
    });
  }

  /**
   * Documentos activos que además pueden filtrarse de forma real en el File Search Store
   * (tienen clave de filtro y existen en el store). Solo estos se usan en la recuperación.
   */
  getRetrievableDocuments(includeHistorical = false): DocumentMetadata[] {
    return this.getActiveDocuments(includeHistorical).filter(
      (doc) => Boolean(doc.retrievalFilterKey && doc.retrievalFilterValue) && (doc.retrievalStatus ?? 'OK') === 'OK'
    );
  }

  // Duplicate detection by fileHash
  findByHash(fileHash: string): DocumentMetadata | undefined {
    if (!fileHash) return undefined;
    for (const doc of this.docs.values()) {
      if (doc.fileHash && doc.fileHash.toLowerCase() === fileHash.toLowerCase()) {
        return doc;
      }
    }
    return undefined;
  }

  add(doc: DocumentMetadata): void {
    this.docs.set(doc.id, doc);
    this.save();
    logger.info(`Documento guardado: ${doc.nombre} (${doc.id})`);
  }

  update(id: string, updates: Partial<DocumentMetadata>): DocumentMetadata | null {
    const existing = this.docs.get(id);
    if (!existing) return null;

    const updated: DocumentMetadata = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.docs.set(id, updated);
    this.save();
    return updated;
  }

  toggleActive(id: string): DocumentMetadata | null {
    const existing = this.docs.get(id);
    if (!existing) return null;

    existing.isActive = !existing.isActive;
    // Activación explícita por el administrador de un documento restaurado desde el store
    if (existing.isActive && existing.retrievalStatus === 'PENDIENTE_REVISION' && existing.retrievalFilterValue) {
      existing.retrievalStatus = 'OK';
    }
    existing.updatedAt = new Date().toISOString();
    this.docs.set(id, existing);
    this.save();
    return existing;
  }

  delete(id: string): boolean {
    const deleted = this.docs.delete(id);
    if (deleted) {
      this.save();
      logger.info(`Documento eliminado del repositorio: ${id}`);
    }
    return deleted;
  }
}

export const documentRepository = new DocumentRepository();
