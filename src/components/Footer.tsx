import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-stone-200 bg-stone-100/90 text-stone-600 text-xs py-3 px-4 mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-1.5 font-medium text-stone-700">
          <ShieldCheck className="w-4 h-4 text-stone-500 shrink-0" />
          <span>Herramienta de apoyo. Verifique siempre las citas en el documento oficial.</span>
        </div>
        <div className="text-[11px] text-stone-400">
          Normativa Técnica y Contratación Pública del Ecuador
        </div>
      </div>
    </footer>
  );
};
