require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const conversaciones = {};
const MAX_MENSAJES = 20;

const SYSTEM_PROMPT = `Eres el asistente oficial de TutorIA Peru por WhatsApp. Tu nombre es TutorIA.

SOBRE TUTORIA PERU: TutorIA es una plataforma de tutoria con IA para la educacion publica peruana. Amplifica cada clase con un tutor personalizado 24/7, anclado al contenido del profesor.

COMO FUNCIONA:
- PROFESORES suben materiales (PDFs, apuntes). La IA responde SOLO con ese contenido.
- ALUMNOS se unen con un codigo y conversan con su tutor IA.
- Panel de INTELIGENCIA muestra comprension por tema y alertas de confusion.
- Para colegios secundarios peruanos (3 a 5 de sec). Web: tutoriaperu.com

DIFERENCIAS CON CHATGPT: TutorIA usa metodo socratico — NUNCA da la respuesta directa. No habilita plagio.

TUS RESPONSABILIDADES:
1. Responder preguntas sobre TutorIA.
2. Orientar a PROFESORES interesados.
3. Orientar a ALUMNOS que quieren usarla.
4. Demos para DIRECTORES: enviarlos a tutoriaperu.com.
5. Preguntas academicas: responde SOCRATICAMENTE, nunca des la respuesta.

REGLAS: Siempre en espanol, tono cercano y motivador, respuestas cortas (es WhatsApp), emojis con moderacion.`;

app.post('/webhook', async (req, res) => {
  const mensaje = req.body.Body?.trim();
    const de = req.body.From;
      if (!mensaje || !de) return res.sendStatus(400);
        if (!conversaciones[de]) conversaciones[de] = [];
          conversaciones[de].push({ role: 'user', content: mensaje });
            if (conversaciones[de].length > MAX_MENSAJES) conversaciones[de] = conversaciones[de].slice(-MAX_MENSAJES);
              try {
                  const respuesta = await anthropic.messages.create({
                        model: 'claude-sonnet-4-6',
                              max_tokens: 500,
                                    system: SYSTEM_PROMPT,
                                          messages: conversaciones[de],
                                              });
                                                  const texto = respuesta.content[0].text;
                                                      conversaciones[de].push({ role: 'assistant', content: texto });
                                                          await twilioClient.messages.create({ from: process.env.TWILIO_WHATSAPP_NUMBER, to: de, body: texto });
                                                              res.sendStatus(200);
                                                                } catch (e) {
                                                                    console.error(e);
                                                                        try { await twilioClient.messages.create({ from: process.env.TWILIO_WHATSAPP_NUMBER, to: de, body: 'Lo siento, intenta de nuevo 🙏' }); } catch (_) {}
                                                                            res.sendStatus(500);
                                                                              }
                                                                              });

                                                                              app.get('/', (req, res) => res.json({ status: 'TutorIA Bot activo' }));
                                                                              const PORT = process.env.PORT || 3000;
                                                                              app.listen(PORT, () => console.log('Bot en puerto ' + PORT));
