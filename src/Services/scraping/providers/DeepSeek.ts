import type { Page } from "../../../config/config.js";
import type { HistoryGrouped, IIAProvider } from "../../../interfaces/ia.interfaces.js";
import { limpiarMarkdown, subirArchivo } from "../../utils/funcionesGenericas.js";
import { TIMEOUTS } from "../../../config/timeouts.js";

// Selectores centralizados — fácil de actualizar si DeepSeek cambia su UI
const SELECTORES = {
    // Posibles selectores de respuesta en orden de prioridad (DeepSeek cambia sus clases frecuentemente)
    respuestaCandidatos: [
        '.ds-markdown',
        '[class*="markdown"]',
        '.md',
        '[class*="message-content"]',
        '[class*="reply"]',
        '[class*="response"]',
        '[class*="assistant"]',
        '[class*="answer"]',
        '[class*="chat-message"]',
        'article',
    ],
    respuesta: '.ds-markdown',
    panelSidebar: '.b8812f16',
    botonAbrirSidebar: '.ds-icon-button',
    itemChat: 'a[href*="/chat/"]',
    // Selectores candidatos para el botón de adjuntar archivo (en orden de prioridad)
    botonesUpload: [
        'button[aria-label*="Attach"]',
        'button[aria-label*="Upload"]',
        'button[aria-label*="adjuntar"]',
        'button[aria-label*="Adjuntar"]',
        'label[for*="file"]',
    ],
} as const;

/** Detecta en tiempo real qué selector de respuesta existe en la página actual */
async function resolverSelectorRespuesta(page: Page): Promise<string> {
    for (const sel of SELECTORES.respuestaCandidatos) {
        if (await page.locator(sel).count() > 0) return sel;
    }
    // Fallback: devuelve el primero aunque no esté presente, la espera lo encontrará
    return SELECTORES.respuestaCandidatos[0] ?? SELECTORES.respuesta;
}

const PLACEHOLDERS = {
    principal: 'Mensaje a DeepSeek',
    alternativo: 'Message DeepSeek',
} as const;

export class DeepSeekProvider implements IIAProvider {

    public readonly url = process.env.URLdeepseek!;

    async validarSelectores(page: Page): Promise<void> {
        const criticos: Array<{ nombre: string; selector: string }> = [
            { nombre: 'respuesta', selector: SELECTORES.respuesta },
            { nombre: 'itemChat', selector: SELECTORES.itemChat },
        ];
        const faltantes = await Promise.all(
            criticos.map(async ({ nombre, selector }) => {
                const count = await page.locator(selector).count();
                return count === 0 ? `${nombre} ("${selector}")` : null;
            })
        );
        const problemas = faltantes.filter(Boolean);
        if (problemas.length > 0) {
            console.warn(`[DeepSeekProvider] Selectores no encontrados: ${problemas.join(', ')}`);
        }
    }

