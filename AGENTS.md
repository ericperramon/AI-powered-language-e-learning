# AGENTS

## Proyecto
- Aplicacion web con `Next.js 16`, `React 19`, `TypeScript`, `Tailwind CSS 4` y `shadcn/ui`.
- El acceso a datos se realiza con `@supabase/supabase-js` contra una base de datos PostgreSQL en Supabase.
- Producto: plataforma e-learning para aprendizaje de idiomas apoyada por IA.
- Estado actual: pre-MVP con scaffold inicial de aplicacion web y esquema Supabase B2B.
- Objetivo actual: definir un MVP minimo verificable que valide si los usuarios quieren aprender idiomas con una experiencia centrada en asistente IA, contenido educativo y seguimiento de progreso.
- La IA es el elemento diferencial del producto, pero el MVP debe evitar sobrecargar el alcance inicial con avatar, voz, video IA avanzado, personalizacion profunda o chatbot complejo salvo decision explicita documentada.

## Estructura relevante
- `contexto_proyecto.md`: fuente de verdad del contexto funcional, estado actual, flujos, restricciones y pendientes de validacion.
- `AGENTS.md`: reglas globales para agentes, stack objetivo, convenciones de trabajo y criterios operativos.
- `CLAUDE.md`: debe limitarse a importar `@AGENTS.md` y ajustes minimos especificos de Claude si hicieran falta.
- `README.md`: informacion publica o introductoria del proyecto.
- `docs/design-system.md`: fuente de verdad de las directrices visuales, tokens de diseno, tipografia, color, radios, elevacion y componentes UI.
- La raiz contiene scaffold Next.js con `package.json`, estructura `app/`, componentes base en `components/ui`, clientes Supabase en `lib/supabase` y SQL en `supabase/`.
- Las imagenes y assets visuales publicos de la web se centralizan en `public/images/`.

## Reglas de trabajo
- Leer `AGENTS.md` y `contexto_proyecto.md` al iniciar una nueva sesion sobre este repo.
- Mantener `contexto_proyecto.md` como fuente de verdad del estado funcional y operativo del sistema.
- Usar `CLAUDE.md` solo para importar `@AGENTS.md` y añadir ajustes minimos si hicieran falta.
- No documentar funcionalidades futuras como si ya estuvieran implementadas.
- Si cambia el esquema, los flujos funcionales o el setup, actualizar la documentacion raiz en el mismo trabajo.
- Antes de modificar codigo, comprobar si existe implementacion real. Si solo hay documentacion, no asumir rutas, scripts, dependencias ni arquitectura.
- Priorizar cambios pequenos, verificables y alineados con el estado pre-MVP.
- Para UI, seguir `docs/design-system.md` y reutilizar los tokens definidos en `app/globals.css` y los componentes base en `components/ui` antes de introducir colores, radios, sombras o escalas nuevas.
- Separar claramente:
  - Estado implementado.
  - Decisiones tomadas.
  - Hipotesis o pendientes de validacion.
- No duplicar contexto funcional detallado en `AGENTS.md`; moverlo o mantenerlo en `contexto_proyecto.md`.
- No introducir funcionalidades avanzadas en el MVP sin dejar documentada la decision y su impacto.
- Si se crea el scaffold de la aplicacion, actualizar este archivo con la estructura real y los comandos verificados.

## Criterios MVP
- Enfocar el primer MVP en el flujo basico: registro/inicio de sesion, catalogo simple, curso/leccion, asistente IA basico, ejercicios simples y progreso minimo.
- Validar primero la propuesta de valor del aprendizaje con IA antes de construir contenido multimedia complejo.
- Mantener el modelo de datos inicial lo bastante simple para iterar, pero preparado para cursos, unidades, lecciones, ejercicios, progreso y solicitudes al asistente.
- Documentar costes, limites y proveedor IA cuando se elijan herramientas concretas.

## Comandos
- `npm run dev`: desarrollo local.
- `npm run build`: build de produccion.
- `npm run start`: servidor de produccion.
- `npm run lint`: comprobacion de lint con ESLint.
- `npm test`: tests unitarios con Vitest ubicados en `unit-test/`.
- Nota: `npm test`, `npm run lint` y `npm run build` estan verificados en el scaffold actual.

## Configuracion
- Variables requeridas en entorno:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` necesaria solo en servidor para crear empresas, roles admin, paquetes y claves.
  - `N8N_ASSISTANT_TEXT_WEBHOOK_URL` necesaria solo en servidor para reenviar texto del asistente IA al webhook de n8n.
  - `N8N_ASSISTANT_AUDIO_WEBHOOK_URL` necesaria solo en servidor para reenviar audio del asistente IA al webhook de n8n.
  - Claves del proveedor IA elegido.

## Notas tecnicas
- Mantener TypeScript estricto cuando se inicialice el proyecto.
- Usar componentes y patrones existentes del repo antes de introducir abstracciones nuevas.
- Para Supabase, centralizar clientes y tipos generados cuando exista esquema.
- No exponer claves privadas en cliente, logs ni documentacion publica.
- Si se define esquema PostgreSQL, documentar tablas principales, RLS y migraciones.
- Si se implementa IA, registrar proveedor, modelo, coste estimado, limites de uso y estrategia de seguridad.
- Los webhooks de n8n del asistente deben configurarse en servidor mediante `N8N_ASSISTANT_TEXT_WEBHOOK_URL` y `N8N_ASSISTANT_AUDIO_WEBHOOK_URL`; no exponerlos como variables `NEXT_PUBLIC_*`.
