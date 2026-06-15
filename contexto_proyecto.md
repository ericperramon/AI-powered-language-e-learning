# Contexto Del Proyecto

## Resumen funcional
Plataforma e-learning para aprendizaje de idiomas apoyada por inteligencia artificial.
El producto combina contenido educativo, un asistente IA tipo “profesor 24/7” y seguimiento del progreso del usuario.

## Estado actual
El proyecto está en fase MVP activo con contenido real cargado en Supabase.
Actualmente existen flujos generales de la plataforma, una idea clara del asistente IA y una propuesta de generación de contenido educativo mediante inteligencia artificial.
Existe un scaffold inicial de aplicación Next.js con pantalla de acceso centrada, login, onboarding para elegir tipo de cuenta, registro de empresa, registro de empleado, panel de empresa, compra simulada de cursos con generación de claves y canje de claves por empleados.
El panel del alumno ya enlaza cada matrícula con un flujo navegable de curso en `/dashboard/courses/[courseId]`: unidades ordenadas, lecciones bloqueadas hasta completar la anterior, paso de vídeo, paso de ejercicios interactivos con corrección básica, lección de resumen PDF y prueba puntuable final con umbral mínimo del 80%.
Existe un primer asistente IA global en la esquina inferior derecha de la interfaz, implementado como robot animado. Permite iniciar conversaciones persistentes en modo texto o modo voz, y reenvía los mensajes a webhooks externos de n8n separados para texto y audio mediante la ruta server-side `/api/assistant`. El modo voz usa OpenAI Realtime a través de `/api/assistant/session`. Ambas rutas (`/api/assistant` y `/api/assistant/session`) exigen usuario autenticado y aplican un rate limit por usuario mediante el guard `lib/assistant/guard.ts`; sin sesión devuelven `401` y al superar el límite `429`. El refresco de sesión SSR de Supabase lo gestiona `proxy.ts` en la raíz (equivalente al middleware en Next.js 16).
La UI aplica el Design System documentado en `docs/design-system.md`: Inter para texto, Montserrat para titulares, superficies calidas neutras, primary `#2A6F97` (azul acero), secondary container `#F2E9D8` (crema calida), radios suaves, outlines discretos y elevacion contenida. La pantalla de acceso usa un layout dividido con bloque visual de marca e imagen educativa en `public/images/language-network.svg`; el dashboard y las pantallas de curso usan los mismos tokens visuales y componentes base.
Existe un primer esquema SQL en `supabase/schema.sql` para Supabase/PostgreSQL orientado a una plataforma B2B con empresas, empleados, cursos, paquetes de licencias, claves de acceso, progreso, ejercicios, asistente IA, RAG y certificados.
El esquema mantiene RLS activo y enlaza `public.profiles` con `auth.users`; queda pendiente validarlo contra una instancia real de Supabase y definir las migraciones operativas.
Existe configuración de tests unitarios con Vitest (46 tests en verde). Los tests se ubican en `unit-test/` y cubren: el contrato del webhook del asistente, la corrección de ejercicios (incluido el formato de mapa plano y selección múltiple), la construcción del system prompt del asistente (`assistant-system-prompt.test.ts`), el rate limiter de los endpoints de IA (`assistant-guard.test.ts`) y utilidades transversales.
Existe una landing page pública en `/` (antes redirigía directamente a `/auth`). La página muestra: vídeo de demo de la plataforma (placeholder), vídeo de presentación de profesores (placeholder), vídeo de presentación del asistente IA (placeholder), catálogo de cursos activos con CTA de registro y un formulario de solicitud de nuevo curso ("¿No encuentras tu curso?") que guarda la solicitud en la tabla `course_requests` mediante la Server Action `submitCourseRequest` en `app/explore-actions.ts`. Los usuarios ya autenticados que visiten `/` son redirigidos automáticamente a `/dashboard`. El hero de la landing usa un layout editorial asimétrico cuyo elemento de firma es una tarjeta de conversación alumno/profesor IA (`.lesson-exchange`) con corrección inline; se apoya en las utilidades del Design System `.ds-eyebrow` y `.lesson-exchange`.
El catálogo de la landing agrupa cursos por título base (prefijo antes de ` - `) mostrando los niveles como badges en una sola card. Los cursos con `is_active = false` o añadidos como estáticos en el array `STATIC_COMING_SOON_COURSES` del archivo `app/page.tsx` aparecen atenuados con botón desactivado y badge "Próximamente".
La página de lección (`app/dashboard/courses/[courseId]/lessons/[lessonId]/page.tsx`) usa un diseño plano inspirado en Coursera: cabecera sin caja (solo tipografía y separadores), tabs de etapa con subrayado activo, contenido sin `Card` wrappers, opciones de ejercicio como lista plana con `divide-y`, banners de feedback con borde izquierdo coloreado. Ancho máximo `max-w-5xl` (1024 px).

