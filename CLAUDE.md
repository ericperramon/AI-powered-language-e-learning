# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Comandos adicionales
- `npx vitest run unit-test/<archivo>.test.ts`: ejecutar un único fichero de tests.
- `npx vitest run --reporter=verbose`: salida detallada de todos los tests.

## Arquitectura clave

### Clientes Supabase (tres variantes)
- `lib/supabase/browser.ts`: cliente browser para componentes cliente (`createBrowserClient`).
- `lib/supabase/server.ts`: cliente SSR para RSC y Server Actions (`createServerClient` con cookies de `next/headers`). Respeta RLS del usuario autenticado.
- `lib/supabase/admin.ts`: cliente con `SUPABASE_SERVICE_ROLE_KEY`. Bypasa RLS; usar solo en Server Actions para operaciones que requieren privilegio elevado (crear empresas, generar claves, borrar usuarios).

### Roles y bifurcación de UI
`profiles.role` es `"admin"` (administrador de empresa) o `"alumno"` (empleado/estudiante). El dashboard (`app/dashboard/page.tsx`) renderiza `AdminDashboard` o `StudentDashboard` según este campo. Las Server Actions comprueban el rol explícitamente antes de operar.

### Flujo de autenticación
`app/page.tsx` redirige a `/auth?mode=signin`. La página de auth soporta modos: `signin`, `register-company`, `register-employee`. Tras autenticarse, el usuario llega a `/dashboard`.

### Mutaciones (Server Actions)
Todas las mutaciones del dashboard están en `app/dashboard/actions.ts` como funciones `"use server"`. Se usan como `action={fn}` en formularios o llamadas directas desde componentes cliente. Redirigen en caso de error salvo las que devuelven `{ error?: string }` para uso programático.

### Flujo de contenido del curso
`/dashboard/courses/[courseId]` — unidades y lecciones ordenadas por `sort_order`. Solo la primera lección o la siguiente a una completada está desbloqueada. Tipos de lección: `video` → `exercise` → lección `text` con `pdf_url` (resumen PDF) → lección `exam` con `requires_exam` (prueba ≥ 80 % para desbloquear la siguiente unidad).

### Asistente IA
Componente flotante global (`components/ai-assistant.tsx`). Envía mensajes a `/api/assistant`, que actúa de proxy hacia los webhooks n8n configurados en `N8N_ASSISTANT_TEXT_WEBHOOK_URL` (texto) y `N8N_ASSISTANT_AUDIO_WEBHOOK_URL` (audio). La lógica del webhook está en `lib/assistant/webhook.ts`.
