import { chromium, path, rootRaiz, type Page, type BrowserContext } from "../../config/config.js";

export class scrapingApiIa {
    private pages: Record<string, Page> = {};
    private context!: BrowserContext;
    private initialized: boolean = false;

    private configIA = {
        "DeepSeek": {
            url: process.env.URLdeepseek,
            selectorInput: "placeholder",
            valorSelector: 'Mensaje a DeepSeek',
            altValorSelector: 'Message DeepSeek',
            selectorRespuesta: '.ds-markdown'
        },
        "Gemini": {
            url: process.env.URLGEMINI,
            selectorInput: "label",
            valorSelector: 'Introduce una petición para Gemini',
            altValorSelector: 'Pregunta a Gemini',
            selectorRespuesta: '.markdown'
        }
    };

    async iniciarPlaywright() {
        if (this.initialized) return;

        try {
            const userPath = path.join(rootRaiz, "auth");
            this.context = await chromium.launchPersistentContext(userPath, {
                headless: false,
                channel: "chrome",
                args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
                viewport: { width: 1280, height: 720 }
            });

            this.pages["DeepSeek"] = this.context.pages()[0] || await this.context.newPage();
            await this.pages["DeepSeek"].goto(this.configIA["DeepSeek"].url);

            this.pages["Gemini"] = await this.context.newPage();
            await this.pages["Gemini"].goto(this.configIA["Gemini"].url);

            this.initialized = true;
            console.log(`[System] Navegador persistente listo.`);
        } catch (err) {
            console.error(`Error al iniciar navegador:`, err);
            this.initialized = false;
            throw err;
        }
    }

    async consultarIa(proveedor: "DeepSeek" | "Gemini", consulta: string) {
        try {
            await this.iniciarPlaywright();
            const config = this.configIA[proveedor];
            const page = this.pages[proveedor];

            if (!page) throw new Error("Proveedor no inicializado");

            return await this.ejecutarConsultaGenerica(page, consulta, config);
        } catch (err) {
            console.error(`Error en flujo ${proveedor}:`, err);
            return `Error al procesar la consulta en ${proveedor}.`;
        }
    }

    private async ejecutarConsultaGenerica(page: Page, consulta: string, config: any) {
        try {
            let inputChat;

            if (config.selectorInput === "placeholder") {
                inputChat = page.getByPlaceholder(config.valorSelector)
                    .or(page.getByPlaceholder(config.altValorSelector));
            } else if (config.selectorInput === "label") {
                inputChat = page.getByLabel(config.valorSelector)
                    .or(page.getByLabel(config.altValorSelector));
            } else {

                inputChat = page.locator(config.valorSelector);
            }
            await inputChat.waitFor({ state: 'visible', timeout: 10000 });

            const selector = config.selectorRespuesta;
            const ultimoAntes = page.locator(selector).last();
            let contenidoViejo = (await ultimoAntes.count() > 0) ? await ultimoAntes.innerText() : "";

            await inputChat.fill(consulta);
            await page.keyboard.press('Enter');

            const respuestaLocator = page.locator(selector).last();

            await page.waitForFunction((args) => {
                const msgs = document.querySelectorAll(args.sel);
                const last = msgs.length > 0 ? (msgs[msgs.length - 1] as HTMLElement).innerText : "";
                return last !== args.old && last.length > 0;
            }, { sel: selector, old: contenidoViejo }, { timeout: 45000 });

            let textoActual = await respuestaLocator.innerText();
            let textoAnterior = "";
            while (textoActual !== textoAnterior || textoActual === "") {
                textoAnterior = textoActual;
                await page.waitForTimeout(1000);
                textoActual = await respuestaLocator.innerText();
            }

            return await this.limpiarMarkdown(respuestaLocator);

        } catch (err) {
            await page.reload();
            throw err;
        }
    }

    private async limpiarMarkdown(locator: any): Promise<string> {
        return await locator.evaluate((container: HTMLElement) => {
            const renderers: Record<string, (el: HTMLElement) => string> = {
                'P': (el) => el.textContent?.trim() || "",
                'H1': (el) => `\n# ${el.textContent?.trim().toUpperCase()}\n`,
                'H2': (el) => `\n## ${el.textContent?.trim().toUpperCase()}\n`,
                'H3': (el) => `\n### ${el.textContent?.trim().toUpperCase()}\n`,
                'PRE': (el) => `\n\`\`\`\n${el.textContent?.trim()}\n\`\`\`\n`,
                'BLOCKQUOTE': (el) => `> ${el.textContent?.trim()}`,
                'HR': () => '\n---\n',
                'UL': (el) => Array.from(el.querySelectorAll('li'))
                    .map(li => `- ${li.textContent?.trim()}`).join('\n'),
                'OL': (el) => Array.from(el.querySelectorAll('li'))
                    .map((li, i) => `${i + 1}. ${li.textContent?.trim()}`).join('\n'),
                'TABLE': (el) => {
                    const rows = Array.from(el.querySelectorAll('tr')) as HTMLTableRowElement[];
                    if (rows.length === 0) return "";

                    const markdownRows = rows.map(tr => {
                        const cells = Array.from(tr.querySelectorAll('th, td'));
                        return `| ${cells.map(c => c.textContent?.trim() || " ").join(' | ')} |`;
                    });

                    const firstRowCells = rows[0]?.querySelectorAll('th, td');
                    const columnCount = firstRowCells?.length || 0;
                    const separator = `| ${Array(columnCount).fill('---').join(' | ')} |`;

                    markdownRows.splice(1, 0, separator);
                    return `\n${markdownRows.join('\n')}\n`;
                }
            };

            const procesar = (el: HTMLElement): string => {
                const handler = renderers[el.tagName];
                if (handler) return handler(el);

                if (el.children.length > 0 && !['P', 'H1', 'H2', 'H3', 'LI'].includes(el.tagName)) {
                    return Array.from(el.children)
                        .map(child => procesar(child as HTMLElement))
                        .join('\n');
                }
                return el.textContent?.trim() || "";
            };


            return Array.from(container.children)
                .map(child => procesar(child as HTMLElement))
                .map(text => {
                    return text
                        .replace(/[\r\t]/g, '')
                        .replace(/\xa0/g, ' ')
                        .replace(/-\d+(-\d+)*/g, '')
                        .trim();
                })
                .filter(text => text.length > 0)
                .join('\n\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        });
    }




}




