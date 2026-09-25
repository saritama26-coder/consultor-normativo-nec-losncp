import { useState, useEffect, useCallback, useRef } from 'react';
import { NormativeDocument } from '../types/normative';
import { NormativeNotification, NormativeCacheRecord } from '../types/notifications';

const CACHE_KEY = 'consultor_normative_cache_v2';
const NOTIFICATIONS_KEY = 'consultor_normative_notifications_v2';

export function isKeyNormativeDoc(doc: { category?: string; name?: string }): {
  isKey: boolean;
  type: 'NEC' | 'LOSNCP' | 'RGLOSNCP' | 'OTRA';
} {
  const cat = (doc.category || '').toUpperCase();
  const name = (doc.name || '').toUpperCase();

  if (cat.includes('NEC') || name.includes('NEC') || name.includes('NORMA ECUATORIANA DE LA CONSTRUCCION')) {
    return { isKey: true, type: 'NEC' };
  }
  if (cat.includes('RGLOSNCP') || name.includes('REGLAMENTO') && name.includes('CONTRATACION PUBLICA')) {
    return { isKey: true, type: 'RGLOSNCP' };
  }
  if (cat.includes('LOSNCP') || name.includes('LOSNCP') || name.includes('SISTEMA NACIONAL DE CONTRATACION')) {
    return { isKey: true, type: 'LOSNCP' };
  }
  return { isKey: false, type: 'OTRA' };
}

