# Contexto Del Proyecto

## Resumen funcional
Plataforma e-learning para aprendizaje de idiomas apoyada por inteligencia artificial.
El producto combina contenido educativo, un asistente IA tipo “profesor 24/7” y seguimiento del progreso del usuario.

## Estado actual
El proyecto está en fase de definición conceptual / pre-MVP.
Actualmente existen flujos generales de la plataforma, una idea clara del asistente IA y una propuesta de generación de contenido educativo mediante inteligencia artificial.
Existe un scaffold inicial de aplicación Next.js con pantalla de acceso centrada, login, onboarding para elegir tipo de cuenta, registro de empresa, registro de empleado, panel de empresa, compra simulada de cursos con generación de claves y canje de claves por empleados.
El panel del alumno ya enlaza cada matrícula con un flujo navegable de curso en `/dashboard/courses/[courseId]`: unidades ordenadas, lecciones bloqueadas hasta completar la anterior, paso de vídeo, paso de ejercicios interactivos con corrección básica, lección de resumen PDF y prueba puntuable final con umbral mínimo del 80%.
Existe un primer asistente IA global en la esquina inferior derecha de la interfaz, implementado como robot animado. Permite iniciar conversaciones persistentes en modo texto o modo voz, y reenvía los mensajes a webhooks externos de n8n separados para texto y audio mediante la ruta server-side `/api/assistant`.
La UI aplica el Design System documentado en `docs/design-system.md`: Inter para texto, Montserrat para titulares, superficies calidas neutras, primary `#2A6F97` (azul acero), secondary container `#F2E9D8` (crema calida), radios suaves, outlines discretos y elevacion contenida. La pantalla de acceso usa un layout dividido con bloque visual de marca e imagen educativa en `public/images/language-network.svg`; el dashboard y las pantallas de curso usan los mismos tokens visuales y componentes base.
Existe un primer esquema SQL en `supabase/schema.sql` para Supabase/PostgreSQL orientado a una plataforma B2B con empresas, empleados, cursos, paquetes de licencias, claves de acceso, progreso, ejercicios, asistente IA, RAG y certificados.
El esquema mantiene RLS activo y enlaza `public.profiles` con `auth.users`; queda pendiente validarlo contra una instancia real de Supabase y definir las migraciones operativas.
Existe configuración inicial de tests unitarios con Vitest. Los tests se ubican en `unit-test/` y cubren la lógica del contrato del webhook del asistente y utilidades transversales.
Existe una landing page pública en `/` (antes redirigía directamente a `/auth`). La página muestra: vídeo de demo de la plataforma (placeholder), vídeo de presentación de profesores (placeholder), vídeo de presentación del asistente IA (placeholder), catálogo de cursos activos con CTA de registro y un formulario de solicitud de nuevo curso ("¿No encuentras tu curso?") que guarda la solicitud en la tabla `course_requests` mediante la Server Action `submitCourseRequest` en `app/explore-actions.ts`. Los usuarios ya autenticados que visiten `/` son redirigidos automáticamente a `/dashboard`.

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
- Los ejercicios admiten opciones desde `content_json.options` o `content_json.choices`; si no hay opciones, se muestra un campo de respuesta libre. También admiten tests de varias preguntas con `content_json.items[]`, donde cada item tiene `id`, `options[]` y opcionalmente `question`. La corrección MVP compara la respuesta con valores simples de `correct_answer_json` (`answer`, `correctAnswer`, `correct_answer`, `acceptedAnswers`, `accepted_answers`, `answers`, etc.) o con arrays de respuestas por pregunta/hueco (`answers: [{ question_id, answer }]` o `answers: [{ blank_id, answer }]`) y registra el resultado en `exercise_attempts`. Si el intento alcanza el umbral mínimo, se muestra el score, la corrección de respuestas incorrectas y el alumno puede continuar; si no lo alcanza, se le pide repetir el ejercicio.
- El cierre de unidad se representa con dos pasos separados: una lección de resumen con `lesson_type = 'text'` y `pdf_url`, seguida de una lección de examen con `lesson_type = 'exam'`, `requires_exam = true` y una prueba puntuable mínima del 80%.
- El contenido educativo real de vídeos, ejercicios, PDF y pruebas está pendiente de carga por curso; la interfaz muestra placeholders hasta que se incorpore. Para que los ejercicios sean corregibles en el MVP, cada registro debe incluir `content_json` con pregunta/opciones y `correct_answer_json` con respuestas aceptadas.

