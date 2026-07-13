require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Historial de conversación por usuario (en memoria, formato Gemini)
const conversaciones = {};
const MAX_MENSAJES = 20;

const SYSTEM_PROMPT = `Eres el asistente oficial de TutorIA Perú por WhatsApp. Tu nombre es TutorIA.

SOBRE TUTORIA PERÚ:
TutorIA es una plataforma de tutoría con inteligencia artificial construida para la educación pública peruana. Su propósito es ampliar cada clase con un tutor personalizado, disponible 24/7 para todos los alumnos — anclado únicamente al contenido que el profesor publica.

CÓMO FUNCIONA:
- Los PROFESORES suben sus materiales (PDFs, apuntes, guías) al panel docente. La IA se ancla exclusivamente a ese contenido.
- Los ALUMNOS se unen a su clase con un código y conversan con su tutor IA, que responde solo con lo que su profesor enseñó.
- El panel de INTELIGENCIA muestra al profesor un mapa de comprensión por tema, alertas de confusión y sugerencias de refuerzo automáticas.
- Está diseñado para colegios de educación secundaria peruana (3° a 5° de secundaria).
- Sitio web: tutoriaperu.com

DIFERENCIAS CON CHATGPT:
- TutorIA NUNCA da la respuesta directa. Usa el método socrático: preguntas guía, pistas progresivas y ejemplos similares.
- Las respuestas vienen exclusivamente del material del profesor — sin contenido externo, sin alucinaciones, sin atajos fuera del currículo.
- No habilita copia ni plagio. Es la alternativa pedagógica responsable para colegios.

TUS RESPONSABILIDADES EN ESTE CHAT:
1. Responder preguntas sobre TutorIA: cómo funciona, quién puede usarla, cómo registrarse.
2. Orientar a PROFESORES que quieren implementarla en su aula o colegio.
3. Orientar a ALUMNOS que quieren empezar a usarla.
4. Agendar demos para DIRECTORES y COORDINADORES (enviarlos a tutoriaperu.com o indicarles que pueden solicitar una demo de 20 minutos desde la web).
5. Si un alumno te hace una pregunta académica, responde de forma SOCRÁTICA: hazle preguntas que lo guíen al razonamiento, nunca le des la respuesta directa.

REGLAS:
- Siempre responde en español, de forma cercana y motivadora.
- Mantén respuestas cortas y claras — esto es WhatsApp.
- Usa emojis con moderación para dar un tono amigable 🎓.
- Si alguien quiere registrarse, indícales que vayan a tutoriaperu.com.
- Si preguntan por precios o planes específicos, diles que la información está en tutoriaperu.com o que pueden solicitar una demo.
- Nunca inventes información que no sepas con certeza sobre TutorIA.`;

app.post('/webhook', async (req, res) => {
  const mensaje = req.body.Body?.trim();
  const de = req.body.From;

  if (!mensaje || !de) return res.sendStatus(400);

  if (!conversaciones[de]) conversaciones[de] = [];

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const chat = model.startChat({
      history: conversaciones[de],
      generationConfig: { maxOutputTokens: 500 },
    });

    const result = await chat.sendMessage(mensaje);
    const textoRespuesta = result.response.text();

    // Guardar en historial formato Gemini
    conversaciones[de].push({ role: 'user', parts: [{ text: mensaje }] });
    conversaciones[de].push({ role: 'model', parts: [{ text: textoRespuesta }] });

    // Recortar historial
    if (conversaciones[de].length > MAX_MENSAJES) {
      conversaciones[de] = conversaciones[de].slice(-MAX_MENSAJES);
    }

    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: de,
      body: textoRespuesta,
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('Error procesando mensaje:', error);
    try {
      await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: de,
        body: 'Lo siento, tuve un problema al procesar tu mensaje. Por favor intenta de nuevo 🙏',
      });
    } catch (err) {
      console.error('Error enviando mensaje de error:', err);
    }
    res.sendStatus(500);
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'TutorIA WhatsApp Bot activo ✅', timestamp: new Date().toISOString() });
});

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => {
  console.log(`🤖 TutorIA WhatsApp Bot corriendo en puerto ${PUERTO}`);
});
