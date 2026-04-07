# ScrapingApiIa

API REST que expone **Gemini** y **DeepSeek** como servicios HTTP mediante automatización de navegador con Playwright. Permite enviar consultas de texto, adjuntar imágenes o PDFs para OCR, y consultar el historial de conversaciones, todo a través de endpoints simples sin necesidad de claves de API oficiales.

> **Autores:** Carlos Lozano y Jhonatan Ramírez

---

## Índice

- [Arquitectura](#arquitectura)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
  - [Iniciar el servidor](#iniciar-el-servidor)
  - [Endpoints](#endpoints)
- [Tests](#tests)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Agregar un nuevo proveedor de IA](#agregar-un-nuevo-proveedor-de-ia)
- [Túnel público con Cloudflare](#túnel-público-con-cloudflare)

---

## Arquitectura

```
Cliente HTTP
     │
     ▼
Express (puerto 3500)
  ├── express-queue  ←  cola serial (1 petición a la vez)
  └── /api/*
       │
       ▼
  RouterApiIa
       │
       ▼
  ScrapingService   ←  gestiona las páginas abiertas y delega al provider
       │
       ├── GeminiProvider   ──►  Pestaña Gemini  (Playwright)
       └── DeepSeekProvider ──►  Pestaña DeepSeek (Playwright)
```

Cada provider mantiene una **pestaña dedicada** dentro de un único contexto persistente de Chromium. Las peticiones se procesan de forma **serial** (express-queue) para evitar conflictos entre tabs.

---

## Requisitos

| Herramienta | Versión mínima |
|-------------|---------------|
| Node.js     | 18+           |
| npm         | 9+            |
| Google Chrome | instalado   |
| Cloudflared | opcional (túnel) |

---

## Instalación

```bash
git clone https://github.com/carlosnaico77/scrapingApiIa.git
cd scrapingApiIa
npm install
npx playwright install chromium
```

---

## Configuración

Crea un archivo `.env` en la raíz del proyecto:

```env
PORT=3500
URLdeepseek=https://chat.deepseek.com
URLGEMINI=https://gemini.google.com
```

### Autenticación

El navegador usa un **contexto persistente** ubicado en la carpeta `auth/`. Esto permite mantener la sesión iniciada entre reinicios.

Para autenticarse por primera vez:

1. Inicia el servidor con `npm run dev`.
2. El navegador se abrirá mostrando las páginas de Gemini y DeepSeek.
3. Inicia sesión manualmente en cada pestaña.
4. Detén el servidor (`Ctrl+C`). La sesión queda guardada en `auth/`.

En arranques posteriores la sesión se restaura automáticamente.

---

## Uso

### Iniciar el servidor

```bash
npm run dev
```

El servidor compila TypeScript y arranca en `http://localhost:3500`. Espera a ver:

```
[OK] Servidor listo en http://localhost:3500
[OK] Navegador listo para recibir consultas.
```

---

### Endpoints

#### `GET /api/health`

Verifica que el servidor y el navegador están activos.

```bash
curl http://localhost:3500/api/health
```

```json
{
  "status": "ok",
  "navegador": "activo",
  "providers": ["DeepSeek", "Gemini"]
}
```

---

#### `POST /api/consultar`

Envía una consulta de texto a la IA indicada. Opcionalmente continúa una conversación existente.

**Body JSON:**

| Campo            | Tipo   | Requerido | Descripción                            |
|------------------|--------|-----------|----------------------------------------|
| `agente`         | string | ✓         | `"gemini"` o `"deepseek"`             |
| `consulta`       | string | ✓         | Texto de la pregunta                   |
| `idConversacion` | string |           | ID de conversación anterior (opcional) |

```bash
curl -X POST http://localhost:3500/api/consultar \
  -H "Content-Type: application/json" \
  -d '{"agente": "gemini", "consulta": "¿Cuál es la capital de Francia?"}'
```

```json
{
  "success": true,
  "agente": "Gemini",
  "message": "La capital de Francia es París.",
  "idConversacion": "abc123xyz",
  "tituloConversacion": "Capital de Francia"
}
```

Para continuar la misma conversación, incluye el `idConversacion` devuelto:

```bash
curl -X POST http://localhost:3500/api/consultar \
  -H "Content-Type: application/json" \
  -d '{"agente": "gemini", "consulta": "¿Y cuál es su población?", "idConversacion": "abc123xyz"}'
```

---

#### `POST /api/consultar-archivo`

Envía una imagen o PDF junto con una consulta. Útil para **OCR**, análisis de documentos o preguntas sobre imágenes.

**Body `multipart/form-data`:**

| Campo            | Tipo   | Requerido | Descripción                                        |
|------------------|--------|-----------|----------------------------------------------------|
| `agente`         | string | ✓         | `"gemini"` o `"deepseek"`                         |
| `consulta`       | string | ✓         | Pregunta sobre el archivo                          |
| `archivo`        | file   | ✓         | Imagen (JPEG, PNG, WebP, GIF) o PDF — máx. 20 MB  |
| `idConversacion` | string |           | ID de conversación anterior (opcional)             |

```bash
curl -X POST http://localhost:3500/api/consultar-archivo \
  -F "agente=gemini" \
  -F "consulta=¿Qué texto aparece en esta imagen?" \
  -F "archivo=@/ruta/a/imagen.png"
```

```json
{
  "success": true,
  "agente": "Gemini",
  "message": "El texto en la imagen dice: HOLA2025",
  "idConversacion": "def456uvw",
  "tituloConversacion": "Análisis de imagen"
}
```

> El archivo temporal se elimina automáticamente del servidor después de cada petición.

---

#### `GET /api/conversaciones/:ia`

Obtiene el historial de conversaciones del proveedor indicado.

```bash
curl http://localhost:3500/api/conversaciones/gemini
curl http://localhost:3500/api/conversaciones/deepseek
```

```json
{
  "success": true,
  "ia": "Gemini",
  "total": 2,
  "data": {
    "0": [
      { "id": "abc123xyz", "title": "Capital de Francia", "url": "/app/abc123xyz", "listGroup": 0 },
      { "id": "def456uvw", "title": "Análisis de imagen", "url": "/app/def456uvw", "listGroup": 0 }
    ]
  }
}
```

---

## Tests

Los tests usan el runner nativo de Node.js (`node:test`) con Playwright en modo headless.

### Tests unitarios — `limpiarMarkdown`

Validan la conversión HTML → Markdown en aislamiento (no requieren servidor):

```bash
npm test
```

Casos cubiertos: `<p>`, `<h1>–<h3>`, `<pre>`, `<ul>`, `<ol>`, `<blockquote>`, `<hr>`, `<table>`, contenido anidado, contenedor vacío, limpieza de líneas en blanco múltiples.

### Tests de integración — OCR

Validan el flujo completo de subida de archivo (requieren el servidor corriendo):

```bash
# Terminal 1 — servidor
npm run dev

# Terminal 2 — tests
npm run test:ocr
```

Casos cubiertos:

- Servidor activo (`/api/health`)
- Imagen generada correctamente
- Gemini reconoce texto en imagen (OCR)
- DeepSeek reconoce texto en imagen (OCR)
- Rechaza petición sin campo `archivo`
- Rechaza agente no soportado (`404`)

### Todos los tests

```bash
npm run test:all
```

---

## Estructura del proyecto

```
scrapingApiIa/
├── auth/                              # Sesión persistente de Chromium (no versionar)
├── uploads/                           # Archivos temporales de subida (se limpian solos)
├── src/
│   ├── index.ts                       # Punto de entrada — instancia y arranca el servidor
│   ├── config/
│   │   ├── config.ts                  # Re-exporta librerías y tipos centralizados
│   │   └── timeouts.ts                # Constantes de timeout para todos los providers
│   ├── interfaces/
│   │   └── ia.interfaces.ts           # Interfaz IIAProvider, tipos compartidos
│   ├── Services/
│   │   ├── scraping/
│   │   │   ├── ScrapingService.ts     # Orquesta providers y gestiona páginas del navegador
│   │   │   └── providers/
│   │   │       ├── Gemini.ts          # Implementación para Google Gemini
│   │   │       └── DeepSeek.ts        # Implementación para DeepSeek
│   │   └── utils/
│   │       └── funcionesGenericas.ts  # subirArchivo(), limpiarMarkdown()
│   ├── server/
│   │   ├── server.ts                  # Configura Express y gestiona graceful shutdown
│   │   └── routes/
│   │       └── routerApiIa.ts         # Define todos los endpoints de la API
│   ├── tests/
│   │   ├── limpiarMarkdown.test.ts    # 13 tests unitarios de conversión HTML→Markdown
│   │   └── imagenOcr.test.ts          # 6 tests de integración para OCR
│   └── types/
│       ├── declarations.d.ts
│       └── env.d.ts                   # Tipos para variables de entorno
├── .env                               # Variables de entorno (no versionar)
├── package.json
└── tsconfig.json
```

---

## Agregar un nuevo proveedor de IA

1. Crea `src/Services/scraping/providers/MiIA.ts` implementando `IIAProvider`:

```typescript
import type { Page } from "../../../config/config.js";
import type { IIAProvider, HistoryGrouped } from "../../../interfaces/ia.interfaces.js";
import { limpiarMarkdown, subirArchivo } from "../../utils/funcionesGenericas.js";
import { TIMEOUTS } from "../../../config/timeouts.js";

export class MiIAProvider implements IIAProvider {
    public readonly url = process.env.URL_MI_IA!;

    async validarSelectores(page: Page): Promise<void> { /* ... */ }
    async consultar(page: Page, consulta: string, idConversacion?: string) { /* ... */ }
    async consultarConArchivo(page: Page, consulta: string, rutaArchivo: string, idConversacion?: string) { /* ... */ }
    async extraerHistorial(page: Page): Promise<HistoryGrouped> { /* ... */ }
}
```

2. Agrega el nombre en `src/interfaces/ia.interfaces.ts`:

```typescript
export type IAProviderName = "DeepSeek" | "Gemini" | "MiIA";
```

3. Registra el provider en `src/index.ts` y `src/Services/scraping/ScrapingService.ts`.

4. Agrega la URL en `.env` y actualiza el array de proveedores soportados en `src/server/routes/routerApiIa.ts`:

```typescript
const PROVEEDORES_SOPORTADOS: IAProviderName[] = ["DeepSeek", "Gemini", "MiIA"];
```

---

## Túnel público con Cloudflare

Para exponer la API en internet sin abrir puertos:

```bash
npm run tunel
```

Requiere tener `cloudflared` instalado. El comando crea un túnel HTTPS temporal apuntando a `http://localhost:3500`.

---

## Notas técnicas

- **Cola serial:** `express-queue` con `activeLimit: 1` garantiza que solo una petición interactúa con el navegador a la vez, evitando condiciones de carrera entre tabs.
- **Detección de streaming:** Se usa `waitForFunction` con un snapshot del texto para detectar cuándo el modelo terminó de generar la respuesta (el texto deja de cambiar durante 1500 ms).
- **Contexto persistente:** El directorio `auth/` guarda cookies y localStorage de Chrome, eliminando la necesidad de autenticarse en cada arranque.
- **Graceful shutdown:** Las señales `SIGINT` y `SIGTERM` cierran el contexto de Playwright antes de terminar el proceso.
- **Subida de archivos:** `subirArchivo()` intenta primero un `input[type="file"]` directo y, si falla, usa el flujo botón → filechooser de Playwright (con soporte para sub-menús de 2 pasos como los de Gemini).