## Modelo funcional
El sistema se divide en varios bloques:
- Gestión de usuarios
- Catálogo de cursos
- Cursos, unidades y lecciones
- Videos educativos generados con IA
- Asistente IA conversacional
- Ejercicios y práctica
- Seguimiento de progreso
- Certificados
- Base de datos para contenidos, usuarios y solicitudes

## Flujo principal
1. El usuario se registra o inicia sesión.
2. Accede al catálogo de cursos.
3. Selecciona un curso de idioma.
4. Consume una lección.
5. Interactúa con el asistente IA para resolver dudas o practicar.
6. Realiza ejercicios.
7. El sistema guarda su progreso.
8. Continúa con nuevas lecciones.
9. Al completar el curso, puede obtener un certificado.

## Flujo implementado actualmente
1. La empresa crea una cuenta administradora y queda autenticada automáticamente.
2. La empresa entra en `/dashboard`.
3. La empresa compra un curso activo y elige cuántas claves generar.
4. El empleado crea una cuenta de tipo alumno y queda autenticado automáticamente.
5. El empleado canjea una clave con `redeem_course_key`.
6. El panel del empleado muestra la matrícula creada.
7. El alumno pulsa `Continuar` en una matrícula y entra en `/dashboard/courses/[courseId]`.
8. El curso muestra unidades y lecciones por `sort_order`; solo está disponible la primera lección o la siguiente a una lección completada.
9. En cada lección, el alumno completa primero el vídeo y después responde los ejercicios.
10. Al enviar los ejercicios, se guardan intentos en `exercise_attempts`, se corrigen contra `correct_answer_json` y si cada ejercicio alcanza su `minimum_score_to_pass` (80 por defecto) se actualiza `lesson_progress` y el porcentaje de `enrollments`.
11. Al final de la unidad, una lección de tipo `text` con `pdf_url` actúa como resumen PDF.
12. Después del resumen, una lección de tipo `exam` o con `requires_exam` actúa como prueba puntuable.
13. Si la prueba alcanza al menos el 80%, se marca la unidad como superada en `unit_progress` y se desbloquea la siguiente unidad.
14. El asistente IA aparece como robot flotante global. Al pulsarlo, se abre un panel de chat minimalista con campo de texto y botón de micrófono.
15. Los mensajes del asistente se envían a `/api/assistant`, que reenvía texto al webhook configurado en `N8N_ASSISTANT_TEXT_WEBHOOK_URL` o audio al webhook configurado en `N8N_ASSISTANT_AUDIO_WEBHOOK_URL`, y muestra la respuesta devuelta por n8n.

La pantalla de acceso muestra login por defecto. Si el usuario pulsa `Crear cuenta`, aparece un onboarding para elegir entre cuenta de empleado o cuenta de empresa. Si pulsa directamente `Empresa` o `Empleado`, se muestra el formulario correspondiente con texto de ayuda sobre el tipo de cuenta.

## Flujo de contenido del alumno
- El dashboard del empleado lista las matrículas y permite continuar un curso.
- La página del curso agrupa el contenido por unidades y calcula bloqueos a partir de `lesson_progress` y `unit_progress`.
- Las lecciones normales siguen el orden: vídeo, ejercicios interactivos corregidos en servidor y vuelta al curso para continuar con la siguiente lección.
- El cierre de unidad se representa con dos pasos separados: una lección de resumen con `lesson_type = 'text'` y `pdf_url`, seguida de una lección de examen con `lesson_type = 'exam'`, `requires_exam = true` y una prueba puntuable mínima del 80%.
- El contenido educativo real de vídeos, ejercicios, PDF y pruebas está pendiente de carga por curso; la interfaz muestra placeholders hasta que se incorpore.

## Estructura de ejercicios (content_json por formato)

Esta sección describe los formatos de `content_json` y `correct_answer_json` que el sistema sabe renderizar y corregir. Sirve de referencia para revisar o crear ejercicios en Supabase.

