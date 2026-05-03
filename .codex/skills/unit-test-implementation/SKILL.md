---
name: unit-test-implementation
description: Úsala para analizar el proyecto, identificar el stack tecnológico, seleccionar e instalar si procede el framework de testing unitario más adecuado, crear tests en la carpeta unit-test/, priorizar la cobertura de la columna vertebral de la aplicación sin descuidar funciones secundarias, ejecutar los tests cuando sea posible y generar un informe completo de resultados y cobertura pendiente.
---
# Unit Test Implementation
## Objetivo
Implementar y mantener tests unitarios sólidos, priorizando las funciones que forman la columna vertebral de la aplicación, sin dejar de cubrir funciones secundarias, seleccionando el framework de testing adecuado según el stack real del proyecto y centralizando los tests en la carpeta `unit-test/`.
## Objetivos específicos
Esta skill debe ser capaz de:
1. Analizar el stack tecnológico real del proyecto.
2. Seleccionar el framework de testing unitario más adecuado.
3. Informar de la elección y justificarla.
4. Instalarlo si no existe y si procede hacerlo dentro del proyecto.
5. Crear o mantener la carpeta `unit-test/` como ubicación base de tests unitarios.
6. Detectar qué partes del sistema forman la columna vertebral de la aplicación.
7. Priorizar esas partes en la estrategia de testing.
8. Seguir generando tests también para funciones menos relevantes.
9. Ejecutar los tests cuando sea posible.
10. Generar un informe claro del resultado de la ejecución.
11. Revisar tras cada cambio si se han añadido, modificado o eliminado funciones que requieran nuevos tests o ajustes de los existentes.
## Regla de ubicación de los tests
Todos los tests unitarios generados por esta skill deben ubicarse, por defecto, dentro de:
- `unit-test/`
Si el proyecto ya tiene una convención interna distinta y no puede alterarse sin romper la integración existente, debe:
1. detectarlo
2. señalarlo
3. proponer migración o convivencia
4. no romper el flujo actual sin indicarlo explícitamente
## Independencia del stack
Esta skill no debe asumir de antemano un lenguaje, framework o librería de test.
Antes de escribir tests, debe inspeccionar el proyecto para detectar:
- lenguaje principal
- framework principal
- sistema de build
- gestor de dependencias
- herramientas ya instaladas
- estructura actual del repositorio
- convenciones de testing ya existentes
- scripts o pipelines que ya ejecuten pruebas
## Detección del stack
Antes de generar tests, revisa al menos:
- `package.json`
- `pyproject.toml`
- `requirements.txt`
- `poetry.lock`
- `pom.xml`
- `build.gradle`
- `build.gradle.kts`
- `.csproj`
- `composer.json`
- `go.mod`
- `Cargo.toml`
- `Makefile`
- archivos de CI
- scripts de build y test
- carpetas de test ya existentes
- dependencias de desarrollo relacionadas con testing
## Selección del framework de testing
Una vez detectado el stack, selecciona el framework de testing unitario más adecuado según:
- compatibilidad con el proyecto
- integración con el ecosistema real del repo
- madurez y adopción
- facilidad de mantenimiento
- capacidad para integrarse en automatización y CI
- mínima fricción con la estructura actual
## Obligación de informar antes de actuar
Antes de escribir tests o instalar herramientas, informa claramente de:
1. stack detectado
2. framework de testing elegido
3. motivo de la elección
4. si ya estaba instalado o no
5. si se necesita instalación o configuración adicional
6. cómo se integrará con la carpeta `unit-test/`
## Instalación del framework
Si el proyecto no dispone de framework de testing adecuado y es razonable instalarlo, esta skill debe:
1. proponer el framework seleccionado
2. instalarlo si el entorno y la tarea lo permiten
3. configurar lo mínimo necesario para empezar a testear
4. añadir o proponer scripts de ejecución si faltan
5. mantener la configuración lo más simple posible
No debe:
- instalar múltiples frameworks sin necesidad
- introducir herramientas redundantes
- reconfigurar masivamente el proyecto si no hace falta
- romper configuraciones existentes sin indicarlo
## Prioridad funcional: columna vertebral de la aplicación
Esta skill debe dar prioridad a las funciones que sostienen el comportamiento principal del sistema.
Se consideran parte de la columna vertebral de la aplicación, si aplica:
- reglas principales de negocio
- servicios nucleares
- módulos core
- autenticación y autorización
- cálculos clave
- validaciones críticas
- procesos de persistencia principales
- transformaciones esenciales de datos
- flujos principales de usuario
- lógica que conecta módulos centrales
- funciones de las que dependen otras muchas partes del sistema
## Regla de priorización
El orden de prioridad para escribir tests debe ser:
1. funciones críticas o estructurales del sistema
2. funciones con alta reutilización o alto impacto
3. funciones con historial de bugs o alta probabilidad de regresión
4. funciones secundarias relevantes
5. utilidades menos críticas
## Regla de cobertura
Aunque debe priorizarse la columna vertebral de la aplicación, no debe abandonarse la cobertura de funciones menos relevantes.
Principio obligatorio:
- cuanto más probada esté la aplicación, mejor

