import { useEffect, useState } from 'react';

/** Aviso visible cuando no hay conexión: las consultas requieren el servidor y no se sirven desde caché. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" className="sticky top-0 z-50 w-full bg-amber-100 border-b border-amber-300 text-amber-900 text-xs font-semibold text-center px-3 py-2">
      Sin conexión. Las consultas normativas requieren conexión con el servidor; no se muestran resultados desde caché.
    </div>
  );
}
