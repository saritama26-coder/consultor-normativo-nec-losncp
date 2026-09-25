# Consultor Normativo Ecuador
### NEC · LOSNCP · RGLOSNCP · SERCOP · Contraloría · Normativa Técnica

Herramienta profesional de consulta técnico-normativa para arquitectos, ingenieros, fiscalizadores y administradores de contrato de obra pública en Ecuador, basada exclusivamente en evidencia documental de archivos PDF oficiales indexados en el servidor.

---

## 1. Guía de Configuración de 'Secrets' en la Consola de Google AI Studio

Para el correcto despliegue y funcionamiento de la aplicación en **Google AI Studio**, las variables sensibles deben gestionarse de manera segura a través del panel de configuración de secretos de la plataforma, evitando exponer credenciales en el repositorio.

### Paso a paso para configurar los Secrets:

1. Ingresa a tu proyecto en la consola de **Google AI Studio**.
2. En la barra de herramientas lateral o en el menú de configuración del entorno (**Settings / Environment**), localiza la sección **"Secrets"** (o ícono de candado / llaves).
3. Haz clic en **"Add Secret"** (o **"New Secret"**) e introduce los siguientes tres secretos con sus nombres exactos:

| Nombre del Secret | Tipo | Descripción y Propósito |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **Obligatorio** | **Clave de API para el modelo**: Proporciona acceso a los modelos de lenguaje de Gemini y a las capacidades de búsqueda semántica documental (*File Search Store*). |
| `ADMIN_PASSWORD` | **Obligatorio** | **Clave secreta de acceso administrativo**: Contraseña privada requerida exclusivamente para ingresar al panel de administración documental (subida de nuevos archivos PDF, activación o desactivación de normas, edición de metadatos institucionales y eliminación de documentos). |
| `SESSION_SECRET` | **Recomendado** | **Cadena alfanumérica para firma de cookies**: Cadena alfanumérica aleatoria y segura utilizada para la firma criptográfica de las cookies de sesión y tokens de autenticación del administrador. |

4. Guarda los cambios haciendo clic en **Save** o **Apply**. La plataforma inyectará estas variables de entorno en tiempo de ejecución de forma segura.

---

### ⚠️ Regla de Seguridad Crítica: Sin Valores por Defecto en el Código
- **No poner valores por defecto en el código fuente:** Por estrictas políticas de ciberseguridad y buenas prácticas, **jamás** se deben incluir contraseñas predeterminadas, claves de prueba ("fallback strings") o credenciales quemadas (*hardcoded*) directamente en los archivos del código fuente (`.ts`, `.tsx`, `.js`, etc.).
- Todas las variables sensibles deben ser leídas exclusivamente desde las variables de entorno (`process.env`) proporcionadas por los Secrets de Google AI Studio.

---

### 🌐 Acceso a la Consulta Abierto (Sin Credenciales para Usuarios)
- **El acceso a la consulta es completamente abierto:** La herramienta está diseñada para que ingenieros, arquitectos, fiscalizadores, contratistas y ciudadanos puedan realizar consultas técnico-normativas, búsquedas de artículos específicos, consultar el historial y generar reportes oficiales en PDF/Word **de manera libre, instantánea y sin requerir inicio de sesión ni contraseñas**.
- Los secretos `ADMIN_PASSWORD` y `SESSION_SECRET` protegen **única y exclusivamente** el módulo de mantenimiento de la base documental (gestión de archivos PDF en el servidor).

---

## 2. Arquitectura de Seguridad y Filtrado de Evidencia

1. **Sin Contraseñas por Defecto ni Claves en Código**:
   - El sistema no posee contraseñas predeterminadas ni accesos de respaldo.
   - Las comparaciones de contraseña utilizan hash SHA-256 con protección contra ataques de tiempo (`crypto.timingSafeEqual`).
2. **Filtrado Real de Documentos Activos**:
   - Cada PDF se sube con una clave propia `docKey` (UUID) en `customMetadata`. Las consultas pasan a File Search un `metadataFilter` (sintaxis AIP-160, p. ej. `docKey = "a" OR docKey = "b"`) construido solo con los documentos activos: los inactivos no se recuperan.
   - La metadata no puede modificarse después de subir (la SDK solo expone `get`, `list` y `delete`); por eso el estado activo/inactivo vive en el registro del servidor y se traduce en el filtro en cada consulta.
   - Cada fragmento recuperado se atribuye a su documento por `docKey` (o `fileHash`, `uri` o título exacto único). Si no puede atribuirse con certeza, se descarta y se registra en el log; nunca se reasigna a otra norma.
   - Si el fragmento menciona más de un artículo, la cita se rotula "Art. no determinado con certeza". La página se muestra solo si la API la entrega; si no, "Pág.: no determinada".
   - Las contradicciones se reportan solo desde una sección estructurada del modelo y únicamente si ambas citas existen en la evidencia recuperada.
   - El texto que no proviene de los documentos se rotula "Orientación general — no extraída de los documentos cargados".