## Restricciones y decisiones actuales
- La IA es el elemento diferencial del producto.
- El asistente IA tendrá un papel central dentro de la experiencia de aprendizaje.
- El contenido podrá generarse total o parcialmente con inteligencia artificial.
- El asistente visual actual es un robot animado ligero, no un avatar avanzado ni un chatbot complejo con lógica propia en la app.
- La app delega el procesamiento del asistente en n8n mediante webhooks separados para texto y audio; el proveedor/modelo IA concreto queda fuera de la aplicación hasta que se documente la decisión.
- Se debe evitar sobrecomplicar el MVP inicial con demasiadas funcionalidades avanzadas como video IA, personalización profunda y chatbot avanzado desde el primer lanzamiento.
- La prioridad inicial debe ser validar si los usuarios quieren aprender idiomas con este tipo de experiencia.

## Archivos clave
- Diagrama de flujo general de la plataforma
- Documento MVP conceptual
- Estructura de cursos, unidades y lecciones
- Definición funcional del asistente IA
- Flujos de registro, aprendizaje y práctica
- `lib/assistant/webhook.ts`
- `docs/design-system.md`
- `public/images/`
- `unit-test/`

## Pendientes de validación
- Definir el MVP mínimo real.
- Elegir las herramientas concretas de IA.
- Estimar el coste por usuario.
- Validar la generación de contenido educativo con IA.
- Confirmar el proveedor/modelo de embeddings y ajustar la dimensión de `knowledge_chunks.embedding` si no se usa un modelo de 1536 dimensiones.
- Definir si el catálogo de cursos será global para usuarios autenticados o estará limitado por empresa.
- Definir si los administradores de empresa podrán ver conversaciones IA de empleados o solo métricas agregadas.
- Definir el flujo transaccional de generación de claves para consumir licencias compradas sin exceder paquetes.
- Validar el flujo real con un proyecto Supabase configurado y al menos un curso activo creado.
- Cargar contenido real de unidades, lecciones, vídeos, ejercicios, PDFs y pruebas para comprobar el flujo de alumno extremo a extremo.
- Validar el contrato exacto de entrada/salida del webhook de n8n para texto y audio. La ruta `/api/assistant` acepta respuestas JSON con `reply`, `response`, `message`, `text` u `output`, o texto plano.
- Los Webhook nodes de n8n para texto y audio deben aceptar metodo `POST`. Para pruebas locales se debe usar la URL `/webhook-test/...` con el workflow en escucha; para produccion, `/webhook/...` con el workflow activo.
- El webhook de audio puede responder con JSON/texto o con un binario `audio/*`; si responde con audio, `/api/assistant` lo devuelve al navegador y el robot lo reproduce automaticamente.
- Cuando el webhook de audio responde con binario y se quiere mostrar texto en el chat, n8n debe incluir el header `X-Assistant-Text-Base64` con el texto codificado en Base64 UTF-8. El header antiguo `X-Assistant-Text` sigue soportado solo para textos cortos.
- Validar compatibilidad de grabación de audio, reconocimiento de voz y detección de silencio por navegador. La grabación se envía como `audio/webm`; el microfono permanece abierto en modo voz y la app intenta enviar automaticamente el turno cuando detecta una pausa. La transcripción en cliente depende de Web Speech API cuando esté disponible.
