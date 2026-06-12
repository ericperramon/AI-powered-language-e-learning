# IMPORTANT_FIXES

Revisión completa del proyecto realizada el **2026-06-12**. Este documento recoge
las vulnerabilidades, errores y cambios relevantes detectados, su severidad, su
ubicación y la acción tomada (corregido en este trabajo o pendiente/recomendado).

Estado de verificación tras los cambios: `npm run lint` sin errores ni avisos,
`npx vitest run` 46/46 en verde, `npm run build` correcto.

Leyenda de estado: ✅ Corregido · 📝 Documentado (sin cambiar comportamiento) · ⚠️ Pendiente de decisión

---

## 🔴 Críticos

### 1. Endpoints de IA sin autenticación ni límite de uso — ✅ Corregido
- **Ubicación:** `app/api/assistant/route.ts`, `app/api/assistant/session/route.ts`.
- **Impacto:** Ambas rutas eran públicas. Cualquiera en internet podía:
  - `POST /api/assistant/session` para acuñar un *client secret* efímero de OpenAI
    Realtime y consumir presupuesto de OpenAI (abuso de coste / DoS económico).
  - `POST /api/assistant` para reenviar payloads arbitrarios al webhook de n8n.
  - No existía ningún *rate limiting*.
- **Fix aplicado:** Nuevo guard `lib/assistant/guard.ts` con `guardAssistantRequest()`
  que exige usuario autenticado (`supabase.auth.getUser()`, devuelve `401`) y aplica un
  *rate limit* best-effort por usuario (20 req/min, devuelve `429`). Integrado al inicio
  de ambos handlers `POST`.
- **Recomendación de producción:** El *rate limiter* es en memoria y por instancia
  (se reinicia en cada despliegue y no se comparte entre instancias serverless).
  Para producción, respaldarlo con Redis/Upstash. Cubierto por tests en
  `unit-test/assistant-guard.test.ts`.

---

## 🟠 Altos / Medios

### 2. Componentes definidos durante el render (React 19) — ✅ Corregido
- **Ubicación:** `components/dashboard/sidebar.tsx`.
- **Impacto:** `ExpandedContent` y `CollapsedContent` se declaraban como componentes
  dentro del cuerpo de `DashboardSidebar`. En cada render React los trata como un tipo
  de componente nuevo → desmontaje/remontaje del subárbol, pérdida de estado y de foco.
  Eran 3 de los 5 errores de ESLint (`react-hooks/static-components`).
- **Fix aplicado:** Convertidos a funciones de render planas (`renderExpanded()`,
  `renderCollapsed()`) invocadas directamente, sin identidad de componente.

### 3. `setState` síncrono dentro de un efecto — ✅ Corregido
- **Ubicación:** `components/redeem-success-modal.tsx`.
- **Impacto:** `setMounted(true)` síncrono en el cuerpo del efecto provoca renders en
  cascada (`react-hooks/set-state-in-effect`).
- **Fix aplicado:** `mounted` se inicializa desde la prop `show`; el efecto solo
  programa la animación con `setTimeout` (asíncrono).

### 4. Endpoint público sin límites de tamaño — ✅ Corregido
- **Ubicación:** `app/explore-actions.ts` (`submitCourseRequest`).
- **Impacto:** Server Action pública (landing) que inserta en `course_requests` sin
  topes de longitud → vector de spam/abuso de base de datos.
- **Fix aplicado:** Recorte y topes de longitud (`name` 120, `contact` 160, `sector` 500).
- **Pendiente recomendado:** añadir rate limiting / captcha y, si procede, verificación
  de email antes de exponerlo masivamente.

### 5. Entidad sin escapar en JSX — ✅ Corregido
- **Ubicación:** `components/dashboard/employee-config-panel.tsx`.
- **Fix aplicado:** `employee's` → `employee&apos;s` (`react/no-unescaped-entities`).

---

## 🟡 Bajos / Limpieza

### 6. Código muerto: `purchaseCourse` — ✅ Corregido (eliminado)
- **Ubicación:** `app/dashboard/actions.ts`.
- **Detalle:** Existían dos flujos de compra casi idénticos. Solo `purchaseCourseAction`
  está cableado (`components/purchase-form.tsx`); `purchaseCourse` (variante con
  `redirect`) no se usaba en ninguna parte. Eliminado para reducir duplicación y
  superficie de ataque.

### 7. Avisos de variables sin usar — ✅ Corregido
- `app/dashboard/page.tsx`: import `Select` sin usar → eliminado.
- `app/dashboard/courses/[courseId]/page.tsx`: componente `StatusBadge` sin usar → eliminado.
- `.../lessons/[lessonId]/page.tsx`: import `submitPracticeTask` y prop `blankIds`
  sin usar → eliminados (incluido el `blankIds` del *call site*).

---

## 📝 Documentado / ⚠️ Pendiente de decisión (sin cambiar comportamiento)