    async consultar(page: Page, consulta: string, idConversacion?: string): Promise<{ texto: string, id: string, titulo: string }> {
        try {

            if (idConversacion && idConversacion.trim() !== "") {
                
                const urlDestino = `${this.url}/a/chat/s/${idConversacion}`;

                if (!page.url().includes(idConversacion)) {
                    await page.goto(urlDestino, { waitUntil: 'networkidle' });
                }
            } else {
                // Para chat nuevo, la raíz suele ser suficiente
                if (page.url().includes('/chat/')) {
                    await page.goto(`${this.url}/`, { waitUntil: 'networkidle' });
                }
            }
            const inputChat = page
                .getByPlaceholder(PLACEHOLDERS.principal)
                .or(page.getByPlaceholder(PLACEHOLDERS.alternativo));
            await inputChat.waitFor({ state: 'visible', timeout: TIMEOUTS.esperarInput });

            const selectorRespuesta = await resolverSelectorRespuesta(page);
            const ultimoAntes = page.locator(selectorRespuesta).last();
            const contenidoViejo = (await ultimoAntes.count() > 0) ? await ultimoAntes.innerText() : "";

            await inputChat.fill(consulta);
            await page.keyboard.press('Enter');

            // Esperar que aparezca una respuesta nueva (distinta al mensaje anterior)
            await page.waitForFunction(
                (args: { sel: string; old: string }) => {
                    const msgs = document.querySelectorAll(args.sel);
                    const last = msgs.length > 0 ? (msgs[msgs.length - 1] as HTMLElement).innerText : "";
                    return last !== args.old && last.length > 0;
                },
                { sel: selectorRespuesta, old: contenidoViejo },
                { timeout: TIMEOUTS.esperarRespuesta }
            );

            // Esperar que el texto deje de cambiar (streaming finalizado)
            await page.waitForFunction(
                (args: { sel: string; stableMs: number }) =>
                    new Promise<boolean>((resolve) => {
                        const els = document.querySelectorAll(args.sel);
                        const last = els[els.length - 1] as HTMLElement | undefined;
                        if (!last?.innerText) { resolve(false); return; }
                        const snapshot = last.innerText;
                        setTimeout(() => resolve(last.innerText === snapshot), args.stableMs);
                    }),
                { sel: selectorRespuesta, stableMs: TIMEOUTS.estabilizarTexto },
                { timeout: TIMEOUTS.esperarRespuesta }
            );

            const textoFinal = await limpiarMarkdown(page.locator(selectorRespuesta).last());
            const urlActual = page.url();
            const nuevoId = urlActual.split('/').pop()?.split('?')[0] || "";

            // Intentamos sacar el título del sidebar o de la URL
            const titulo = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                return el ? (el as HTMLElement).innerText.split('\n')[0] : "Chat de DeepSeek";
            }, SELECTORES.itemChat).catch(() => "Chat de DeepSeek");

