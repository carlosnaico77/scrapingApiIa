const http = require('http');

const optionsGemini = {
    hostname: 'localhost',
    port: 3500,
    path: '/api/consultar',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

const payloadGemini = JSON.stringify({
    agente: "Gemini",
    consulta: "Hola, dime un chiste corto.",
    idConversacion: "" 
});

console.log('--- Iniciando prueba hacia Gemini ---');
const req = http.request(optionsGemini, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('\nRespuesta Completa:', JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('\nRespuesta Cruda (No JSON):', data);
        }
    });
});

req.on('error', e => console.error(e));
req.write(payloadGemini);
req.end();
