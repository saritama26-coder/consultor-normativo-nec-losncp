import { get, set, del } from 'idb-keyval';
import { ConsultationHistoryItem, NormativeBookmark, SavedQuery } from '../types/normative';

const HISTORY_KEY = 'consultor_normativo_history';
const BOOKMARKS_KEY = 'consultor_normativo_bookmarks_v1';
const SAVED_QUERIES_KEY = 'consultor_normativo_saved_queries_v1';

/**
 * IndexedDB se utiliza exclusivamente para almacenar el historial local de consultas
 * realizadas por el usuario en este navegador.
 */
export async function getConsultationHistory(): Promise<ConsultationHistoryItem[]> {
  try {
    const history = await get<ConsultationHistoryItem[]>(HISTORY_KEY);
    return history || [];
  } catch (error) {
    console.error('Error reading history from IndexedDB:', error);
    return [];
  }
}

export async function addConsultationHistoryItem(item: ConsultationHistoryItem): Promise<void> {
  try {
    const current = await getConsultationHistory();
    const updated = [item, ...current.slice(0, 49)]; // Máximo 50 consultas recientes
    await set(HISTORY_KEY, updated);
  } catch (error) {
    console.error('Error saving history to IndexedDB:', error);
  }
}

export async function deleteConsultationHistoryItem(id: string): Promise<void> {
  try {
    const current = await getConsultationHistory();
    const updated = current.filter((h) => h.id !== id);
    await set(HISTORY_KEY, updated);
  } catch (error) {
    console.error('Error deleting history item from IndexedDB:', error);
  }
}

export async function updateConsultationHistoryItem(
  id: string,
  updatedData: Partial<ConsultationHistoryItem>
): Promise<void> {
  try {
    const current = await getConsultationHistory();
    const updated = current.map((h) => (h.id === id ? { ...h, ...updatedData } : h));
    await set(HISTORY_KEY, updated);
  } catch (error) {
    console.error('Error updating history item in IndexedDB:', error);
  }
}

export async function clearConsultationHistory(): Promise<void> {
  try {
    await del(HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing history from IndexedDB:', error);
  }
}

/**
 * Funcionalidad de Marcadores (Bookmarks):
 * Permite guardar fragmentos normativos específicos citando documento y artículo
 * para referencia rápida en futuros proyectos.
 */
export async function getBookmarks(): Promise<NormativeBookmark[]> {
  try {
    const bookmarks = await get<NormativeBookmark[]>(BOOKMARKS_KEY);
    if (bookmarks && Array.isArray(bookmarks)) return bookmarks;
    
    // Fallback a localStorage si IndexedDB no tuviese datos aún
    const local = localStorage.getItem(BOOKMARKS_KEY);
    return local ? JSON.parse(local) : [];
  } catch (error) {
    console.error('Error reading bookmarks from IndexedDB:', error);
    try {
      const local = localStorage.getItem(BOOKMARKS_KEY);
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  }
}

export async function saveBookmark(bookmark: NormativeBookmark): Promise<void> {
  try {
    const current = await getBookmarks();
    // Reemplazar si ya existe o añadir al inicio
    const existingIndex = current.findIndex((b) => b.id === bookmark.id);
    let updated: NormativeBookmark[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...bookmark, updatedAt: new Date().toISOString() };
    } else {
      updated = [{ ...bookmark, createdAt: bookmark.createdAt || new Date().toISOString() }, ...current];
    }
    await set(BOOKMARKS_KEY, updated);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving bookmark to IndexedDB:', error);
    // Fallback localStorage
    try {
      const current = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
      const filtered = current.filter((b: NormativeBookmark) => b.id !== bookmark.id);
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([bookmark, ...filtered]));
    } catch (e) {
      console.error('Fallback localStorage error:', e);
    }
  }
}

export async function deleteBookmark(id: string): Promise<void> {
  try {
    const current = await getBookmarks();
    const updated = current.filter((b) => b.id !== id);
    await set(BOOKMARKS_KEY, updated);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error deleting bookmark:', error);
  }
}

export async function updateBookmark(
  id: string,
  updatedData: Partial<NormativeBookmark>
): Promise<void> {
  try {
    const current = await getBookmarks();
    const updated = current.map((b) =>
      b.id === id ? { ...b, ...updatedData, updatedAt: new Date().toISOString() } : b
    );
    await set(BOOKMARKS_KEY, updated);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error updating bookmark:', error);
  }
}

export async function clearBookmarks(): Promise<void> {
  try {
    await del(BOOKMARKS_KEY);
    localStorage.removeItem(BOOKMARKS_KEY);
  } catch (error) {
    console.error('Error clearing bookmarks:', error);
  }
}


/**
 * Consultas guardadas: preguntas que el usuario marca para reutilizar.
 * Se guardan solo en IndexedDB de este navegador.
 */
export async function getSavedQueries(): Promise<SavedQuery[]> {
  try {
    const items = await get<SavedQuery[]>(SAVED_QUERIES_KEY);
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error('Error reading saved queries from IndexedDB:', error);
    return [];
  }
}

export async function setSavedQueries(items: SavedQuery[]): Promise<void> {
  try {
    await set(SAVED_QUERIES_KEY, items);
  } catch (error) {
    console.error('Error saving queries to IndexedDB:', error);
  }
}