3. **Control de Duplicados e Integridad de Archivos PDF**:
   - Cada PDF subido es analizado en sus bytes de cabecera (`%PDF-`) para verificar su autenticidad.
   - Se calcula el hash SHA-256 de su contenido. Si el archivo ya existe en el repositorio, se alerta de duplicidad evitando copias redundantes.
   - Si el archivo contiene poco texto seleccionable (documento escaneado), se emite un aviso preventivo técnico.

---

## 3. Modos de Consulta y Capas de Respuesta

### Modos Disponibles:
1. **Modo 1: Consulta Rápida**: Respuesta directa, sintética y categórica en lenguaje técnico-institucional.
2. **Modo 2: Análisis Normativo**: Contestación analítica que integra la fundamentación técnica, la aplicación práctica y observaciones de riesgo.
3. **Modo 3: Informe Técnico**: Estructura formal estandarizada para informes de fiscalización y memorandos:
   - 1. Antecedentes y Objeto
   - 2. Base Legal
   - 3. Análisis Técnico-Jurídico
   - 4. Fundamento Técnico en Obra
   - 5. Conclusiones y Recomendaciones

### Las 4 Capas Separadas de Respuesta:
1. **Respuesta Técnica Directa**: Conclusión técnica sobre el problema planteado.
2. **Fundamento Normativo (Citas Literales)**: Formato obligatorio `[Documento] – Art./Numeral [X] – Pág. [N del PDF]` con transcripción textual exacta entrecomillada.
3. **Aplicación al Caso en Obra Pública**: Efectos en fiscalización, recepción provisional/definitiva, garantías, planillaje o multas.
4. **Observaciones y Advertencias**: Límites técnicos y recordatorio de verificación en Registro Oficial.

---

## 4. Búsqueda Directa y Exportación

- **Búsqueda Directa de Artículo**: Permite consultar directamente un artículo específico (ej. LOSNCP Art. 74 o NEC-SE-DS).
- **Reporte Oficial en PDF (`jsPDF`)**: Generación y descarga directa desde el historial o la consulta de un informe técnico en PDF, preservando el formato riguroso de citas normativas `[Documento] - Art./Numeral - Pág. X`, foliado dinámico y membrete institucional.
- **Exportación Word (.doc)**: Descarga directa de informe técnico formateado para anexar a expedientes de obra.
- **Copiado al Portapapeles**: Copia directa de la respuesta completa o exclusivamente de las citas normativas literales.
- **PWA Responsive**: Diseño optimizado para uso en computadoras de escritorio, tablets y teléfonos móviles (iOS / Android).

---

## 5. Cambios de la auditoría del 25-09-2026 y limitaciones vigentes

**Migración de documentos ya subidos.** Los documentos subidos antes de este cambio no tienen `docKey`. Al iniciar, el servidor reconcilia el registro con `fileSearchStores.documents.list()`:
- si el documento del store tiene `fileHash` en su metadata, se usa como clave de filtro;
- si no tiene ni `docKey` ni `fileHash`, se marca **"Requiere volver a subir"** y no participa en las consultas hasta eliminarlo y subirlo de nuevo;
- las entradas locales sin documento real en el store se eliminan del registro;
- los documentos del store sin registro local se restauran **inactivos** ("Restaurado · activar para usar"), para no reactivar sin revisión una norma desactivada.

**Persistencia.** `server-docs-state.json` y `server-file-store.json` se escriben en el sistema de archivos del contenedor y pueden perderse en un redespliegue. Para conservarlos, defina `DOCS_STATE_FILE` y `STORE_CONFIG_FILE` apuntando a un volumen persistente. Sin volumen persistente, tras un redespliegue la biblioteca se reconstruye desde el store, pero todos los documentos quedan inactivos hasta que el administrador los active. Estos archivos no se versionan (ver `*.example.json`).

**Sesiones de administrador.** Se guardan en memoria: todo reinicio del servidor cierra las sesiones, aun con `SESSION_SECRET` configurado.

**Rate limiter.** Existe un límite global en memoria de 180 solicitudes/minuto por IP y un límite adicional de 30 solicitudes/minuto para las rutas que consumen Gemini; el login administrativo queda limitado a 10 intentos por 15 minutos por IP. Cada límite lleva su propio conteo. Estos límites no se comparten entre instancias. Si la app corre detrás de un proxy sin configurar `trust proxy`, todos los usuarios pueden compartir la misma IP y, por tanto, los mismos límites.

**Límites de contenido.** Consulta normativa: máximo 4.000 caracteres. Generación de puntos clave: máximo 30.000 caracteres. PDF: máximo 50 MB (el cuerpo JSON admite hasta 72 MB por la conversión a base64).

**Búsqueda directa de artículos.** El estado `FOUND` exige un fragmento del documento elegido que contenga el número de artículo. Si el fragmento solo menciona el artículo (p. ej. "según el Art. 74"), también se considera coincidencia: revise el texto literal.

**Exportación Word.** Sigue siendo `.doc` generado desde HTML (no `.docx` nativo).

**PWA.** Service worker propio (`public/sw.js`), activo solo en producción: caché del shell de la app; las rutas `/api/*` nunca se cachean. Sin conexión se muestra un aviso.

**Instalación.** Un solo gestor: npm (`package-lock.json`). `rm -rf node_modules && npm install && npm run lint && npm run build` funciona sin `--legacy-peer-deps`.
