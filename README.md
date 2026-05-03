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
```

3. En Supabase SQL Editor, ejecuta:

```bash
supabase/schema.sql
```

4. Crea al menos un curso activo en Supabase.

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

## Comandos verificados

```bash
npm run lint
npm run build
```