export function useNormativeNotifications() {
  const [notifications, setNotifications] = useState<NormativeNotification[]>(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeToast, setActiveToast] = useState<NormativeNotification | null>(null);
  const initialLoadRef = useRef(false);

  // Guardar notificaciones en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch (err) {
      console.error('Error guardando notificaciones en localStorage:', err);
    }
  }, [notifications]);

  // Contar no leídas
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  /**
   * Compara los documentos actuales del servidor contra el caché local
   * para detectar adiciones o actualizaciones de versión de NEC y LOSNCP.
   */
  const checkDocumentUpdates = useCallback(
    (currentDocs: NormativeDocument[]): NormativeNotification[] => {
      if (!currentDocs || currentDocs.length === 0) return [];

      let cachedMap: Record<string, NormativeCacheRecord> = {};
      try {
        const stored = localStorage.getItem(CACHE_KEY);
        if (stored) {
          cachedMap = JSON.parse(stored);
        }
      } catch {
        cachedMap = {};
      }

      const isFirstRun = Object.keys(cachedMap).length === 0;
      const newNotifications: NormativeNotification[] = [];
      const updatedCache: Record<string, NormativeCacheRecord> = { ...cachedMap };

      for (const doc of currentDocs) {
        const cached = cachedMap[doc.id];
        const keyInfo = isKeyNormativeDoc(doc);

        if (!cached) {
          // Documento recién detectado en el servidor
          updatedCache[doc.id] = {
            id: doc.id,
            version: doc.version || 'Vigente',
            updatedAt: doc.updatedAt || doc.uploadedAt,
            uploadedAt: doc.uploadedAt,
            fileHash: doc.fileHash,
            isActive: doc.isActive,
          };

          // Si es la primera vez que se carga la aplicación, creamos una notificación de bienvenida
          // informando de los cuerpos normativos oficiales NEC y LOSNCP cargados
          if (!isFirstRun || keyInfo.isKey) {
            const notif: NormativeNotification = {
              id: `notif_${doc.id}_${Date.now()}`,
              docId: doc.id,
              docName: doc.name,
              category: doc.category,
              version: doc.version || 'Vigente',
              type: 'new_document',
              timestamp: doc.updatedAt || doc.uploadedAt || new Date().toISOString(),
              isRead: false,
              isKeyNormative: keyInfo.isKey,
              registroOficial: doc.registroOficial,
              details: `Se ha cargado un nuevo documento normativo en el servidor: "${doc.name}" [${doc.category}] versión ${doc.version || 'Vigente'}.`,
            };
            newNotifications.push(notif);
          }
        } else {
          // Documento previamente conocido: verificar si cambió su versión o fecha de actualización
          const hasVersionChanged = doc.version && doc.version !== cached.version;
          const hasDateChanged =
            doc.updatedAt && cached.updatedAt && new Date(doc.updatedAt) > new Date(cached.updatedAt);
          const hasHashChanged = doc.fileHash && cached.fileHash && doc.fileHash !== cached.fileHash;

          if (hasVersionChanged || hasDateChanged || hasHashChanged) {
            // Actualización de versión o reforma
            updatedCache[doc.id] = {
              id: doc.id,
              version: doc.version || 'Vigente',
              updatedAt: doc.updatedAt || new Date().toISOString(),
              uploadedAt: doc.uploadedAt || cached.uploadedAt,
              fileHash: doc.fileHash || cached.fileHash,
              isActive: doc.isActive,
            };

            const notif: NormativeNotification = {
              id: `notif_upd_${doc.id}_${Date.now()}`,
              docId: doc.id,
              docName: doc.name,
              category: doc.category,
              version: doc.version || 'Reforma / Actualización',
              type: 'updated_version',
              timestamp: doc.updatedAt || new Date().toISOString(),
              isRead: false,
              isKeyNormative: keyInfo.isKey,
              registroOficial: doc.registroOficial,
              details: `Actualización de versión detectada para "${doc.name}" (${keyInfo.isKey ? keyInfo.type : doc.category}). Nueva versión: ${doc.version}.`,
            };
            newNotifications.push(notif);
          }
        }
      }

      // Guardar mapa actualizado en caché
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(updatedCache));
      } catch (err) {
        console.error('Error actualizando caché normativo:', err);
      }

      if (newNotifications.length > 0) {
        setNotifications((prev) => {
          // Evitar duplicados por docId y timestamp similar
          const filteredNew = newNotifications.filter(
            (n) => !prev.some((p) => p.docId === n.docId && p.type === n.type && p.version === n.version)
          );
          if (filteredNew.length === 0) return prev;
          return [...filteredNew, ...prev].slice(0, 30); // Limitar a las 30 más recientes
        });

        // Disparar toast para la notificación más prioritaria (priorizar NEC/LOSNCP)
        const priorityNotif = newNotifications.find((n) => n.isKeyNormative) || newNotifications[0];
        if (priorityNotif) {
          setActiveToast(priorityNotif);
        }
      }

      return newNotifications;
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setActiveToast((current) => (current && current.id === id ? null : current));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setActiveToast(null);
  }, []);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  /**
   * Permite probar / simular la llegada de una nueva actualización normativa
   * de NEC o LOSNCP para verificar inmediatamente el sistema de alertas.
   */
  const simulateUpdate = useCallback((type: 'NEC' | 'LOSNCP') => {
    const isNEC = type === 'NEC';
    const mockDocName = isNEC
      ? 'NEC-SE-DS: Peligro Sísmico y Diseño Sismo Resistente (Reforma)'
      : 'LOSNCP: Codificación y Reformas al Sistema de Contratación Pública';

    const mockCategory = isNEC ? '07 NEC (Construcción)' : '03 LOSNCP';
    const mockVersion = `Reforma Oficial ${new Date().toLocaleDateString('es-EC', { month: 'short', year: 'numeric' })}`;

    const simNotif: NormativeNotification = {
      id: `sim_${Date.now()}`,
      docId: `sim_doc_${type.toLowerCase()}`,
      docName: mockDocName,
      category: mockCategory,
      version: mockVersion,
      type: 'updated_version',
      timestamp: new Date().toISOString(),
      isRead: false,
      isKeyNormative: true,
      registroOficial: 'Reg. Oficial Edición Constitucional N° 584',
      details: `¡Nueva actualización de ${type} en el servidor! Se ha registrado una nueva versión oficial (${mockVersion}) con parámetros técnicos aplicables.`,
    };

    setNotifications((prev) => [simNotif, ...prev]);
    setActiveToast(simNotif);
  }, []);

  return {
    notifications,
    unreadCount,
    activeToast,
    checkDocumentUpdates,
    markAsRead,
    markAllAsRead,
    dismissToast,
    simulateUpdate,
  };
}
