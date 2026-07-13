require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const conversaciones = {};
const MAX_MENSAJES = 20;

const SYSTEM_PROMPT = `Eres el asistente de soporte oficial de TutorIA Perú por WhatsApp. Tu nombre es TutorIA.

SOBRE TUTORIA PERÚ:
TutorIA (tutoriaperu.com) es una plataforma de tutoría con IA para la educación secundaria pública peruana. Los profesores suben sus materiales y la IA tutora a los alumnos usando solo ese contenido.

TU ROL EN ESTE WHATSAPP:
Eres el asistente de SOPORTE Y BIENVENIDA — no el tutor académico. Tu trabajo es:
1. Ayudar con problemas técnicos de la página (errores, funciones que no cargan, problemas de acceso).
2. Explicar cómo funciona TutorIA y cómo empezar a usarla.
3. Orientar a profesores que quieren implementarla.
4. Orientar a alumnos que quieren acceder a su clase.
5. Agendar demos para directores/coordinadores (enviarlos a tutoriaperu.com).
6. Si alguien tiene una pregunta ACADÉMICA (tarea, ejercicio, etc.), dirígelos a usar la plataforma en tutoriaperu.com — ahí está el tutor IA real. No respondas preguntas académicas tú mismo.

PROBLEMAS TÉCNICOS COMUNES:
- Página no carga: recargar, probar otro navegador, verificar conexión.
- No encuentran su clase: pedir el código de clase a su profesor.
- El whiteboard/pizarra no funciona: recargar la página, limpiar caché, usar Chrome o Edge actualizados.
- No pueden subir archivos (profesores): verificar formato (PDF, Word, imagen) y tamaño.
- Olvidaron contraseña: usar "Olvidé mi contraseña" en tutoriaperu.com.

REGLAS:
- Responde siempre en español, de forma cercana y clara.
- Mantén respuestas cortas — esto es WhatsApp.
- Usa emojis con moderación 🎓.
- Si no sabes la solución, indica que escriban a soporte en tutoriaperu.com.
- Nunca inventes información.
- Para registrarse o ver planes: tutoriaperu.com.`;

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

    conversaciones[de].push({ role: 'user', parts: [{ text: mensaje }] });
    conversaciones[de].push({ role: 'model', parts: [{ text: textoRespuesta }] });

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
    console.error('Error procesando mensaje:', error.message || error);
    try {
      await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: de,
        body: 'Lo siento, tuve un problema. Por favor intenta de nuevo 🙏',
      });
    } catch (err) {
      console.error('Error enviando mensaje de error:', err.message || err);
    }
    res.sendStatus(500);
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'TutorIA WhatsApp Bot activo ✅', timestamp: new Date().toISOString() });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
});

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => {
  console.log(`🤖 TutorIA WhatsApp Bot corriendo en puerto ${PUERTO}`);
});