### 8. Nota mal etiquetada en un comentario, NO un bug — aclaración
- **Ubicación:** `lib/supabase/server.ts` (comentario "middleware keeps sessions fresh").
- **Aclaración:** La revisión inicial sospechó que faltaba `middleware.ts`. **No es un
  bug:** Next.js 16 renombra `middleware.ts` → `proxy.ts`, y el proyecto **sí** tiene
  `proxy.ts` en la raíz implementando correctamente el refresco de sesión de Supabase SSR.
  No se requiere ninguna acción.

### 9. Nota de calificación auto-reportada en exámenes sin ejercicios — ⚠️ Pendiente
- **Ubicación:** `app/dashboard/courses/[courseId]/actions.ts` (`submitUnitTest`) y
  `.../lessons/[lessonId]/page.tsx` (formulario usado cuando `exercises.length === 0`).
- **Detalle:** Cuando una lección de examen no tiene ejercicios auto-corregibles, el
  alumno escribe manualmente su propia nota en un `input` y el servidor confía en ella
  (`score >= 80`). Es un agujero de integridad (auto-calificación).
- **Por qué no se ha cambiado:** Es un *fallback* MVP documentado; eliminarlo dejaría
  sin vía de finalización a los exámenes sin contenido auto-evaluable. La ruta segura
  paralela (`submitUnitTestExercises`) sí calcula la nota en servidor a partir de las
  respuestas.
- **Recomendación:** Sustituir el examen auto-reportado por exámenes con ejercicios
  estructurados antes de producción, o mover la nota a un proceso revisado.

### 10. Generación de claves de acceso sin reintento por colisión — 📝 Documentado
- **Ubicación:** `app/dashboard/actions.ts` (`generateAccessCode`) + `purchaseCourseAction`.
- **Detalle:** El código son 48 bits (12 hex). Hay restricción `unique` en BD, pero la
  inserción en lote de N claves falla por completo si una colisiona (sin reintento).
- **Recomendación:** Aumentar entropía y/o insertar con reintento individual ante
  violación de unicidad.

### 11. Detección de usuario duplicado por *string matching* — 📝 Documentado
- **Ubicación:** `app/auth/actions.ts` (`isDuplicateUserError`).
- **Detalle:** Depende de buscar subcadenas ("already", "duplicate"…) en el mensaje de
  error, frágil ante cambios de Supabase. La comprobación previa `emailExists` mitiga el
  caso común, pero conviene apoyarse en el código/estado de error estructurado.

### 12. Aplicación de licencias adquiridas no forzada — ⚠️ Pendiente
- **Ubicación:** `supabase/schema.sql` (comentarios "Pending decision…") + flujo de compra.
- **Detalle:** Cada compra genera tantas claves como licencias, pero no hay control
  transaccional que impida generar/usar más claves de las adquiridas a lo largo del tiempo.
- **Recomendación:** RPC transaccional de generación de claves que descuente licencias.

### 13. Filtración de mensajes de error internos al cliente — 📝 Documentado
- **Ubicación:** redirects con `?error=${encodeURIComponent(error.message)}` (varias
  Server Actions) y `app/api/assistant/session/route.ts` (devuelve el texto de error de
  OpenAI al cliente).
- **Detalle:** Expone detalles internos de Supabase/OpenAI. Bajo impacto, pero conviene
  registrar el detalle en el servidor y devolver mensajes genéricos al cliente.

### 14. Controles de UI no funcionales en la pantalla de acceso — 📝 Documentado
- **Ubicación:** `app/auth/auth-panel.tsx`.
- **Detalle:** "Forgot Password?", "Remember me for 30 days" y los botones sociales
  Google/Apple son decorativos (sin handler). Decisión de producto: o se implementan o
  se ocultan hasta tenerlos, para no prometer funciones inexistentes.

---

## Resumen de archivos tocados en este trabajo

Seguridad / correcciones:
- `lib/assistant/guard.ts` (nuevo) — auth + rate limit de los endpoints de IA.
- `app/api/assistant/route.ts`, `app/api/assistant/session/route.ts` — guard integrado.
- `app/explore-actions.ts` — topes de longitud.
- `components/dashboard/sidebar.tsx` — render functions en vez de componentes en render.
- `components/redeem-success-modal.tsx` — sin setState síncrono en efecto.
- `components/dashboard/employee-config-panel.tsx` — entidad escapada.
- `app/dashboard/actions.ts` — `purchaseCourse` muerto eliminado.
- `app/dashboard/page.tsx`, `app/dashboard/courses/[courseId]/page.tsx`,
  `app/dashboard/courses/[courseId]/lessons/[lessonId]/page.tsx` — limpieza de no usados.

Frontend (dentro de los tokens del Design System):
- `app/globals.css` — utilidades `.ds-eyebrow` y `.lesson-exchange` (firma del hero).
- `app/page.tsx` — hero editorial con conversación IA como elemento de firma.
- `app/dashboard/page.tsx` — *eyebrow* en la cabecera para cohesión.
- `docs/design-system.md` — documentación de los nuevos patrones.

Tests:
- `unit-test/exercise-evaluation.test.ts` — formato de mapa plano + más shapes.
- `unit-test/assistant-system-prompt.test.ts` (nuevo).
- `unit-test/assistant-guard.test.ts` (nuevo) — rate limiter.
