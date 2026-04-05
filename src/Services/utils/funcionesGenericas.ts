import type { Locator, Page, FileChooser } from "../../config/config.js";

// Opciones de sub-menú que Gemini muestra al hacer clic en el botón de adjuntar
const SELECTORES_MENU_UPLOAD = [
    '[data-test-id="upload-from-computer"]',
    '[data-test-id="upload-image"]',
    'li[role="menuitem"]:visible',
    '[role="menuitem"]:visible',
    '[role="option"]:visible',
];

/**
 * Adjunta un archivo a una página web via Playwright.
 *
 * Estrategia 1 — `input[type="file"]` directo: funciona aunque esté oculto (ej. DeepSeek).
 * Estrategia 2 — botón → filechooser: para UIs que no exponen el input directamente (ej. Gemini).
 *   Maneja flujos de 1 paso (botón → filechooser) y 2 pasos (botón → menú → opción → filechooser).
 */
export async function subirArchivo(page: Page, rutaArchivo: string, selectoresBoton: string[]): Promise<void> {
    // Estrategia 1: input[type="file"] directo (sin esperar, falla rápido si no está)
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
        try {
            await fileInput.setInputFiles(rutaArchivo, { timeout: 3_000 });
            return;
        } catch {
            // Input existe pero no es accesible directamente, continuar con el botón
        }
    }

    // Estrategia 2: botón → filechooser (con soporte para sub-menú de 2 pasos)
    for (const selector of selectoresBoton) {
        const btn = page.locator(selector).first();
        if ((await btn.count()) === 0) continue;

        let chooserPromise: Promise<FileChooser> | null = null;
        try {
            chooserPromise = page.waitForEvent('filechooser', { timeout: 15_000 });
            // Silenciar INMEDIATAMENTE (antes de cualquier await) para prevenir
            // UnhandledRejection si el timeout vence mientras ejecutamos otra lógica
            chooserPromise.catch(() => undefined);

            await btn.click();

            // Esperar brevemente y chequear si apareció un sub-menú
            await page.waitForTimeout(600);
            for (const menuSel of SELECTORES_MENU_UPLOAD) {
                const item = page.locator(menuSel).first();
                if ((await item.count()) > 0 && await item.isVisible()) {
                    await item.click();
                    break;
                }
            }

            const chooser = await chooserPromise;
            await chooser.setFiles(rutaArchivo);
            return;
        } catch {
            // Selector no funcionó, probar el siguiente
        }
    }

    // Diagnóstico: listar elementos relevantes para facilitar debugging
    const debug = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button[aria-label], [data-test-id], input[type="file"]'))
            .map(el => `${el.tagName}[aria-label="${el.getAttribute('aria-label')}"][data-test-id="${el.getAttribute('data-test-id')}"]`)
            .join('\n')
    );
    console.warn('[subirArchivo] Elementos en página:\n', debug);

    throw new Error('No se encontró el mecanismo de subida de archivos en la página');
}

export async function limpiarMarkdown(locator: Locator): Promise<string> {
    return await locator.evaluate((container: HTMLElement) => {
        const renderers: Record<string, (el: HTMLElement) => string> = {
            'P': (el) => el.textContent?.trim() || "",
            'H1': (el) => `\n# ${el.textContent?.trim().toUpperCase()}\n`,
            'H2': (el) => `\n## ${el.textContent?.trim().toUpperCase()}\n`,
            'H3': (el) => `\n### ${el.textContent?.trim().toUpperCase()}\n`,
            'PRE': (el) => `\n\`\`\`\n${el.textContent?.trim()}\n\`\`\`\n`,
            'BLOCKQUOTE': (el) => `> ${el.textContent?.trim()}`,
            'HR': () => '\n---\n',
            'UL': (el) => Array.from(el.querySelectorAll('li')).map(li => `- ${li.textContent?.trim()}`).join('\n'),
            'OL': (el) => Array.from(el.querySelectorAll('li')).map((li, i) => `${i + 1}. ${li.textContent?.trim()}`).join('\n'),
            'TABLE': (el) => {
                const rows = Array.from(el.querySelectorAll('tr')) as HTMLTableRowElement[];
                if (rows.length === 0) return "";
                const markdownRows = rows.map(tr => {
                    const cells = Array.from(tr.querySelectorAll('th, td'));
                    return `| ${cells.map(c => c.textContent?.trim() || " ").join(' | ')} |`;
                });
                const columnCount = rows[0]?.querySelectorAll('th, td').length || 0;
                const separator = `| ${Array(columnCount).fill('---').join(' | ')} |`;
                markdownRows.splice(1, 0, separator);
                return `\n${markdownRows.join('\n')}\n`;
            }
        };

        const procesar = (el: HTMLElement): string => {
            const handler = renderers[el.tagName];
            if (handler) return handler(el);
            if (el.children.length > 0 && !['P', 'H1', 'H2', 'H3', 'LI', 'PRE'].includes(el.tagName)) {
                return Array.from(el.children).map(child => procesar(child as HTMLElement)).join('\n');
            }
            return el.textContent?.trim() || "";
        };

        return Array.from(container.children)
            .map(child => procesar(child as HTMLElement))
            .map(text => text.replace(/[\r\t]/g, '').replace(/\xa0/g, ' ').trim())
            .filter(text => text.length > 0)
            .join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
    });
}