            return {
                texto: textoFinal,
                id: nuevoId ?? "",
                titulo: titulo ?? "Chat sin título"
            };
        } catch (err) {
            // Diagnóstico: loguear qué selectores existen para ayudar a actualizar SELECTORES
            const diag = await page.evaluate(() =>
                ['.ds-markdown', '[class*="markdown"]', '.md', '[class*="message"]',
                 '[class*="content"]', '[class*="reply"]', '[class*="assistant"]', 'article']
                    .map(s => `${s}:${document.querySelectorAll(s).length}`)
                    .join(' | ')
            ).catch(() => 'evaluate failed');
            console.warn(`[DeepSeek] Selectores en página: ${diag}`);
            await page.reload();
            throw err;
        }
    }

    async consultarConArchivo(page: Page, consulta: string, rutaArchivo: string, idConversacion?: string): Promise<{ texto: string; id: string; titulo: string }> {
        try {
            if (idConversacion && idConversacion.trim() !== "") {
                const urlDestino = `${this.url}/a/chat/s/${idConversacion}`;
                if (!page.url().includes(idConversacion)) {
                    await page.goto(urlDestino, { waitUntil: 'networkidle' });
                }
            } else {
                if (page.url().includes('/chat/')) {
                    await page.goto(`${this.url}/`, { waitUntil: 'networkidle' });
                }
            }

            const inputChat = page
                .getByPlaceholder(PLACEHOLDERS.principal)
                .or(page.getByPlaceholder(PLACEHOLDERS.alternativo));
            await inputChat.waitFor({ state: 'visible', timeout: TIMEOUTS.esperarInput });

            // Diagnóstico previo al upload: loguear qué file-inputs y botones existen
            const diagUpload = await page.evaluate(() => {
                const inputs = Array.from(document.querySelectorAll('input[type="file"]'))
                    .map((el, i) => `input[${i}]: accept="${el.getAttribute('accept')}" name="${el.getAttribute('name')}" id="${el.id}"`);
                const buttons = Array.from(document.querySelectorAll('button[aria-label], [data-testid], [role="button"]'))
                    .slice(0, 20)
                    .map(el => `btn: aria="${el.getAttribute('aria-label')}" testid="${el.getAttribute('data-testid')}" class="${el.className.slice(0, 40)}"`);
                return [...inputs, ...buttons].join('\n');
            });
            console.log('[DeepSeek upload diag]\n', diagUpload);

            // Adjuntar archivo (intenta input directo primero, luego filechooser)
            await subirArchivo(page, rutaArchivo, [...SELECTORES.botonesUpload]);

            // Esperar que el archivo aparezca procesado en el UI
            await page.waitForTimeout(2000);

            const selectorRespuesta = await resolverSelectorRespuesta(page);
            const ultimoAntes = page.locator(selectorRespuesta).last();
            const contenidoViejo = (await ultimoAntes.count() > 0) ? await ultimoAntes.innerText() : "";

            // Usar click + keyboard.type en lugar de fill() para no perder el adjunto
            await inputChat.click();
            await page.keyboard.type(consulta);
            await page.keyboard.press('Enter');

            await page.waitForFunction(
                (args: { sel: string; old: string }) => {
                    const msgs = document.querySelectorAll(args.sel);
                    const last = msgs.length > 0 ? (msgs[msgs.length - 1] as HTMLElement).innerText : "";
                    return last !== args.old && last.length > 0;
                },
                { sel: selectorRespuesta, old: contenidoViejo },
                { timeout: TIMEOUTS.esperarRespuesta }
            );

            await page.waitForFunction(
                (args: { sel: string; stableMs: number }) =>
                    new Promise<boolean>((resolve) => {
                        const els = document.querySelectorAll(args.sel);
                        const last = els[els.length - 1] as HTMLElement | undefined;
                        if (!last?.innerText) { resolve(false); return; }
                        const snapshot = last.innerText;
                        setTimeout(() => resolve(last.innerText === snapshot), args.stableMs);
                    }),
                { sel: selectorRespuesta, stableMs: TIMEOUTS.estabilizarTexto },
                { timeout: TIMEOUTS.esperarRespuesta }
            );

            const textoFinal = await limpiarMarkdown(page.locator(selectorRespuesta).last());
            const urlActual = page.url();
            const nuevoId = urlActual.split('/').pop()?.split('?')[0] ?? "";
            const titulo = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                return el ? (el as HTMLElement).innerText.split('\n')[0] : "Chat de DeepSeek";
            }, SELECTORES.itemChat).catch(() => "Chat de DeepSeek");

            return { texto: textoFinal, id: nuevoId, titulo: titulo ?? "Chat sin título" };
        } catch (err) {
            const diag = await page.evaluate(() =>
                ['.ds-markdown', '[class*="markdown"]', '.md', '[class*="message"]',
                 '[class*="content"]', '[class*="reply"]', '[class*="assistant"]', 'article']
                    .map(s => `${s}:${document.querySelectorAll(s).length}`)
                    .join(' | ')
            ).catch(() => 'evaluate failed');
            console.warn(`[DeepSeek archivo] Selectores en página: ${diag}`);
            await page.reload();
            throw err;
        }
    }

    async extraerHistorial(page: Page): Promise<HistoryGrouped> {
        try {
            const panel = page.locator(SELECTORES.panelSidebar);
            const estaCerrado = !(await panel.isVisible());

            if (estaCerrado) {
                const btnAbrir = page.locator(SELECTORES.botonAbrirSidebar).first();
                if (await btnAbrir.count() > 0) {
                    await btnAbrir.click();
                    await page.waitForSelector(SELECTORES.itemChat, {
                        state: 'attached',
                        timeout: TIMEOUTS.sidebar,
                    });
                }
            }

            const chats = await page.evaluate((sel: string) => {
                const results: Array<{ id: string; title: string; url: string }> = [];
                document.querySelectorAll(sel).forEach((el, index) => {
                    if (el instanceof HTMLElement) {
                        const href = el.getAttribute('href') ?? '';
                        const cleanTitle = el.innerText.split('\n')[0]?.trim() ?? 'Sin título';
                        results.push({
                            id: href.split('/').pop() ?? `ds-${index}`,
                            title: cleanTitle || 'Sin título',
                            url: href,
                        });
                    }
                });
                return results;
            }, SELECTORES.itemChat);

            const final: HistoryGrouped = { 0: [] };
            chats.forEach(chat => {
                (final[0] ??= []).push({ ...chat, listGroup: 0 });
            });
            return final;

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error(`[DeepSeekProvider] Error al extraer historial:`, msg);
            return { 0: [] };
        }
    }
}
