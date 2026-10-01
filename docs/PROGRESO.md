# PROGRESO

## Estado actual
- **Hecho:** F1–F10 + módulo Satélites. Build de producción OK (`npx next build`, ~10 s).
- **Satélites** (`/satelites`): 19 grupos CelesTrak (estaciones, Starlink, OneWeb, Kuiper, GPS, Galileo, BeiDou, GLONASS, meteorológicos, NOAA, ciencia, CubeSats…), búsqueda en todo el catálogo, globo 3D de constelaciones (SGP4 cada 2 s), tabla filtrable, ficha por NORAD (posición en vivo, traza en el mapa, órbita 3D, elementos, SATCAT, enlace a su lanzamiento) y «¿cuándo pasa sobre mí?» (72 h, visibilidad a simple vista).
- **Landing:** capítulos + progreso, hero que cabe en una pantalla, cinta de próximos, pilares de la tesis, recorrido fijado con paradas discretas y resaltado en el globo, encaje global del scroll (Lenis), galería de menos conocidos, pie completo.
- **Siguiente paso exacto:** F11 → deploy en Vercel (el usuario crea la cuenta), respaldo del cron (el cron programado de GitHub aún no se dispara solo; el manual sí funciona), PostHog/Sentry, QA responsive/a11y, clave de MapTiler.
- **Ojo:** importar SGP4 SIEMPRE desde `@/lib/sgp4` (el índice de satellite.js carga WASM y cuelga el build). Los contenedores de MapLibre necesitan la altura del flujo (MapLibre fuerza position:relative).

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
- [x] OpenSky (cuenta gratuita; OPENSKY_CLIENT_ID/SECRET en .env.local y en Vercel). Rotar el secreto (quedó escrito en el chat)

## Bitácora
- 2026-09-30 — F0: plan y verificación de APIs.
- 2026-09-30 — F1: base de datos + sincronizador funcionando con lldev.
- 2026-09-30 — F2–F6: interfaz completa navegable con datos reales; traducciones Gemini funcionando (150 textos → 418 misiones).
- 2026-10-01 — Nuevos módulos: Programas, Reutilización, Astronautas, Naves (catálogos LL2 por páginas con cursor y reserva de 6 peticiones/h para lo urgente),
  Población orbital (SATCAT semanal), Asteroides (JPL CAD), Más allá de la órbita (JPL Horizons cada 6 h, interpolado), Imagen del día (APOD traducida),
  Esta noche (astronomy-engine + SGP4 en el navegador).
  Tráfico aéreo: retirado por decisión del usuario (queda en el historial de git, commit 83b4f3c, por si se retoma).
  Textos en español: tabla `translations` (md5 → es) + resúmenes de Wikipedia ES. Corregidos: scroll bloqueado (Next conserva páginas ocultas → `HtmlFlag`),
  "Ver en el mapa", pausa de los globos (preferencia compartida `net-globe-paused`).
  Notas: con Cache Components las páginas visitadas quedan montadas y ocultas (React Activity): nada de selectores `:has()` globales ni estado inicializado solo en el montaje.
