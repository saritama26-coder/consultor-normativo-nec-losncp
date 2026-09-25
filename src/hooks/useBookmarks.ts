import { useState, useEffect, useCallback, useMemo } from 'react';
import { NormativeBookmark } from '../types/normative';
import {
  getBookmarks,
  saveBookmark,
  deleteBookmark,
  updateBookmark,
  clearBookmarks,
} from '../services/db';

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<NormativeBookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBookmarks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBookmarks();
      setBookmarks(data);
    } catch (err) {
      console.error('Error cargando marcadores:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  // Lista única de proyectos registrados
  const projects = useMemo(() => {
    const set = new Set<string>();
    bookmarks.forEach((b) => {
      if (b.projectName && b.projectName.trim()) {
        set.add(b.projectName.trim());
      }
    });
    return Array.from(set).sort();
  }, [bookmarks]);

  // Verificar si un fragmento o cita ya está en marcadores
  const isBookmarked = useCallback(
    (documentName: string, articleOrNumeral: string, excerpt?: string) => {
      return bookmarks.some((b) => {
        const docMatch =
          b.documentName.toLowerCase().trim() === documentName.toLowerCase().trim() ||
          b.documentName.includes(documentName) ||
          documentName.includes(b.documentName);
        const artMatch =
          b.articleOrNumeral.toLowerCase().replace(/\s+/g, '') ===
          articleOrNumeral.toLowerCase().replace(/\s+/g, '');
        if (excerpt && b.excerpt) {
          const cleanA = b.excerpt.slice(0, 50).toLowerCase().trim();
          const cleanB = excerpt.slice(0, 50).toLowerCase().trim();
          return docMatch && artMatch && cleanA === cleanB;
        }
        return docMatch && artMatch;
      });
    },
    [bookmarks]
  );

  const getBookmark = useCallback(
    (documentName: string, articleOrNumeral: string, excerpt?: string) => {
      return bookmarks.find((b) => {
        const docMatch =
          b.documentName.toLowerCase().trim() === documentName.toLowerCase().trim() ||
          b.documentName.includes(documentName) ||
          documentName.includes(b.documentName);
        const artMatch =
          b.articleOrNumeral.toLowerCase().replace(/\s+/g, '') ===
          articleOrNumeral.toLowerCase().replace(/\s+/g, '');
        if (excerpt && b.excerpt) {
          const cleanA = b.excerpt.slice(0, 50).toLowerCase().trim();
          const cleanB = excerpt.slice(0, 50).toLowerCase().trim();
          return docMatch && artMatch && cleanA === cleanB;
        }
        return docMatch && artMatch;
      });
    },
    [bookmarks]
  );

  const addBookmark = useCallback(
    async (item: Omit<NormativeBookmark, 'id' | 'createdAt'> & { id?: string }) => {
      const id = item.id || `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newBookmark: NormativeBookmark = {
        ...item,
        id,
        projectName: item.projectName?.trim() || 'General / Sin asignar',
        createdAt: new Date().toISOString(),
      };
      await saveBookmark(newBookmark);
      setBookmarks((prev) => [newBookmark, ...prev.filter((b) => b.id !== id)]);
      return newBookmark;
    },
    []
  );

  const removeBookmark = useCallback(async (id: string) => {
    await deleteBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const updateBookmarkItem = useCallback(
    async (id: string, updates: Partial<NormativeBookmark>) => {
      await updateBookmark(id, updates);
      setBookmarks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b))
      );
    },
    []
  );

  const removeAllBookmarks = useCallback(async () => {
    await clearBookmarks();
    setBookmarks([]);
  }, []);

  return {
    bookmarks,
    loading,
    projects,
    isBookmarked,
    getBookmark,
    addBookmark,
    removeBookmark,
    updateBookmarkItem,
    removeAllBookmarks,
    reloadBookmarks: loadBookmarks,
  };
}
