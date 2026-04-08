import { chromium, path, rootRaiz, type Page, type BrowserContext } from "../../config/config.js";
import type { IAProviderName, HistoryGrouped, IIAProvider } from "../../interfaces/ia.interfaces.js";
import type {IConsultaResultado} from "../../interfaces/ia.interfaces.js"
export class ScrapingService {

    private pages: Partial<Record<IAProviderName, Page>> = {};
    private context!: BrowserContext;
    private initialized: boolean = false;
    private readonly providers: Record<IAProviderName, IIAProvider>;

    constructor(private geminiProvider: IIAProvider, private deepSeekProvider: IIAProvider) {
        this.providers = {
            "DeepSeek": this.deepSeekProvider,
            "Gemini": this.geminiProvider
        };
    }

    async iniciar() {
        if (this.initialized) return;
        try {
            const userPath = path.join(rootRaiz, "auth");
            this.context = await chromium.launchPersistentContext(userPath, {
                headless: true,
                channel: "chrome",
                args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
            });

            for (const [name, provider] of Object.entries(this.providers)) {
                const iaName = name as IAProviderName;
                this.pages[iaName] = await this.context.newPage();
                await this.pages[iaName]!.goto(provider.url);
            }

            this.initialized = true;
        } catch (err) {
            console.error(`Error al iniciar navegador:`, err);
            throw err;
        }
    }

    async consultar(proveedor: IAProviderName, consulta: string, idConversacion?: string): Promise<IConsultaResultado> {
        await this.iniciar();
        const page = this.pages[proveedor];
        if (!page) throw new Error(`Página de ${proveedor} no inicializada`);
        try {
            return await this.providers[proveedor].consultar(page, consulta,idConversacion);
        } catch (error: any) {
            console.error(`[ScrapingService] Error en proveedor ${proveedor}:`, error.message);
            throw new Error(`El servicio de ${proveedor} no responde correctamente en este momento.`);
        }
    }

    async obtenerConversaciones(ia: IAProviderName): Promise<HistoryGrouped> {
        try {
            await this.iniciar();
            const page = this.pages[ia];
            if (!page) return {};
            return await this.providers[ia].extraerHistorial(page);
        } catch (error: any) {
            console.error(`[ScrapingService] Fallo al extraer historial de ${ia}:`, error.message);
            return {};
        }
    }
}