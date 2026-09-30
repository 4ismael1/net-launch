# PROGRESO

## Estado actual
- **Hecho:** F1–F9. Datos + sync (GitHub Actions), diseño/layout, panel, mapa, misión, explorador + Ctrl+K, organizaciones/bases/vehículos, eventos + en el espacio (instantáneas LL2 cada 3 h), estadísticas (ECharts + HHI), clima (Open-Meteo), órbitas (CelesTrak + SGP4 + visor Three.js propio).
- **Siguiente paso exacto:** verificar que `next build` pasa → F10 landing 3D con scroll (reutilizar el globo de `OrbitViewer`: continentes Natural Earth, sin texturas descargadas) → F11 (metodología, noticias SNAPI, deploy en Vercel, PostHog/Sentry, QA responsive/a11y).
- Paleta: grafito cálido, sin azul/morado. Éxito = gris `#9c988e` y fallo = rojo `#ff4d4f` en las gráficas (validado para daltonismo).
- Traducción: `gemini-flash-lite-latest`, máx. 6 peticiones/ejecución.

## Hecho en F1
- Next.js 16.3 + TS + Tailwind v4 (en la raíz). Ojo: leer `node_modules/next/dist/docs/` antes de usar APIs de Next (AGENTS.md).
- Esquema Drizzle en `src/lib/db/schema.ts`: agencies, locations, pads, rocket_configs, launches, launch_videos, launch_links, sync_state, sync_runs. Aplicado en Neon (`npm run db:push`).
- Cliente LL2 (`src/lib/ll2/client.ts`) con timeout, backoff y presupuesto; normalizador (`normalize.ts`) con tests (`npm test`).
- `npm run sync` (`scripts/sync.ts`): carga inicial de próximos → incremental por `last_updated__gte` → catálogo semanal (agencias + pads) → backfill histórico ascendente. Probado con lldev: 518 lanzamientos, 350 agencias, 223 pads.
- `.github/workflows/sync.yml`: cron cada 15 min.
- `.env.local` (no se sube) / `.env.example`.

## Pendientes del usuario
- [ ] Rotar la contraseña de Neon (quedó escrita en el chat) y actualizar `.env.local` y el secret
- [ ] Cuentas futuras: MapTiler (satélite; poner `NEXT_PUBLIC_MAPTILER_KEY`), NASA API, PostHog, Sentry, Vercel (deploy)
- [x] Gemini (clave en .env.local y en el secret de GitHub)

## Bitácora
- 2026-09-30 — F0: plan y verificación de APIs.
- 2026-09-30 — F1: base de datos + sincronizador funcionando con lldev.
- 2026-09-30 — F2–F6: interfaz completa navegable con datos reales; traducciones Gemini funcionando (150 textos → 418 misiones).
