import { describe, it, expect, beforeAll } from 'vitest';
import { ScrapingService } from '../Services/scraping/ScrapingService.js';
import { GeminiProvider } from '../Services/scraping/providers/Gemini.js';
import { DeepSeekProvider } from '../Services/scraping/providers/DeepSeek.js';

describe('ScrapingService - Pruebas de Precisión (Como un reloj)', () => {
    let service: ScrapingService;

    beforeAll(async () => {
        const gemini = new GeminiProvider();
        const deepseek = new DeepSeekProvider();
        service = new ScrapingService(gemini, deepseek);
    });

    describe('Proveedor: Gemini', () => {
        let lastId: string | undefined;

        it('1. Debe iniciar un chat nuevo y obtener un ID válido', async () => {
            const result = await service.consultar('Gemini', 'Hola, genera una respuesta corta para un test de ID.');
            expect(result.id).toBeDefined();
            expect(result.id?.length).toBeGreaterThan(5);
            lastId = result.id;
            console.log(`   [Gemini] ID obtenido: ${lastId}`);
        }, 60000);

        it('2. Debe retomar la conversación anterior usando el ID', async () => {
            expect(lastId).toBeDefined();
            const result = await service.consultar('Gemini', '¿Qué fue lo último que te pregunté? Responde breve.', lastId);
            
            console.log(`   [Gemini] ID enviado: ${lastId ?? 'N/A'} | ID recibido: ${result.id ?? 'N/A'}`);
            // Verificamos que el ID se mantenga, lo que confirma que no creó un chat nuevo
            expect(result.id).toBe(lastId);
        }, 60000);

        it('3. Debe extraer el historial y contar las conversaciones', async () => {
            const history = await service.obtenerConversaciones('Gemini');
            expect(history).toBeTypeOf('object');
            
            const total = Object.values(history).reduce((acc: number, group) => acc + (group?.length ?? 0), 0);
            console.log(`   [Gemini] Total conversaciones encontradas: ${total}`);
            expect(total).toBeGreaterThan(0);
        }, 40000);
    });

    describe('Proveedor: DeepSeek', () => {
        let lastId: string | undefined;

        it('1. Debe iniciar un chat nuevo y obtener un ID válido', async () => {
            const result = await service.consultar('DeepSeek', 'Hola, iniciemos un test de contexto.');
            expect(result.id).toBeDefined();
            lastId = result.id;
            console.log(`   [DeepSeek] ID obtenido: ${lastId}`);
        }, 70000);

        it('2. Debe retomar la conversación anterior usando el ID', async () => {
            expect(lastId).toBeDefined();
            const result = await service.consultar('DeepSeek', 'Recordatorio del test. ¿Estamos en la misma sesión?', lastId);
            
            console.log(`   [DeepSeek] ID enviado: ${lastId ?? 'N/A'} | ID recibido: ${result.id ?? 'N/A'}`);
            expect(result.id).toBe(lastId);
        }, 70000);

        it('3. Debe extraer el historial y contar las conversaciones', async () => {
            const history = await service.obtenerConversaciones('DeepSeek');
            expect(history).toBeTypeOf('object');
            
            const total = Object.values(history).reduce((acc: number, group) => acc + (group?.length ?? 0), 0);
            console.log(`   [DeepSeek] Total conversaciones encontradas: ${total}`);
            expect(total).toBeGreaterThan(0);
        }, 40000);
    });

    it('Manejo de errores: Debe fallar limpiamente con proveedor inexistente', async () => {
        // @ts-ignore
        await expect(service.consultar('Inexistente', 'hola')).rejects.toThrow();
    });
});
