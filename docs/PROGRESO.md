# PROGRESO

## Estado actual
- **Fase actual:** F1 casi completa. Falta subir a GitHub y activar el cron con la API real.
- **Siguiente paso exacto:**
  1. Crear un repo privado en GitHub, hacer push y crear el secret `DATABASE_URL`.
  2. Cambiar a datos reales: vaciar las tablas (ahora hay datos de `lldev`) y dejar que el Action haga la carga (~6 h para el histórico).
  3. Empezar F2 (sistema de diseño + layout + panel).

## Hecho en F1
- Next.js 16.3 + TS + Tailwind v4 (en la raíz). Ojo: leer `node_modules/next/dist/docs/` antes de usar APIs de Next (AGENTS.md).
- Esquema Drizzle en `src/lib/db/schema.ts`: agencies, locations, pads, rocket_configs, launches, launch_videos, launch_links, sync_state, sync_runs. Aplicado en Neon (`npm run db:push`).
- Cliente LL2 (`src/lib/ll2/client.ts`) con timeout, backoff y presupuesto; normalizador (`normalize.ts`) con tests (`npm test`).
- `npm run sync` (`scripts/sync.ts`): carga inicial de próximos → incremental por `last_updated__gte` → catálogo semanal (agencias + pads) → backfill histórico ascendente. Probado con lldev: 518 lanzamientos, 350 agencias, 223 pads.
- `.github/workflows/sync.yml`: cron cada 15 min.
- `.env.local` (no se sube) / `.env.example`.

## Pendientes del usuario
- [ ] Rotar la contraseña de Neon (quedó escrita en el chat) y actualizar `.env.local` y el secret
- [ ] Cuentas futuras: MapTiler (F3), Google AI Studio/Gemini (F6), NASA API, PostHog y Sentry (F11)

## Bitácora
- 2026-09-30 — F0: plan y verificación de APIs.
- 2026-09-30 — F1: base de datos + sincronizador funcionando con lldev.
