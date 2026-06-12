---
name: update-project-context
description: Úsala cuando termine una tarea o cambie una parte relevante del sistema y haya que actualizar el contexto operativo del proyecto, la documentación viva, las decisiones técnicas o el estado funcional del sistema, respetando la jerarquía documental basada en AGENTS.md, CLAUDE.md y contexto_proyecto.md.
---

# Update Project Context

## Objetivo
Mantener actualizado el contexto útil del proyecto para futuras sesiones de desarrollo, respetando la jerarquía documental del repositorio y evitando mezclar instrucciones globales, funcionales y locales.

## Jerarquía documental del proyecto
Antes de actualizar documentación, asume esta jerarquía:

1. `AGENTS.md` en raíz  
   Contiene instrucciones globales del proyecto para agentes, buenas prácticas, stack tecnológico, reglas generales y normas compartidas.

2. `CLAUDE.md` en raíz  
   No debe duplicar contenido de `AGENTS.md`. Debe importar `@AGENTS.md` y añadir solo lo estrictamente necesario para ese entorno si aplica.

3. `contexto_proyecto.md` en raíz  
   Contiene el contexto funcional y operativo del proyecto: secciones, módulos, funcionalidades principales, flujos, restricciones funcionales, estado actual y otra información necesaria para entender el sistema.

4. `AGENTS.md` o `CLAUDE.md` dentro de subcarpetas  
   Aplican solo a esa zona concreta del proyecto.

5. Archivos con sufijo `.override`  
   Solo deben existir cuando sea necesario sobrescribir reglas heredadas de niveles superiores. Deben interpretarse como excepciones explícitas y localizadas.

## Regla obligatoria de inicio de sesión
Considera obligatorio que cualquier agente, al iniciar un nuevo chat o una nueva sesión de trabajo sobre el proyecto, lea al menos:

- `AGENTS.md` de la raíz
- `contexto_proyecto.md` de la raíz

Si existe `CLAUDE.md` en raíz, debe estar alineado con `AGENTS.md` e importar `@AGENTS.md`.

## Cuándo usar esta skill
- Después de implementar una feature
- Después de corregir un bug relevante
- Después de refactors importantes
- Después de cambiar arquitectura, contratos, scripts o workflows
- Cuando detectes que la documentación del repo está desalineada con el código
- Cuando cambie el comportamiento funcional del sistema
- Cuando se añada o elimine una sección o módulo relevante
- Cuando cambien reglas locales en una subcarpeta concreta

## Qué debes buscar
Antes de actualizar nada, inspecciona:

### Global
- `AGENTS.md`
- `CLAUDE.md`
- `contexto_proyecto.md`
- `README.md`
- `docs/`
- openapi specs si existen
- scripts de `package.json` / `Makefile` / task runners
- configuración de testing, lint, build y CI
- changelog o notas técnicas si existen

### Local
- `AGENTS.md` en subcarpetas afectadas
- `CLAUDE.md` en subcarpetas afectadas
- archivos `.override` relacionados con la zona modificada

## Criterio de actualización documental
Decide el archivo correcto según el tipo de cambio:

- Usa `AGENTS.md` raíz para:
  - reglas globales
  - buenas prácticas compartidas
  - stack tecnológico
  - convenciones generales
  - instrucciones base para agentes

- Usa `CLAUDE.md` raíz para:
  - importar `@AGENTS.md`
  - añadir ajustes mínimos específicos de Claude si realmente hacen falta
  - nunca duplicar el contenido global

- Usa `contexto_proyecto.md` para:
  - funcionalidades principales
  - módulos o secciones del sistema
  - flujos funcionales
  - estado actual del proyecto
  - contexto de negocio o de operación
  - restricciones funcionales
  - decisiones sobre qué hace cada parte del sistema

- Usa archivos en subcarpetas para:
  - reglas o contexto aplicables solo a esa zona del código
  - particularidades técnicas de un módulo o dominio concreto

- Usa `.override` solo cuando:
  - sea necesario sobrescribir explícitamente el comportamiento heredado
  - no baste con añadir documentación local normal
  - la excepción deba quedar claramente delimitada

## Procedimiento
1. Resume qué cambió realmente en el código.
2. Identifica si ese cambio afecta:
   - arquitectura global
   - setup local o global
   - variables de entorno
   - comandos de desarrollo
   - contratos API
   - estructura de carpetas
   - decisiones técnicas
   - funcionalidades del sistema
   - módulos o secciones del proyecto
   - limitaciones conocidas
   - reglas locales de una carpeta concreta
3. Determina si el cambio es:
   - global
   - funcional
   - local
   - una sobrescritura excepcional
4. Localiza el archivo documental correcto según la jerarquía.
5. Actualiza solo la documentación necesaria.
6. Evita duplicar información si ya existe una única fuente de verdad.
7. Si falta un documento clave, propón crearlo en vez de dispersar contexto.
8. Si detectas que `CLAUDE.md` duplica contenido de `AGENTS.md`, propón simplificarlo para que importe `@AGENTS.md`.

## Prioridad de actualización
Prioriza este orden:

1. `AGENTS.md` raíz si faltan reglas globales críticas
2. `contexto_proyecto.md` si cambió el comportamiento funcional del sistema
3. comandos reales de desarrollo y setup
4. contratos o interfaces públicas
5. documentación local de la carpeta afectada
6. decisiones técnicas relevantes
7. notas secundarias

## Reglas
- No inventes comportamiento no verificado.
- No documentes intenciones futuras como si ya estuvieran implementadas.
- Si hay incertidumbre, deja una nota explícita de validación pendiente.
- Mantén la documentación breve, operativa y verificable.
- No dupliques en `CLAUDE.md` lo que ya pertenece a `AGENTS.md`.
- No pongas contexto funcional del sistema en `AGENTS.md` si pertenece a `contexto_proyecto.md`.
- No uses `.override` salvo que realmente haga falta sobrescribir una regla superior.
- Si una regla o contexto aplica solo a una subcarpeta, documéntalo en esa zona y no en la raíz.

## Comprobaciones adicionales
Antes de cerrar la actualización, verifica:

- que `AGENTS.md` raíz sigue siendo la referencia global principal
- que `CLAUDE.md` raíz importa `@AGENTS.md`
- que `contexto_proyecto.md` refleja el estado funcional real del sistema
- que no hay duplicidades innecesarias entre documentos
- que las reglas locales están en la carpeta correcta
- que cualquier `.override` está justificado

## Formato de salida
Devuelve:

1. Resumen del cambio
2. Tipo de impacto:
   - global
   - funcional
   - local
   - override
3. Archivos de contexto que conviene actualizar
4. Propuesta concreta de actualización por archivo
5. Riesgos, inconsistencias o duplicidades detectadas
6. Si aplica, propuesta para reorganizar documentación entre `AGENTS.md`, `CLAUDE.md` y `contexto_proyecto.md`