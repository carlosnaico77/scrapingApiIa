/**
 * Tests de integración para limpiarMarkdown.
 * Usa Playwright directamente para ejecutar la función en un browser real,
 * igual que lo hace en producción.
 *
 * Ejecutar: npm test
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from 'playwright';
import { limpiarMarkdown } from '../Services/utils/funcionesGenericas.js';

let browser: Browser;
let page: Page;

before(async () => {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    page = await browser.newPage();
});

after(async () => {
    await browser.close();
});

async function evaluar(html: string): Promise<string> {
    await page.setContent(`<div id="root">${html}</div>`);
    const locator = page.locator('#root');
    return limpiarMarkdown(locator);
}

describe('limpiarMarkdown', () => {

    test('convierte párrafos a texto plano', async () => {
        const result = await evaluar('<p>Hola mundo</p>');
        assert.equal(result, 'Hola mundo');
    });

    test('convierte H1 a markdown con #', async () => {
        const result = await evaluar('<h1>Título principal</h1>');
        assert.match(result, /^# TÍTULO PRINCIPAL$/m);
    });

    test('convierte H2 a markdown con ##', async () => {
        const result = await evaluar('<h2>Subtítulo</h2>');
        assert.match(result, /^## SUBTÍTULO$/m);
    });

    test('convierte H3 a markdown con ###', async () => {
        const result = await evaluar('<h3>Sección</h3>');
        assert.match(result, /^### SECCIÓN$/m);
    });

    test('convierte bloques de código con PRE', async () => {
        const result = await evaluar('<pre>const x = 1;</pre>');
        assert.match(result, /```\nconst x = 1;\n```/);
    });

    test('convierte listas desordenadas UL', async () => {
        const result = await evaluar('<ul><li>Item A</li><li>Item B</li></ul>');
        assert.match(result, /- Item A/);
        assert.match(result, /- Item B/);
    });

    test('convierte listas ordenadas OL con numeración', async () => {
        const result = await evaluar('<ol><li>Primero</li><li>Segundo</li></ol>');
        assert.match(result, /1\. Primero/);
        assert.match(result, /2\. Segundo/);
    });

    test('convierte BLOCKQUOTE con >', async () => {
        const result = await evaluar('<blockquote>Cita importante</blockquote>');
        assert.match(result, /^> Cita importante$/m);
    });

    test('convierte HR a separador ---', async () => {
        const result = await evaluar('<p>Antes</p><hr><p>Después</p>');
        assert.match(result, /---/);
    });

    test('convierte TABLE a markdown con pipes', async () => {
        const result = await evaluar(`
            <table>
                <tr><th>Nombre</th><th>Edad</th></tr>
                <tr><td>Ana</td><td>30</td></tr>
            </table>
        `);
        assert.match(result, /\| Nombre \| Edad \|/);
        assert.match(result, /\| Ana \| 30 \|/);
        assert.match(result, /\| --- \| --- \|/);
    });

    test('elimina líneas en blanco múltiples', async () => {
        const result = await evaluar('<p>A</p><p>B</p><p>C</p>');
        assert.doesNotMatch(result, /\n{3,}/);
    });

    test('maneja contenedor vacío sin errores', async () => {
        const result = await evaluar('');
        assert.equal(result, '');
    });

    test('procesa contenido anidado correctamente', async () => {
        const result = await evaluar(`
            <h2>Resumen</h2>
            <p>Descripción del tema.</p>
            <ul>
                <li>Punto 1</li>
                <li>Punto 2</li>
            </ul>
        `);
        assert.match(result, /## RESUMEN/);
        assert.match(result, /Descripción del tema\./);
        assert.match(result, /- Punto 1/);
    });
});