### Formato 1 — Opciones múltiples simples (`options` / `choices`)
**Detección:** `content_json.options[]` o `content_json.choices[]`.
**Render:** radio buttons en lista plana con `divide-y`.
**Respuesta enviada:** `answer_${exerciseId}` = string con el valor seleccionado.
**correct_answer_json:** `{ "answer": "valor_correcto" }` o `{ "correctAnswer": "..." }`.

```json
// content_json
{ "prompt": "Choose the correct word.", "options": ["assessing", "checking", "proving"] }
// correct_answer_json
{ "answer": "assessing" }
```

### Formato 2 — Preguntas múltiples con items (`items[]`)
**Detección:** `content_json.items[]` donde cada item tiene `id`, `question`, `options[]`.
**Render:** un fieldset por item, radio buttons en lista plana.
**Respuesta enviada:** `answer_${exerciseId}_${item.id}` por cada item.
**correct_answer_json:** mapa plano `{ "item_id": "respuesta", ... }` o array `answers: [{ question_id, answer }]`.

```json
// content_json
{ "items": [{ "id": "q1", "question": "What does X mean?", "options": ["a","b","c"] }] }
// correct_answer_json
{ "q1": "a" }
```

### Formato 3 — Fill in the blanks con dropdown (`blanks[]`)
**Detección:** `content_json.sentence` (string) + `content_json.blanks[]`.
**Render:** `FillInBlanksExercise` — la frase con huecos; cada hueco es un select con sus opciones.
**Respuesta enviada:** `answer_${exerciseId}_${blank.id}` por cada hueco.
**correct_answer_json:** `{ "blank_id": "respuesta", ... }`.

```json
// content_json
{
  "sentence": "She is {{b1}} in machine learning.",
  "blanks": [{ "id": "b1", "options": [{"label":"experienced","value":"experienced"},{"label":"experiment","value":"experiment"}] }]
}
// correct_answer_json
{ "b1": "experienced" }
```

### Formato 4 — Fill in the blanks por items (`sentence` + `items[]`)
**Detección:** `content_json.sentence` o `content_json.question` + `content_json.items[]` con opciones numeradas.
**Render:** `FillInBlanksExercise` derivado de los items.
**Respuesta enviada:** igual que Formato 3.

### Formato 5 — Fill in the blanks de texto libre (`(N) ___`)
**Detección:** `content_json.question` / `sentence` / `prompt` con patrón `(N) ___`.
**Render:** `TextBlanksExercise` — inputs inline en la frase.
**Respuesta enviada:** `answer_${exerciseId}_blank_${N}` por cada hueco.
**correct_answer_json:** `{ "blank_1": "respuesta", ... }`.

### Formato 6 — Preguntas estructuradas (`questions[]`)
**Detección:** `content_json.questions[]` donde cada pregunta tiene `id`, `text`, `options[]`, `type` (`single` | `multiple`).
**Render:** `QuestionsExercise` — fieldset por pregunta, radio o checkbox por opción.
**Respuesta enviada:** `answer_${exerciseId}_${question.id}` (radio) o múltiples valores (checkbox).
**correct_answer_json:** mapa plano `{ "q_id": "respuesta" }` o `{ "q_id": ["op1","op2"] }` para múltiple.
Soporta opcionalmente `content_json.model_text` (objeto con campos `profile`, `education`, `current_employer`, `responsibilities`, `previous_employer` u otros) para mostrar un texto de referencia antes de las preguntas.

```json
// content_json
{
  "instructions": "Read and answer.",
  "model_text": { "profile": "A results-driven professional..." },
  "questions": [{ "id": "q1", "text": "Where does she work?", "type": "single", "options": ["Nova Solutions","GreenBridge"] }]
}
// correct_answer_json
{ "q1": "Nova Solutions" }
```

### Formato 7 — Matching / emparejamiento (`pairs[]`) ⬅ NUEVO
**Detección:** `content_json.pairs[]` donde cada pair tiene `id` (número), `term` (string), `options[]` (array de strings — pool compartido).
**Render:** `MatchingExercise` — cada fila muestra el término en negrita/uppercase; las opciones aparecen como palabras clickables (radio buttons ocultos). La opción seleccionada se marca en negrita, azul y subrayada.
**Respuesta enviada:** `answer_${exerciseId}_${pair.id}` (donde id es string del número) por cada pair.
**correct_answer_json:** mapa plano `{ "1": "sinónimo", "2": "sinónimo", ... }`. Las claves son strings del id numérico.
**Nota:** claves extra en `correct_answer_json` como `evaluation_criteria` se ignoran en la evaluación.

