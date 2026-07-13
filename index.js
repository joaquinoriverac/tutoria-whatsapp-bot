require('dotenv').config();
const express = require('express');
const twilio = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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
6. Si alguien tiene una pregunta ACADÉMICA, dirígelos a usar la plataforma en tutoriaperu.com — ahí está el tutor IA real. No respondas preguntas académicas tú mismo.

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

async function callGroq(historial, nuevoMensaje) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...historial,
    { role: 'user', content: nuevoMensaje }
  ];

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 500
      })
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

app.post('/webhook', async (req, res) => {
  const mensaje = req.body.Body?.trim();
  const de = req.body.From;
  if (!mensaje || !de) return res.status(400).end();
  if (!conversaciones[de]) conversaciones[de] = [];
  try {
    const textoRespuesta = await callGroq(conversaciones[de], mensaje);
    conversaciones[de].push({ role: 'user', content: mensaje });
    conversaciones[de].push({ role: 'assistant', content: textoRespuesta });
    if (conversaciones[de].length > MAX_MENSAJES) {
      conversaciones[de] = conversaciones[de].slice(-MAX_MENSAJES);
    }
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: de,
      body: textoRespuesta,
    });
    res.status(200).end();
  } catch (error) {
    console.error('Error:', error.message || error);
    try {
      await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: de,
        body: 'Lo siento, tuve un problema. Por favor intenta de nuevo 🙏',
      });
    } catch (err) {
      console.error('Error enviando mensaje de error:', err.message);
    }
    res.status(500).end();
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'TutorIA WhatsApp Bot activo ✅', timestamp: new Date().toISOString() });
});

process.on('unhandledRejection', (reason) => { console.error('Unhandled Rejection:', reason); });
process.on('uncaughtException', (error) => { console.error('Uncaught Exception:', error.message); });

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => {
  console.log(`🤖 TutorIA WhatsApp Bot corriendo en puerto ${PUERTO}`);
});
