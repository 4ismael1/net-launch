# CLAUDE.md — Contexto persistente del proyecto

**Al iniciar cualquier sesión:** lee `docs/PROGRESO.md` (dónde vamos) y consulta `docs/PLAN.md` solo en la sección necesaria. No releas todo si no hace falta: **ahorrar tokens es prioridad del usuario**.

## Proyecto
Plataforma web de monitoreo mundial de lanzamientos espaciales (proyecto académico universitario, en español; i18n preparada para inglés). Centraliza la información dispersa con APIs públicas + WebGIS. Plan completo: `docs/PLAN.md`. Decisiones: `docs/DECISIONES.md`.

## Stack
Next.js (App Router) + TS · Tailwind v4 · Neon Postgres + Drizzle · sync LL2 con GitHub Actions cron · MapLibre GL v5 + MapTiler (satélite/relieve; respaldo OpenFreeMap) · Three.js/R3F + postprocessing + GSAP + Lenis (landing) · ECharts · PostHog · Sentry · satellite.js · next-intl · Vercel.

## Criterio
Uso bajo (universitario): elegir siempre la **mejor** opción gratuita, aunque requiera API key.

## Reglas no negociables
- El frontend **nunca** llama a Launch Library 2 directamente; todo pasa por la BD (15 req/h de límite).
- En desarrollo usar `https://lldev.thespacedevs.com/2.3.0/` (sin límite).
- **No inventar datos.** Si un campo no existe, se oculta o se indica "sin información pública".
- Sin telemetría ni trayectorias simuladas. Las posiciones orbitales se etiquetan "calculada (SGP4) desde elementos orbitales, época X".
- El clima es contexto; nunca predice cancelaciones.
- Cuenta regresiva local, respetando `net_precision`.
- Atribución visible: The Space Devs, MapTiler/OpenStreetMap/OpenFreeMap, Open-Meteo, CelesTrak.
- No traducir nombres oficiales (misiones, cohetes, agencias, bases).
- Estética: oscura, sobria, con un solo acento naranja `#FF5B1F`, Geist + mono. Nada de gradientes morados ni radios grandes.
- Si una API complementaria cae, solo se oculta su módulo.

## Flujo de trabajo
- Una fase por sesión de chat. Al terminar una tarea, actualizar `docs/PROGRESO.md` (hecho / siguiente paso exacto).
- Respuestas breves; no repetir el plan en el chat.