```json
// content_json
{
  "instructions": "Match verbs to their synonyms.",
  "pairs": [
    { "id": 1, "term": "evaluating", "options": ["assessing","checking","proving","managing"] },
    { "id": 2, "term": "executing", "options": ["assessing","checking","proving","managing"] }
  ]
}
// correct_answer_json
{ "1": "assessing", "2": "carrying out" }
```

### Formato 8 — Transformación de frases (`sentences[]`) ⬅ NUEVO
**Detección:** `content_json.sentences[]` donde cada sentence tiene `id` (string), `original` (string), opcionalmente `prompt` (string con `___`).
**Render:** `SentenceTransformExercise` — muestra el ejemplo original→transformado, luego cada frase original en gris y un textarea para escribir la transformación. Si hay `prompt`, se usa como placeholder. El alumno escribe la frase completa (incluido el inicio).
**Respuesta enviada:** `answer_${exerciseId}_${sentence.id}` por cada frase.
**correct_answer_json:** mapa plano `{ "s1": "frase transformada completa", ... }`. Claves extra como `evaluation_criteria` o `accepted_alternatives` se ignoran.
**`is_ai_corrected`:** puede ser `true`; si lo es y existe `ANTHROPIC_API_KEY`, la corrección usa Claude en lugar de comparación de strings.

```json
// content_json
{
  "instructions": "Rewrite using reduced participle clauses.",
  "example": { "original": "She is a manager who is experienced...", "transformed": "A manager experienced..." },
  "sentences": [
    { "id": "s1", "original": "Maria is a skilled data analyst who is experienced in ML.", "prompt": "A ___, Maria is..." }
  ]
}
// correct_answer_json
{ "s1": "A skilled data analyst experienced in ML, Maria is looking to take on a leadership role.", "evaluation_criteria": [...] }
```

### Formato 9 — Escritura libre (`min_words`) ⬅ NUEVO
**Detección:** `content_json.min_words` (número).
**Render:** `FreeWritingExercise` — muestra instrucciones, opcionalmente `job_ad` (texto del anuncio de trabajo), opcionalmente `survey_data` (tabla de satisfacción + ranking de problemas), opcionalmente `required_sections` (chips de secciones requeridas), checklist de autoevaluación y un textarea grande.
**Respuesta enviada:** `answer_${exerciseId}` = texto libre.
**correct_answer_json:** no se usa para comparación; la corrección es siempre IA (`is_ai_corrected: true`).
**`ai_correction_prompt`** en `content_json`: system prompt para Claude. **Nunca se envía al cliente.**
**`is_ai_corrected`:** siempre `true` para este formato. La action llama a Claude con el prompt del campo y devuelve `{ score, feedback }`.

```json
// content_json
{
  "instructions": "Write your own CV for this position.",
  "job_ad": "EcoForward International is seeking...",
  "checklist": ["Is the layout clear?", "Does the CV use dynamic verbs?"],
  "min_words": 200,
  "ai_correction_prompt": "You are an expert writing teacher. Evaluate this CV... [NEVER shown to student]"
}
```

### Corrección IA de ejercicios
- Cuando `is_ai_corrected = true` y `content_json.ai_correction_prompt` existe y `ANTHROPIC_API_KEY` está configurada, `submitSingleExercise` llama a `lib/exercises/ai-correction.ts`.
- Modelo usado: `claude-haiku-4-5-20251001` (rápido y económico para corrección).
- El helper envía el `ai_correction_prompt` como system y la respuesta del alumno como user; espera `{ score: 0-100, feedback: string }` en JSON.
- Si no hay API key, cae al evaluador local (`correctExerciseAnswer`) como fallback.
- El feedback de la IA se almacena en `exercise_attempts.ai_feedback` y se muestra al alumno tras el envío.

### Convención de nomenclatura de cursos
Los cursos con múltiples niveles deben nombrarse con el patrón `"Nombre curso - Nivel"` (ej. `"Business Writing - Advanced"`). La landing agrupa automáticamente por el prefijo antes del ` - ` y muestra los niveles como badges en una sola card.

