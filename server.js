// Importamos las librerías necesarias
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');

// Cargar variables de entorno desde .env (útil para pruebas locales)
// En Render, esto se ignora, y usa las variables de entorno configuradas directamente
dotenv.config();

// Obtener la clave API de las variables de entorno
const apiKey = process.env.GEMINI_API_KEY;

// Inicialización de la IA con la clave API
if (!apiKey) {
    console.error("FATAL: La variable de entorno GEMINI_API_KEY no está configurada.");
    // No salimos de la aplicación, pero la IA no funcionará.
}

// Inicialización de GoogleGenAI, que usará la clave API
const ai = new GoogleGenAI(apiKey);

// Configuración de Express
const app = express();
const port = process.env.PORT || 3000; // Render usará process.env.PORT

// Middleware para habilitar CORS y permitir que el frontend acceda al servidor
app.use(cors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

// Middleware para parsear el cuerpo de la solicitud JSON
app.use(express.json());

// --- Definición del Prompt de Sistema ---
const SYSTEM_PROMPT = 
    "Eres Willy Dragoncin, un asistente de IA amable, divertido y entusiasta especializado en la empresa 'La Willy'. Tu objetivo es ayudar a los clientes y usuarios a aprender sobre los productos de 'La Willy', sus valores y su historia con un tono positivo y motivador. Responde siempre en español y mantén la conversación.";

// --- Endpoint de Chat ---
app.post('/generate', async (req, res) => {
    // 1. Verificación de la clave API
    if (!apiKey) {
        console.error("Intento de uso sin clave API.");
        // Si no hay clave, devolvemos un error 500
        return res.status(500).json({ error: "La clave API de Gemini no está configurada en el servidor (GEMINI_API_KEY)." });
    }

    // 2. Extracción de datos del cuerpo de la solicitud
    const { history, userMessage } = req.body;

    if (!userMessage) {
        return res.status(400).json({ error: "El campo 'userMessage' es obligatorio." });
    }

    try {
        // 3. Crear el historial completo para la API de Gemini
        // La API espera un array de objetos con las propiedades 'role' y 'parts'.
        const contents = [
            ...history
        ];

        // 4. Llamar a la API de Gemini
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-09-2025",
            contents: contents, // El historial completo
            systemInstruction: {
                parts: [{ text: SYSTEM_PROMPT }]
            },
            // tools: [{ "google_search": {} }], // Descomentar para activar la búsqueda
        });

        const generatedText = response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            console.warn("Respuesta de IA vacía o filtrada:", response);
            return res.status(500).json({ error: "La IA no pudo generar una respuesta (posiblemente filtrada o vacía)." });
        }

        // 5. Enviar la respuesta de la IA al frontend
        res.json({ text: generatedText });

    } catch (error) {
        console.error("Error al llamar a la API de Gemini:", error);

        // 6. Manejo de errores de la API para que el frontend pueda debuggear
        let errorMessage = "Error interno del servidor al procesar la solicitud.";
        let statusCode = 500;
        
        // Manejo de errores comunes de la API
        if (error.message.includes('API key')) {
            errorMessage = "Error de autenticación: La clave API de Gemini es inválida o expiró.";
            statusCode = 401; 
        } else if (error.message.includes('RATE_LIMIT')) {
            errorMessage = "Límite de velocidad excedido (Rate Limit). Inténtalo de nuevo más tarde.";
            statusCode = 429;
        } else if (error.message) {
            errorMessage = error.message; 
        }

        res.status(statusCode).json({ error: errorMessage });
    }
});

// Mensaje de estado simple para verificar que el servidor está funcionando
app.get('/', (req, res) => {
    res.send('Servidor Proxy de Willy Dragoncin en funcionamiento. Usa el endpoint /generate para chatear.');
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
    console.log(`Clave API cargada: ${apiKey ? 'Sí' : 'No'}`);
});