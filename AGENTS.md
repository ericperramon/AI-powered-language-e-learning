# AGENTS

## Proyecto
- Aplicacion web con `Next.js 16`, `React 19`, `TypeScript`, `Tailwind CSS 4` y `shadcn/ui`.
- El acceso a datos se realiza con `@supabase/supabase-js` contra una base de datos PostgreSQL en Supabase.
- Producto: plataforma e-learning para aprendizaje de idiomas apoyada por IA.
- Estado actual: definicion conceptual / pre-MVP. No hay producto desarrollado ni arquitectura tecnica cerrada en este repositorio.
- Objetivo actual: definir un MVP minimo verificable que valide si los usuarios quieren aprender idiomas con una experiencia centrada en asistente IA, contenido educativo y seguimiento de progreso.
- La IA es el elemento diferencial del producto, pero el MVP debe evitar sobrecargar el alcance inicial con avatar, voz, video IA avanzado, personalizacion profunda o chatbot complejo salvo decision explicita documentada.

## Estructura relevante
- `contexto_proyecto.md`: fuente de verdad del contexto funcional, estado actual, flujos, restricciones y pendientes de validacion.
- `AGENTS.md`: reglas globales para agentes, stack objetivo, convenciones de trabajo y criterios operativos.
- `CLAUDE.md`: debe limitarse a importar `@AGENTS.md` y ajustes minimos especificos de Claude si hicieran falta.
- `README.md`: informacion publica o introductoria del proyecto.
- Actualmente la raiz contiene documentacion inicial, pero no se ha confirmado scaffold de aplicacion Next.js, `package.json`, estructura `app/`, `src/`, componentes, Supabase ni tests.

## Reglas de trabajo
- Leer `AGENTS.md` y `contexto_proyecto.md` al iniciar una nueva sesion sobre este repo.
- Mantener `contexto_proyecto.md` como fuente de verdad del estado funcional y operativo del sistema.
- Usar `CLAUDE.md` solo para importar `@AGENTS.md` y añadir ajustes minimos si hicieran falta.
- No documentar funcionalidades futuras como si ya estuvieran implementadas.
- Si cambia el esquema, los flujos funcionales o el setup, actualizar la documentacion raiz en el mismo trabajo.
- Antes de modificar codigo, comprobar si existe implementacion real. Si solo hay documentacion, no asumir rutas, scripts, dependencias ni arquitectura.
- Priorizar cambios pequenos, verificables y alineados con el estado pre-MVP.
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
- Nota: estos comandos son objetivo para el stack previsto. Verificar que existe `package.json` antes de ejecutarlos.

## Configuracion
- Variables requeridas en entorno:
- Pendiente de confirmar al crear la aplicacion y conectar Supabase.
- Variables previsibles, no confirmadas todavia:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` solo si se necesita en servidor y nunca en cliente.
  - Claves del proveedor IA elegido.

## Notas tecnicas
- Mantener TypeScript estricto cuando se inicialice el proyecto.
- Usar componentes y patrones existentes del repo antes de introducir abstracciones nuevas.
- Para Supabase, centralizar clientes y tipos generados cuando exista esquema.
- No exponer claves privadas en cliente, logs ni documentacion publica.
- Si se define esquema PostgreSQL, documentar tablas principales, RLS y migraciones.
- Si se implementa IA, registrar proveedor, modelo, coste estimado, limites de uso y estrategia de seguridad.
