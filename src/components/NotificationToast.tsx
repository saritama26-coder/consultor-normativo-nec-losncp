import React, { useEffect, useState } from 'react';
import {
  Bell,
  X,
  BookOpen,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { NormativeNotification } from '../types/notifications';

interface NotificationToastProps {
  notification: NormativeNotification | null;
  onDismiss: () => void;
  onViewDocument: (docId: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onViewDocument,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification) return;

    setProgress(100);
    const duration = 12000; // 12 seconds
    const intervalTime = 100;
    const decrement = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - decrement;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const isNEC = notification.category.includes('NEC') || notification.docName.toUpperCase().includes('NEC');
  const isLOSNCP =
    notification.category.includes('LOSNCP') ||
    notification.category.includes('RGLOSNCP') ||
    notification.docName.toUpperCase().includes('LOSNCP');

  return (
    <div className="fixed top-4 right-4 sm:right-6 z-50 max-w-md w-[calc(100vw-2rem)] sm:w-full animate-in slide-in-from-top-4 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden ring-1 ring-stone-900/10">
        {/* Top accent bar */}
        <div
          className={`h-1.5 transition-all duration-100 ease-linear ${
            isNEC
              ? 'bg-blue-600'
              : isLOSNCP
              ? 'bg-emerald-600'
              : 'bg-amber-600'
          }`}
          style={{ width: `${progress}%` }}
        />

        <div className="p-4 sm:p-4.5 flex items-start gap-3.5">
          {/* Bell Icon with pulsed badge */}
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs relative ${
              isNEC
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : isLOSNCP
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            <Bell className="w-5 h-5 animate-wiggle" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
          </div>

          {/* Notification Details */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isNEC
                    ? 'bg-blue-100 text-blue-900'
                    : isLOSNCP
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {isNEC ? 'Norma NEC' : isLOSNCP ? 'LOSNCP / SERCOP' : notification.category}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">
                {notification.type === 'updated_version' ? 'Nueva Versión / Reforma' : 'Nuevo Documento'}
              </span>
            </div>

            <h4 className="text-xs sm:text-sm font-bold text-stone-900 leading-snug line-clamp-2">
              {notification.docName}
            </h4>

            <p className="text-[11px] text-stone-600 line-clamp-2 leading-relaxed">
              {notification.details ||
                `Actualización disponible en el servidor: versión "${notification.version}". Vigente para consultas.`}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onViewDocument(notification.docId)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg text-white transition-all shadow-2xs ${
                  isNEC
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : isLOSNCP
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Ver en Biblioteca</span>
                <ArrowRight className="w-3 h-3 ml-0.5" />
              </button>

              <button
                type="button"
                onClick={onDismiss}
                className="px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors shrink-0 -mr-1 -mt-1"
            title="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
