import React, { useRef, useEffect } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Check,
  BookOpen,
  ArrowRight,
  Sparkles,
  Clock,
  ShieldCheck,
  ExternalLink,
  Flame,
} from 'lucide-react';
import { NormativeNotification } from '../types/notifications';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NormativeNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onViewDocument: (docId: string) => void;
  onSimulateUpdate?: (type: 'NEC' | 'LOSNCP') => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onViewDocument,
  onSimulateUpdate,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Reciente';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-3 sm:p-6 bg-stone-900/40 backdrop-blur-2xs animate-in fade-in">
      <div
        ref={panelRef}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 mt-12 sm:mt-14 overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-top-4 duration-200"
      >
        {/* Header */}
        <div className="p-4 sm:p-4.5 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center text-amber-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Notificaciones Normativas</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-950">
                    {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400">
                Avisos de nuevas versiones y actualizaciones (NEC / LOSNCP)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="p-1.5 text-stone-300 hover:text-white hover:bg-stone-800 rounded-lg transition-colors text-xs flex items-center gap-1"
                title="Marcar todas como leídas"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">Marcar leídas</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
              title="Cerrar panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Testing Actions (Probar simulación de actualización) */}
        {onSimulateUpdate && (
          <div className="bg-stone-50 border-b border-stone-200 px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap text-xs">
            <span className="text-[11px] text-stone-500 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Simular actualización:</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSimulateUpdate('NEC')}
                className="px-2 py-0.5 text-[11px] font-semibold rounded bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors"
                title="Simular nueva versión de Norma Ecuatoriana de la Construcción"
              >
                + Norma NEC
              </button>
              <button
                type="button"
                onClick={() => onSimulateUpdate('LOSNCP')}
                className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                title="Simular nueva versión de Ley de Contratación Pública"
              >
                + Ley LOSNCP
              </button>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1">
          {notifications.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <h4 className="text-xs font-bold text-stone-800">Biblioteca Normativa al Día</h4>
              <p className="text-[11px] text-stone-500 max-w-xs mx-auto">
                No hay nuevas actualizaciones detectadas en este momento. Cuando se cargue o modifique un documento de la NEC o LOSNCP en el servidor, recibirás un aviso inmediato aquí.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const isNEC = item.category.includes('NEC') || item.docName.toUpperCase().includes('NEC');
              const isLOSNCP =
                item.category.includes('LOSNCP') ||
                item.category.includes('RGLOSNCP') ||
                item.docName.toUpperCase().includes('LOSNCP');

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    !item.isRead
                      ? 'bg-amber-50/50 border-amber-200/90 shadow-2xs'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isNEC
                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                            : isLOSNCP
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            : 'bg-stone-100 text-stone-800 border border-stone-200'
                        }`}
                      >
                        {isNEC ? 'NEC Construcción' : isLOSNCP ? 'LOSNCP / Contratación' : item.category}
                      </span>
                      <span className="text-[10px] font-medium text-stone-600 bg-stone-100 px-1.5 py-0.2 rounded">
                        {item.type === 'updated_version' ? 'Versión Actualizada' : 'Documento Nuevo'}
                      </span>
                    </div>

                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" title="No leída" />
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-stone-900 leading-snug mb-1">
                    {item.docName}
                  </h4>

                  <p className="text-[11px] text-stone-600 leading-relaxed mb-2.5">
                    {item.details || `Versión "${item.version}" disponible en el repositorio oficial.`}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 text-xs">
                    <span className="text-[10px] text-stone-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(item.timestamp)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={() => onMarkAsRead(item.id)}
                          className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
                          title="Marcar como leída"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onMarkAsRead(item.id);
                          onViewDocument(item.docId);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors"
                      >
                        <BookOpen className="w-3 h-3 text-stone-600" />
                        <span>Ver documento</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500 px-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Monitoreo de servidor activo</span>
          </span>
          <span>{notifications.length} registros</span>
        </div>
      </div>
    </div>
  );
};
