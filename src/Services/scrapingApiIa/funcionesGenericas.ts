import type { Locator } from "../../config/config.js"


/* En este archivo iran funciones generales que sirven para cualquier parte de la aplicacion y mejorar el funcionamiento, en este caso esta funcion sirve para limpiar el html recibido en una respuesta ia y convertirlo de texto legible */
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