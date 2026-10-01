# CLAUDE.md — Contexto persistente del proyecto

**Al iniciar cualquier sesión:** lee `docs/PROGRESO.md` (dónde vamos) y consulta `docs/PLAN.md` solo en la sección necesaria. No releas todo si no hace falta: **ahorrar tokens es prioridad del usuario**.

## Proyecto
Plataforma web de monitoreo mundial de lanzamientos espaciales (proyecto académico universitario, en español; i18n preparada para inglés). Centraliza la información dispersa con APIs públicas + WebGIS. Plan completo: `docs/PLAN.md`. Decisiones: `docs/DECISIONES.md`.

## Stack (real, 2026-10)
Next.js 16 (App Router, **Cache Components**) + TS · Tailwind v4 · Neon Postgres + Drizzle (neon-http) · sync LL2 propio (`src/lib/sync/run.ts`: autosync en `/api/live`, cron diario de Vercel, GitHub Actions) · MapLibre GL v6 + OpenFreeMap (MapTiler opcional) · Three.js (globos, SGP4 con satellite.js vía `@/lib/sgp4`) · GSAP + ScrollTrigger (landing; **sin Lenis**) · ECharts · astronomy-engine · Gemini (traducción) · Vercel.

## Criterio
Uso bajo (universitario): elegir siempre la **mejor** opción gratuita, aunque requiera API key.

## Reglas no negociables
- El frontend **nunca** llama a Launch Library 2 directamente; todo pasa por la BD (15 req/h de límite).
- En desarrollo usar `https://lldev.thespacedevs.com/2.3.0/` (sin límite).
- **No inventar datos.** Si un campo no existe, se oculta o se indica "sin información pública".
- Sin telemetría ni trayectorias simuladas. Las posiciones orbitales se etiquetan "calculada (SGP4) desde elementos orbitales, época X".
- El clima es contexto; nunca predice cancelaciones.
- Cuenta regresiva local, respetando `net_precision`.
- Atribución visible: The Space Devs, OpenStreetMap/OpenFreeMap, Open-Meteo, CelesTrak, NASA/JPL, Wikipedia.
- No traducir nombres oficiales (misiones, cohetes, agencias, bases).
- Estética: **grafito cálido neutro** (fondo `#0B0B0A`, SIN tinte azul ni morado: el usuario lo considera "estética de IA"), un solo acento naranja `#FF5B1F`, Geist + mono, radios pequeños. El mapa base se recolorea con `neutralizeBasemap`.
- Si una API complementaria cae, solo se oculta su módulo.
- Antes de tocar código, leer la sección "Lecciones técnicas" de `docs/PROGRESO.md` (Activity de Next, cachés, SGP4, MapLibre…).

## Flujo de trabajo
- Una fase por sesión de chat. Al terminar una tarea, actualizar `docs/PROGRESO.md` (hecho / siguiente paso exacto).
- Respuestas breves; no repetir el plan en el chat.

@AGENTS.md
