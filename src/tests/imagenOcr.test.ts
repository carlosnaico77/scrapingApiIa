/**
 * Test de integración: subida de imagen y OCR.
 *
 * Este test valida que el endpoint POST /api/consultar-archivo:
 *  1. Acepta una imagen multipart/form-data
 *  2. La envía al provider correcto
 *  3. Devuelve una respuesta que contiene el texto visible en la imagen
 *
 * Usa Playwright para generar la imagen de prueba (sin dependencias extra).
 * Requiere que el servidor esté corriendo y el usuario esté autenticado en la IA.
 *
 * Ejecutar solo este test:
 *   node --test dist/tests/imagenOcr.test.js
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from 'playwright';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink, access } from 'node:fs/promises';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Genera una imagen PNG con el texto indicado usando Playwright headless. */
async function generarImagenConTexto(texto: string, outputPath: string): Promise<void> {
    const browser: Browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const page: Page = await browser.newPage();
    await page.setContent(`
        <html>
        <body style="margin:0;background:#fff;display:flex;align-items:center;justify-content:center;height:200px;">
            <div style="font-family:monospace;font-size:48px;font-weight:bold;color:#000;padding:20px;border:3px solid #000">
                ${texto}
            </div>
        </body>
        </html>
    `);
    await page.screenshot({ path: outputPath, fullPage: true });
    await browser.close();
}

/** Llama al endpoint local con multipart/form-data usando fetch nativo (Node 18+). */
async function consultarArchivo(params: {
    agente: string;
    consulta: string;
    imagePath: string;
    port?: number;
}): Promise<{ success: boolean; message: string; idConversacion: string }> {
    const { agente, consulta, imagePath, port = 3500 } = params;
    const { readFile } = await import('node:fs/promises');
    const { basename } = await import('node:path');

    const contenido = await readFile(imagePath);
    const formData = new FormData();
    formData.append('agente', agente);
    formData.append('consulta', consulta);
    formData.append('archivo', new Blob([contenido], { type: 'image/png' }), basename(imagePath));

    const resp = await fetch(`http://localhost:${port}/api/consultar-archivo`, {
        method: 'POST',
        body: formData,
    });

    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${body}`);
    }
    return resp.json() as Promise<{ success: boolean; message: string; idConversacion: string }>;
}

// ── Tests ──────────────────────────────────────────────────────────────────

const TEXTO_EN_IMAGEN = 'HOLA2025';
const imagePath = join(tmpdir(), 'test-ocr-imagen.png');

before(async () => {
    await generarImagenConTexto(TEXTO_EN_IMAGEN, imagePath);
    console.log(`[setup] Imagen de prueba generada: ${imagePath}`);
});

after(async () => {
    await unlink(imagePath).catch(() => undefined);
});

describe('POST /api/consultar-archivo — OCR con imagen', () => {

    test('el servidor está corriendo antes de ejecutar los tests', async () => {
        try {
            const resp = await fetch('http://localhost:3500/api/health');
            assert.equal(resp.status, 200, 'El servidor debe responder en /api/health');
        } catch {
            assert.fail('El servidor no está corriendo en http://localhost:3500. Inicia el servidor con "npm run dev" antes de ejecutar este test.');
        }
    });

    test('la imagen de prueba fue generada correctamente', async () => {
        await assert.doesNotReject(
            access(imagePath),
            'El archivo de imagen de prueba debe existir'
        );
    });

    test('Gemini reconoce el texto en la imagen (OCR)', async () => {
        const resultado = await consultarArchivo({
            agente: 'gemini',
            consulta: '¿Qué texto ves en esta imagen? Responde solo con el texto exacto que aparece.',
            imagePath,
        });

        assert.equal(resultado.success, true, 'La respuesta debe indicar éxito');
        assert.ok(resultado.message.length > 0, 'La respuesta debe tener contenido');
        assert.ok(
            resultado.message.toUpperCase().includes(TEXTO_EN_IMAGEN),
            `La respuesta debe contener "${TEXTO_EN_IMAGEN}". Respuesta recibida: "${resultado.message}"`
        );
        assert.ok(resultado.idConversacion.length > 0, 'Debe retornar un idConversacion');
        console.log(`[gemini] ID conversación: ${resultado.idConversacion}`);
        console.log(`[gemini] Respuesta: ${resultado.message}`);
    });

    test('DeepSeek reconoce el texto en la imagen (OCR)', async () => {
        const resultado = await consultarArchivo({
            agente: 'deepseek',
            consulta: '¿Qué texto ves en esta imagen? Responde solo con el texto exacto que aparece.',
            imagePath,
        });

        assert.equal(resultado.success, true, 'La respuesta debe indicar éxito');
        assert.ok(resultado.message.length > 0, 'La respuesta debe tener contenido');
        assert.ok(
            resultado.message.toUpperCase().includes(TEXTO_EN_IMAGEN),
            `La respuesta debe contener "${TEXTO_EN_IMAGEN}". Respuesta recibida: "${resultado.message}"`
        );
        assert.ok(resultado.idConversacion.length > 0, 'Debe retornar un idConversacion');
        console.log(`[deepseek] ID conversación: ${resultado.idConversacion}`);
        console.log(`[deepseek] Respuesta: ${resultado.message}`);
    });

    test('el endpoint rechaza archivos sin campo "archivo"', async () => {
        const resp = await fetch('http://localhost:3500/api/consultar-archivo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agente: 'gemini', consulta: 'test' }),
        });
        // Sin multipart, multer no procesa el body → consulta/agente vacíos → 400
        assert.ok(resp.status >= 400, 'Debe rechazar petición sin archivo con 4xx');
    });

    test('el endpoint rechaza agente no soportado', async () => {
        const contenido = await import('node:fs/promises').then(m => m.readFile(imagePath));
        const formData = new FormData();
        formData.append('agente', 'chatgpt');
        formData.append('consulta', 'test');
        formData.append('archivo', new Blob([contenido], { type: 'image/png' }), 'test.png');

        const resp = await fetch('http://localhost:3500/api/consultar-archivo', {
            method: 'POST',
            body: formData,
        });
        assert.equal(resp.status, 404, 'Debe responder 404 para agente no soportado');
    });
});
