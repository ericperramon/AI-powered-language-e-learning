# AI-powered-language-e-learning

Pre-MVP de plataforma e-learning B2B para aprendizaje de idiomas con IA.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui-style components locales
- Supabase Auth + PostgreSQL

## Setup local

1. Instala dependencias:

```bash
npm install
```

2. Crea `.env.local` a partir de `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
N8N_ASSISTANT_TEXT_WEBHOOK_URL=
N8N_ASSISTANT_AUDIO_WEBHOOK_URL=
```

`N8N_ASSISTANT_TEXT_WEBHOOK_URL` es la URL del webhook de n8n que procesara mensajes de texto.
`N8N_ASSISTANT_AUDIO_WEBHOOK_URL` es la URL del webhook de n8n que procesara mensajes de audio.
La app no expone estas URLs al navegador: el componente llama a `/api/assistant` y esta ruta reenvia cada mensaje al webhook correspondiente.
Ambos Webhook nodes de n8n deben aceptar metodo `POST`. En modo test usa la URL `/webhook-test/...` con el workflow escuchando; en modo produccion usa `/webhook/...` con el workflow activo.
El webhook de audio puede responder con JSON/texto o con un binario `audio/*` como `audio/wav`; si responde con audio, el asistente lo reproduce automaticamente.
Si el webhook de audio responde con binario y tambien quieres mostrar texto en el chat, añade el header `X-Assistant-Text-Base64` con el texto codificado en Base64 UTF-8. Evita usar texto largo directamente en headers sin codificar.
En modo voz, el microfono permanece abierto y la app intenta enviar automaticamente el turno cuando detecta una pausa de voz. El boton de microfono pasa a silenciar/reactivar el microfono.

3. En Supabase SQL Editor, ejecuta:

```bash
supabase/schema.sql
```

4. Crea al menos un curso activo en Supabase. Para probar el flujo de alumno completo, añade también unidades, lecciones, ejercicios, una lección de resumen con `lesson_type = 'text'` y `pdf_url`, y una lección final de tipo `exam` o con `requires_exam`.

Los ejercicios se muestran como interactivos si tienen contenido en `content_json`. Para test de opciones, usa `options` o `choices`; para respuesta libre, basta con `prompt` o `question`. Para tests de varias preguntas o huecos, usa `content_json.items[]` con `id`, `options[]` y opcionalmente `question`, y `correct_answer_json.answers[]` con `question_id` o `blank_id` y `answer`. La corrección MVP guarda el resultado en `exercise_attempts`, aplica `minimum_score_to_pass` y muestra correcciones solo cuando el intento queda aprobado.

5. Arranca la app:

```bash
npm run dev
```

## Flujo de prueba

1. Registra una empresa.
2. Inicia sesión con la empresa.
3. Compra un curso activo y genera keys.
4. Registra un empleado.
5. Inicia sesión con el empleado.
6. Canjea una key libre desde el dashboard.
7. Pulsa `Continuar` en el curso matriculado.
8. Recorre el flujo de alumno: vídeo, ejercicios, resumen PDF separado y prueba de fin de unidad con mínimo del 80%.

## Comandos verificados

```bash
npm test
npm run lint
npm run build
```
