export interface FrequentQuestionItem {
  id: string;
  category: 'NEC' | 'LOSNCP' | 'GENERAL';
  normaRef: string;
  topic: string;
  question: string;
  description: string;
  suggestedMode?: 'rapida' | 'analisis' | 'informe';
}

export const FREQUENT_QUESTIONS_DATA: FrequentQuestionItem[] = [
  // --- NEC (Norma Ecuatoriana de la Construcción) ---
  {
    id: 'nec-sismo-espectros',
    category: 'NEC',
    normaRef: 'NEC-SE-DS (Sismo)',
    topic: 'Peligro Sísmico & Espectros',
    question: '¿Cómo se determinan los factores de zona sísmica (Z) y el tipo de perfil de suelo (A, B, C, D, E, F) para el cálculo del espectro elástico de diseño según la NEC-SE-DS?',
    description: 'Factores de aceleración en roca, amplificación dinámica (Fa, Fd, Fs) y curvas de aceleración espectral.',
    suggestedMode: 'analisis',
  },
  {
    id: 'nec-hormigon-recubrimientos',
    category: 'NEC',
    normaRef: 'NEC-SE-HM (Hormigón)',
    topic: 'Resistencia f\'c & Recubrimientos',
    question: '¿Cuáles son las resistencias mínimas a la compresión f\'c y los recubrimientos mínimos para elementos estructurales de hormigón armado según la NEC-SE-HM?',
    description: 'Espesores mínimos de recubrimiento en vigas, columnas, zapatas y losas para evitar corrosión y garantizar adherencia.',
    suggestedMode: 'rapida',
  },
  {
    id: 'nec-cargas-combinaciones',
    category: 'NEC',
    normaRef: 'NEC-SE-CG (Cargas)',
    topic: 'Sobrecargas & Factores LRFD',
    question: '¿Cuáles son los valores mínimos de cargas vivas y las combinaciones de carga de diseño en estado límite según la NEC-SE-CG?',
    description: 'Cargas gravitacionales mínimas para residencias, comercio, áreas públicas y combinaciones mayoradas de servicio.',
    suggestedMode: 'rapida',
  },
  {
    id: 'nec-derivas-limites',
    category: 'NEC',
    normaRef: 'NEC-SE-DS (Derivas)',
    topic: 'Deriva Inelástica Máxima',
    question: '¿Cuáles son los límites permisibles de deriva inelástica de piso (ΔM) para estructuras de hormigón armado y acero según la NEC-SE-DS?',
    description: 'Control de deformación con límite de 0.02 (2%) para marcos y verificación de integridad de elementos no estructurales.',
    suggestedMode: 'analisis',
  },
  {
    id: 'nec-geotecnia-sondeos',
    category: 'NEC',
    normaRef: 'NEC-SE-GC (Geotecnia)',
    topic: 'Estudios de Suelos & Cimentación',
    question: '¿Qué requisitos de número mínimo y profundidad de sondeos geotécnicos exige la NEC-SE-GC para el diseño de cimentaciones?',
    description: 'Exploración mínima por área construida, ensayos SPT en sitio y factores de seguridad en capacidad portante.',
    suggestedMode: 'analisis',
  },
  {
    id: 'nec-incendios-evacuacion',
    category: 'NEC',
    normaRef: 'NEC-HS-CI (Incendios)',
    topic: 'Evacuación & Resistencia al Fuego',
    question: '¿Qué anchos mínimos de vías de evacuación, distancias de recorrido y resistencia al fuego de elementos estructurales establece la NEC-HS-CI?',
    description: 'Capacidad de egreso, puertas cortafuego, compartimentación y protección pasiva según tipo de ocupación.',
    suggestedMode: 'informe',
  },

  // --- LOSNCP (Contratación Pública & RGLOSNCP) ---
  {
    id: 'losncp-anticipo-garantia',
    category: 'LOSNCP',
    normaRef: 'LOSNCP Art. 73-75',
    topic: 'Anticipos & Garantía de Buen Uso',
    question: '¿Cuál es el porcentaje máximo de anticipo que puede otorgar la entidad contratante en contratos de obra pública y cómo se garantiza y amortiza según la LOSNCP?',
    description: 'Límite legal del anticipo (hasta 50%), garantía incondicional e irrevocable y amortización porcentual en cada planilla.',
    suggestedMode: 'rapida',
  },
  {
    id: 'losncp-reajuste-formula',
    category: 'LOSNCP',
    normaRef: 'RGLOSNCP Art. 126-135',
    topic: 'Reajuste de Precios & Polinómicas',
    question: '¿Cómo se calcula y aplica el reajuste de precios provisional y definitivo mediante fórmula polinómica en planillas de obra pública?',
    description: 'Cuadrillas tipo de mano de obra, índices de precios del INEC, aplicación respecto al anticipo y liquidación.',
    suggestedMode: 'informe',
  },
  {
    id: 'losncp-complementarios-limites',
    category: 'LOSNCP',
    normaRef: 'LOSNCP Art. 85-89',
    topic: 'Contratos Complementarios & Modificaciones',
    question: '¿Cuáles son los límites porcentuales y requisitos para suscribir contratos complementarios, órdenes de cambio y órdenes de trabajo en obras según la LOSNCP?',
    description: 'Hasta 8% para órdenes de cambio, límite global del 35% en complementarios, dictámenes técnicos y disponibilidad presupuestaria.',
    suggestedMode: 'analisis',
  },
  {
    id: 'losncp-recepciones-plazos',
    category: 'LOSNCP',
    normaRef: 'LOSNCP Art. 81 & RGLOSNCP',
    topic: 'Recepciones Provisional & Definitiva',
    question: '¿Cuáles son los plazos legales, requisitos y efectos entre la recepción provisional y la recepción definitiva de una obra pública?',
    description: 'Plazo presuntivo de 6 meses, comisiones de entrega-recepción, subsanación de observaciones y devolución de garantías técnicas.',
    suggestedMode: 'analisis',
  },
  {
    id: 'losncp-terminacion-unilateral',
    category: 'LOSNCP',
    normaRef: 'LOSNCP Art. 92-95',
    topic: 'Terminación Unilateral & Efectos',
    question: '¿Cuáles son las causales legales y el procedimiento obligatorio de notificación previa para declarar la terminación unilateral del contrato de obra?',
    description: 'Notificación con término de 10 días para justificar o remediar, ejecución inmediata de pólizas y sanción en SERCOP.',
    suggestedMode: 'informe',
  },
  {
    id: 'losncp-fiscalizacion-responsabilidad',
    category: 'LOSNCP',
    normaRef: 'LOSNCP Art. 70, 80 & LOCGE',
    topic: 'Responsabilidad de Fiscalización & Glosas',
    question: '¿Cuál es el alcance de la responsabilidad civil culposa o solidaria del fiscalizador y administrador de contrato frente a pagos indebidos o glosas de Contraloría?',
    description: 'Aprobación de volúmenes de obra, libro de obra, pruebas de calidad y presunción de responsabilidad solidaria ante la CGE.',
    suggestedMode: 'informe',
  },
];
