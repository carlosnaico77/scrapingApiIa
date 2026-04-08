# Documentación de la API de Scraping IA

La API de Scraping IA permite interactuar con los motores de Inteligencia Artificial (Gemini y DeepSeek) en una interfaz centralizada. Opera sobre el puerto `3500` mediante el prefijo `/api`.

Toda la comunicación de entrada y salida se realiza en formato **JSON**.

---

## 1. Consultar a un Agente (Enviar Mensaje)

Envía un mensaje o consulta a una IA específica. Si proporcionas un `idConversacion`, el mensaje continuará el hilo en ese mismo chat. De lo contrario, se creará un chat nuevo.

**Endpoint:**
`POST /api/consultar`

**Headers:**
- `Content-Type: application/json`

**Cuerpo de la Petición (Body):**
```json
{
  "agente": "Gemini", 
  "consulta": "¿Cuál es la capital de Francia?",
  "idConversacion": "opcional_id_del_chat"
}
```

* **agente** (*string*): Nombre de la inteligencia artificial. Valores soportados: `"DeepSeek"`, `"Gemini"`.
* **consulta** (*string*): El texto o requerimiento que quieres enviarle a la IA.
* **idConversacion** (*string*, opcional): El ID devuelto en una consulta previa si se desea mantener el contexto del chat.

**Respuestas Exitosas (200 OK):**
```json
{
  "success": true,
  "agente": "Gemini",
  "message": "La capital de Francia es París.",
  "idConversacion": "x8fg2lP",
  "titulo": "Capital de Francia"
}
```

**Respuestas de Error:**
* **400 Bad Request:** `{"error": "Faltan datos"}` *(Si no envías el agente o la consulta)*
* **404 Not Found:** `{"error": "IA no soportada"}` *(Si el nombre del agente no existe)*
* **503 Service Unavailable:** `{"success": false, "error": "[ScrapingService] Error en proveedor..."}` *(Si falla la extracción o el navegador)*

---

## 2. Obtener Historial de Conversaciones

Recupera todo el historial de chats existentes asociados a uno de los agentes de IA.

**Endpoint:**
`GET /api/conversaciones/:ia`

**Parámetros de Ruta:**
* **:ia** (*string*): Nombre de la IA para obtener el historial. Ejemplos: `deepseek`, `gemini`.

**Respuestas Exitosas (200 OK):**
```json
{
  "success": true,
  "ia": "DeepSeek",
  "total": 5,
  "data": {
    "0": [
      {
        "id": "ad82js",
        "title": "Receta de pollo asado",
        "url": "https://chat.deepseek.com/a/chat/s/ad82js",
        "listGroup": 0
      }
    ]
  }
}
```

**Respuestas de Error:**
* **500 Internal Server Error:** `{"success": false, "error": "Mensaje del error..."}` *(Si falla la manipulación del navegador)*

---

## 💡 Notas Importantes
- **Limitación (Queueing)**: Para evitar cuelgues en el servidor o bloqueos por múltiples peticiones asíncronas de scraping, el sistema tiene una cola activa (`activeLimit: 1`). Esto significa que las encuestas se despachan a la IA estrictamente de una por una.
- **Tiempos de Espera**: Debido a los tiempos de carga naturales o a la IA escribiendo tu respuesta, el endpoint general de `/consultar` tomará varios segundos y mantendrá la conexión abierta hasta recibir el texto completo.
