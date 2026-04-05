# ScrapingApiIa

API REST que automatiza consultas a múltiples IAs (Google Gemini y DeepSeek) mediante automatización de navegador con Playwright, sin necesidad de APIs de pago oficiales.

> Proyecto por **Carlos Lozano** y **Jhonatan Ramirez**

---

## ¿Qué hace?

- Lanza un navegador Chromium en segundo plano con sesión persistente
- Recibe consultas via HTTP y las envía al chat de la IA elegida
- Espera y extrae la respuesta del DOM
- Devuelve la respuesta limpia en formato Markdown
- Soporta múltiples proveedores de IA con arquitectura extensible

---

## Tecnologías

| Capa               | Tecnología                      |
|--------------------|---------------------------------|
| Framework          | Express 5                       |
| Automatización     | Playwright (Chromium)           |
| Lenguaje           | TypeScript (ES Modules)         |
| Seguridad          | Helmet, Morgan                  |
| Cola de peticiones | express-queue (activeLimit: 1)  |
| Túnel externo      | cloudflared                     |

---

## Estructura del Proyecto

```
src/
├── index.ts                          # Punto de entrada
├── config/
│   └── config.ts                     # Exportaciones centralizadas
├── server/
│   ├── server.ts                     # Express + middlewares
│   └── routes/
│       └── routerApiIa.ts            # Endpoints REST
├── Services/
│   ├── scraping/
│   │   ├── ScrapingService.ts        # Orquestador principal
│   │   └── providers/
│   │       ├── Gemini.ts             # Proveedor Google Gemini
│   │       └── DeepSeek.ts          # Proveedor DeepSeek
│   └── utils/
│       └── funcionesGenericas.ts     # Conversión HTML → Markdown
└── interfaces/
    └── ia.interfaces.ts              # Tipos TypeScript
```

---

## Instalación

```bash
# Instalar dependencias
npm install

# Instalar navegadores de Playwright
npx playwright install chromium
```

---

## Configuración

Crear un archivo `.env` en la raíz del proyecto:

```env
URLdeepseek=https://chat.deepseek.com
URLGEMINI=https://gemini.google.com
PORT=3500
```

> La primera vez debes autenticarte manualmente en cada IA. Las sesiones se guardan en la carpeta `/auth`.

---

## Uso

```bash
# Compilar y ejecutar
npm run dev

# Exponer con túnel público (opcional)
npm run tunel
```

---

## Endpoints

### `POST /api/consultar`

Envía una consulta a la IA especificada.

**Body:**
```json
{
  "agente": "gemini",
  "consulta": "¿Cuál es la capital de Francia?"
}
```

**Respuesta:**
```json
{
  "respuesta": "La capital de Francia es **París**."
}
```

**Agentes disponibles:** `gemini`, `deepseek`

---

### `GET /api/conversaciones/:ia`

Obtiene el historial de conversaciones de la IA indicada.

**Ejemplo:**
```
GET /api/conversaciones/gemini
```

---

## Flujo Interno

```
POST /api/consultar
  → express-queue (serializa: 1 petición a la vez)
  → ScrapingService.consultar()
  → Provider.consultar()   ← interactúa con el navegador
  → espera respuesta en el DOM
  → limpiarMarkdown(html)
  → { respuesta: "..." }
```

---

## Decisiones de Arquitectura

- **Patrón Proveedor** — Cada IA implementa la interfaz `IIAProvider`. Agregar una nueva IA es tan simple como crear un nuevo archivo en `providers/`.
- **Sesión persistente** — El navegador guarda cookies en `/auth` para no requerir login en cada reinicio.
- **Cola serial** — Solo se procesa 1 petición a la vez para evitar condiciones de carrera en el navegador.
- **HTML to Markdown** — Las respuestas se normalizan antes de devolverse al cliente.

---

## Licencia

ISC