## Restricciones y decisiones actuales
- La IA es el elemento diferencial del producto.
- El asistente IA tendrá un papel central dentro de la experiencia de aprendizaje.
- El contenido podrá generarse total o parcialmente con inteligencia artificial.
- El asistente visual actual es un robot animado ligero, no un avatar avanzado ni un chatbot complejo con lógica propia en la app.
- La app delega el procesamiento del asistente en n8n mediante webhooks separados para texto y audio; el proveedor/modelo IA concreto queda fuera de la aplicación hasta que se documente la decisión.
- Se debe evitar sobrecomplicar el MVP inicial con demasiadas funcionalidades avanzadas como video IA, personalización profunda y chatbot avanzado desde el primer lanzamiento.
- La prioridad inicial debe ser validar si los usuarios quieren aprender idiomas con este tipo de experiencia.

## Archivos clave
- `lib/assistant/webhook.ts`
- `lib/assistant/guard.ts` (auth + rate limit de los endpoints de IA)
- `lib/exercises/evaluation.ts` (corrección local de ejercicios; `correctQuestionsMapAnswer` filtra claves no enviadas)
- `lib/exercises/ai-correction.ts` (corrección IA con Claude vía Anthropic SDK; usa `claude-haiku-4-5-20251001`)
- `app/dashboard/courses/[courseId]/actions.ts` (Server Actions de ejercicios, lecciones y exámenes; `readExerciseItemIds` soporta `pairs[]` y `sentences[]`)
- `app/dashboard/courses/[courseId]/lessons/[lessonId]/page.tsx` (página de lección con todos los renderers de ejercicio)
- `app/page.tsx` (landing con agrupación de cursos y cursos estáticos "Próximamente")
- `proxy.ts` (refresco de sesión Supabase SSR en Next.js 16)
- `docs/design-system.md`
- `IMPORTANT_FIXES.md` (revisión de seguridad/errores y decisiones pendientes)
- `unit-test/`

## Variables de entorno requeridas
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — solo servidor; bypasa RLS para operaciones admin
- `N8N_ASSISTANT_TEXT_WEBHOOK_URL` — webhook n8n para el asistente de texto
- `N8N_ASSISTANT_AUDIO_WEBHOOK_URL` — webhook n8n para el asistente de voz
- `ANTHROPIC_API_KEY` — corrección IA de ejercicios con `is_ai_corrected = true`; si no existe, usa evaluador local como fallback

## Pendientes de validación
- **Revisar todos los ejercicios de todas las unidades de todos los cursos**: comprobar que cada ejercicio tiene el `content_json` en el formato correcto (ver sección "Estructura de ejercicios"), que `correct_answer_json` es coherente con el formato, que `is_ai_corrected` está bien configurado, y que el render en la UI es el esperado. Conectarse a Supabase con el cliente admin para hacer la auditoría.
- Configurar `ANTHROPIC_API_KEY` en producción para activar la corrección IA de ejercicios con `is_ai_corrected = true`.
- Confirmar el proveedor/modelo de embeddings y ajustar la dimensión de `knowledge_chunks.embedding` si no se usa un modelo de 1536 dimensiones.
- Definir si el catálogo de cursos será global para usuarios autenticados o estará limitado por empresa.
- Definir si los administradores de empresa podrán ver conversaciones IA de empleados o solo métricas agregadas.
- Definir el flujo transaccional de generación de claves para consumir licencias compradas sin exceder paquetes.
- Sustituir la calificación auto-reportada de exámenes sin ejercicios (`submitUnitTest`, donde el alumno escribe su propia nota) por exámenes con ejercicios estructurados. Detalle en `IMPORTANT_FIXES.md`.
- Respaldar el rate limiter de los endpoints de IA (hoy en memoria por instancia) con un store compartido tipo Redis/Upstash para producción.
- Validar el contrato exacto de entrada/salida del webhook de n8n para texto y audio.
- Los Webhook nodes de n8n deben aceptar método `POST`. Para pruebas locales usar `/webhook-test/...`; para producción, `/webhook/...`.
- El webhook de audio puede responder con JSON/texto o binario `audio/*`. Si responde con binario y se quiere mostrar texto, n8n debe incluir el header `X-Assistant-Text-Base64` (Base64 UTF-8).
- Validar compatibilidad de grabación de audio y detección de silencio por navegador (`audio/webm`, Web Speech API).
