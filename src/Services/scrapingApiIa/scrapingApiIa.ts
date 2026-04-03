import { chromium, path, rootRaiz, type Page, type BrowserContext } from "../../config/config.js";

export class scrapingApiIa {
    private page!: Page;
    private context!: BrowserContext;
    private initialized: boolean = false;

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

            this.page = this.context.pages()[0] || await this.context.newPage();
            await this.page.goto(process.env.URLdeepseek!);
            this.initialized = true;
            console.log(`[System] Navegador persistente listo.`);
        } catch (err) {
            console.error(`Error al iniciar navegador:`, err);
            this.initialized = false;
            throw err;
        }
    }

    async consultarIadeepseek(consulta: string) {
        try {
            await this.iniciarPlaywright();
            return await this.ejecutarConsulta(consulta);
        } catch (err) {
            console.error("Error en flujo:", err);
            return "Error al procesar la consulta.";
        }
    }

    private async ejecutarConsulta(consulta: string) {
        try {
            const inputChat = this.page.getByPlaceholder('Mensaje a DeepSeek').or(this.page.getByPlaceholder("Message DeepSeek"));
            await inputChat.waitFor({ state: 'visible', timeout: 10000 });

            const selector = '.ds-markdown';
            const ultimoAntes = this.page.locator(selector).last();
            let contenidoViejo = (await ultimoAntes.count() > 0) ? await ultimoAntes.innerText() : "";

            await inputChat.fill(consulta);
            await this.page.keyboard.press('Enter');

            const respuestaLocator = this.page.locator(selector).last();

            await this.page.waitForFunction((args) => {
                const msgs = document.querySelectorAll(args.sel);
                const last = msgs.length > 0 ? (msgs[msgs.length - 1] as HTMLElement).innerText : "";
                return last !== args.old && last.length > 0;
            }, { sel: selector, old: contenidoViejo }, { timeout: 40000 });

            let textoActual = await respuestaLocator.innerText();
            let textoAnterior = "";
            while (textoActual !== textoAnterior || textoActual === "") {
                textoAnterior = textoActual;
                await this.page.waitForTimeout(1000);
                textoActual = await respuestaLocator.innerText();
            }
            console.log(await this.limpiarMarkdown(respuestaLocator))
            return await this.limpiarMarkdown(respuestaLocator);
        } catch (err) {
            await this.page.reload();
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