Por tanto:
- primero prioriza lo crítico
- después amplía cobertura sobre el resto
- si no puede cubrir todo, deja constancia clara de la cobertura pendiente
## Qué debes analizar antes de escribir tests
Antes de implementar nada, revisa:
### 1. La unidad objetivo
- qué recibe
- qué devuelve
- qué valida
- qué transforma
- qué calcula
- de qué depende
- qué partes del sistema dependen de ella
### 2. El nivel de criticidad
Clasifica cada función o unidad como:
- crítica
- alta
- media
- baja
La clasificación debe considerar:
- impacto de fallo
- frecuencia de uso
- posición en la arquitectura
- dependencia de otros módulos
- exposición a entradas externas
- sensibilidad de negocio
### 3. El formato y contrato de datos
Comprueba:
- tipos esperados
- formatos esperados
- campos obligatorios
- campos opcionales
- estructuras válidas
- valores permitidos
- restricciones
### 4. Riesgos de fallo
Comprueba si existen riesgos como:
- división entre 0
- módulo entre 0
- null / undefined
- arrays vacíos
- acceso fuera de rango
- parseos erróneos
- NaN
- Infinity
- overflows
- underflows
- pérdida de precisión
- redondeos inesperados
- strings vacíos
- formatos mal construidos
- campos ausentes
- estados inconsistentes
- errores por dependencias externas
## Casos que deben evaluarse siempre que apliquen
### 1. Caso feliz
La función responde correctamente con entradas válidas.
### 2. Formato correcto e incorrecto
Comprobar:
- datos válidos
- tipos incorrectos
- estructuras incompletas
- formatos mal formados
- campos ausentes
- null / undefined
- vacíos
### 3. Valores límite
Comprobar:
- 0
- 1
- -1
- mínimo permitido
- máximo permitido
- longitud mínima
- longitud máxima
- primer valor
- último valor
- colecciones vacías
- colecciones de un solo elemento
### 4. Casos inválidos
Comprobar:
- datos fuera de rango
- combinaciones no permitidas
- entradas inconsistentes
- restricciones de negocio incumplidas
### 5. Operaciones peligrosas
Comprobar:
- división entre 0
- operaciones con denominadores inválidos
- parseos inseguros
- conversiones conflictivas
- cálculos extremos
- estados no inicializados
- datos corruptos
- uso de claves inexistentes
### 6. Gestión de errores
Comprobar que el sistema:
- lanza error si debe hacerlo
- devuelve respuesta controlada si así está definido
- no deja estados inconsistentes
- no oculta errores importantes


### 7. Regresión
Si existe un bug previo o una corrección reciente, añade al menos un test de regresión.
## Procedimiento general
1. Detecta el stack del proyecto.
2. Selecciona el framework de testing más adecuado.
3. Informa de la decisión.
4. Comprueba si ya está instalado.
5. Instálalo si procede.
6. Crea o valida la carpeta `unit-test/`.
7. Analiza la arquitectura y detecta funciones críticas.
8. Enumera los casos de prueba antes de escribir código.
9. Implementa primero tests para la columna vertebral de la aplicación.
10. Amplía cobertura al resto de funciones relevantes.
11. Ejecuta los tests cuando sea posible.
12. Genera un informe de resultados.
13. Revisa tras cada cambio si han aparecido funciones nuevas, rutas nuevas, validaciones nuevas o lógica modificada que requiera nuevos tests o actualización de los existentes.
## Ejecución tras cambios
Siempre que el entorno lo permita, esta skill debe ejecutar los tests después de cambios relevantes.
Debe intentar:
- ejecutar los tests de la unidad modificada
- ejecutar el conjunto de tests afectados
- ejecutar el conjunto completo si es viable
Si no puede ejecutar tests:
- debe decirlo explícitamente
- debe indicar por qué
- debe dejar instrucciones claras para ejecutarlos manualmente
## Detección de necesidad de nuevos tests tras cambios
Tras cada cambio, esta skill debe revisar si:
- se añadió una función nueva
- se modificó una firma
- se cambió una validación
- se añadió lógica condicional
- se añadieron cálculos
- se modificaron formatos de entrada o salida
- se alteró un flujo core
- se añadió manejo de errores
- cambió el contrato de datos
- se introdujeron nuevas ramas de ejecución
Si detecta alguno de estos casos, debe:
1. señalar que se requieren nuevos tests o actualización de tests existentes
2. proponer los nuevos casos necesarios
3. implementarlos si la tarea lo requiere
## Informe obligatorio tras ejecución
Después de ejecutar tests, genera un informe con:
1. framework utilizado
2. carpeta de tests usada
3. alcance de los tests ejecutados
4. número de tests ejecutados
5. número de tests correctos
6. número de tests fallidos
7. errores encontrados
8. módulos o funciones cubiertas
9. módulos o funciones pendientes
10. funciones críticas aún sin cobertura suficiente
11. posibles validaciones ausentes en código productivo
12. recomendaciones siguientes
## Formato de salida
Devuelve:
1. Stack detectado
2. Framework de testing elegido
3. Motivo de la elección
4. Estado de instalación/configuración
5. Resumen de unidades analizadas
6. Clasificación de criticidad
7. Casos de prueba propuestos
8. Riesgos o validaciones ausentes detectadas
9. Implementación de los tests
10. Resultado de la ejecución
11. Informe de cobertura y pendientes
12. Nuevas funciones detectadas que requieren tests adicionales
## Reglas
- No asumas un stack sin inspeccionarlo.
- No impongas un framework sin justificarlo.
- No escribas tests antes de decidir ubicación, framework y estrategia.
- No ignores funciones críticas del sistema.
- No descuides funciones secundarias si hay margen para ampliar cobertura.
- No ocultes validaciones ausentes ni riesgos detectados.
- Si una operación peligrosa no está controlada, señálalo.
- Si el proyecto ya tiene una convención válida, respétala o explica por qué adaptarla.
- Prioriza robustez, trazabilidad y prevención de regresiones.