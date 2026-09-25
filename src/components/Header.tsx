import React from 'react';
import { BookOpen, Scale, Search, History, Lock, Unlock, Bell } from 'lucide-react';
import { NormativeDocument } from '../types/normative';

interface HeaderProps {
  activeTab: 'consultar' | 'documentos' | 'historial';
  setActiveTab: (tab: 'consultar' | 'documentos' | 'historial') => void;
  documents: NormativeDocument[];
  historyCount: number;
  isAdminLoggedIn: boolean;
  onOpenAdminModal: () => void;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  documents,
  historyCount,
  isAdminLoggedIn,
  onOpenAdminModal,
  unreadNotificationsCount = 0,
  onOpenNotifications,
}) => {
  const activeCount = documents.filter((d) => d.isActive).length;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Brand & Identity */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center shrink-0 shadow-xs">
                <Scale className="w-5 h-5 text-stone-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight leading-tight">
                    Consultor Normativo Ecuador
                  </h1>
                  <span className="hidden sm:inline-block text-[10px] font-bold text-stone-700 bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded">
                    EC
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 font-normal line-clamp-1">
                  NEC · LOSNCP · RGLOSNCP · SERCOP · Contraloría · Normativa Técnica
                </p>
              </div>
            </div>

            {/* Mobile Actions: Notifications & Admin Lock */}
            <div className="flex items-center gap-1 sm:hidden">
              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  className="p-2 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors relative"
                  title="Notificaciones de actualizaciones normativas"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={onOpenAdminModal}
                className="p-2 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
                title={isAdminLoggedIn ? 'Sesión de Administrador activa' : 'Ingresar como Administrador'}
              >
                {isAdminLoggedIn ? <Unlock className="w-4 h-4 text-emerald-600" /> : <Lock className="w-4 h-4 text-stone-400" />}
              </button>
            </div>
          </div>

          {/* Right Navigation & Admin Session Trigger */}
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-full sm:w-auto" aria-label="Navegación principal">
              <button
                type="button"
                onClick={() => setActiveTab('consultar')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-colors min-h-[44px] sm:min-h-0 ${
                  activeTab === 'consultar'
                    ? 'bg-white text-stone-900 shadow-xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Consultar</span>
                {activeCount > 0 && (
                  <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700">
                    {activeCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('documentos')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-colors min-h-[44px] sm:min-h-0 ${
                  activeTab === 'documentos'
                    ? 'bg-white text-stone-900 shadow-xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Biblioteca</span>
                <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700">
                  {documents.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('historial')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-colors min-h-[44px] sm:min-h-0 ${
                  activeTab === 'historial'
                    ? 'bg-white text-stone-900 shadow-xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Historial</span>
                {historyCount > 0 && (
                  <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700">
                    {historyCount}
                  </span>
                )}
              </button>
            </nav>

            {/* Desktop Notification Bell Button */}
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className="hidden sm:flex items-center justify-center p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition-colors relative"
                title={
                  unreadNotificationsCount > 0
                    ? `${unreadNotificationsCount} nueva(s) actualización(es) normativa(s)`
                    : 'Avisos de actualizaciones normativas'
                }
              >
                <Bell className="w-4 h-4 text-stone-700" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-stone-950 font-bold text-[10px] ring-2 ring-white">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            {/* Desktop Admin Lock/Unlock Button */}
            <button
              type="button"
              onClick={onOpenAdminModal}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl border transition-colors ${
                isAdminLoggedIn
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                  : 'bg-white text-stone-600 hover:text-stone-900 border-stone-200 hover:bg-stone-50'
              }`}
              title={isAdminLoggedIn ? 'Sesión de Administrador activa' : 'Ingresar como Administrador con ADMIN_PASSWORD'}
            >
              {isAdminLoggedIn ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Admin</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-stone-400" />
                  <span className="text-[11px]">Admin</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
