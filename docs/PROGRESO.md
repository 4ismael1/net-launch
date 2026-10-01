# PROGRESO

> Leer esto al iniciar sesión. Última actualización: **2026-10-01** (auditoría). Producción: **https://net-launch.vercel.app** (Vercel, región `cle1`).
> Repo en `main` (todo subido). Build local: `npx next build` (~1 min). Typecheck: `npx tsc --noEmit -p .` · Lint: `npx eslint src`.

## 1. Estado general
Plataforma completa y desplegada. Proyecto académico de **Ana Isabel Ruiz Gómez y Yeslei Vannesa Mora Gómez** (Ing. Aeronáutica, UPB; curso Metodología de la Investigación, prof. Carolina Buitrago Arias). Crédito técnico discreto en `/acerca` y pie: *Desarrollo de software: Ing. Ismael Paulino* (no debe restar protagonismo a las autoras).

### Secciones (menú en `src/components/shell/nav.ts`)
| Grupo | Rutas |
|---|---|
| Portada | `/` landing 3D con scroll nativo + `scroll-snap` (sin barra de progreso ni puntos laterales: el usuario no los quiere) |
| Explorar | `/panel`, `/mapa`, `/lanzamientos` (+`[slug]`), `/eventos`, `/en-el-espacio`, `/satelites` (+`[norad]`), `/orbita/[slug]` |
| Datos | `/organizaciones` (+`[id]`), `/bases` (+`[id]`), `/vehiculos` (+`[id]`), `/programas` (+`[id]`), `/reutilizacion`, `/estadisticas` |
| Universo | `/esta-noche`, `/mas-alla` (3D heliocéntrico con simulación), `/poblacion-orbital` (globo 3D, SGP4), `/asteroides` (radar clicable), `/astronautas` (+`[id]`), `/naves`, `/imagen-del-dia` |
| Información | `/noticias`, `/metodologia`, `/acerca` |

### Fuentes de datos
- **LL2 2.3.0** (principal): solo vía BD (Neon + Drizzle). Límite 15 req/h → nos auto-limitamos a **14/h** (ventana deslizante en `sync_state` clave `ll2_request_log:<host>`), con **reserva de 6/h** para lo urgente (`LL2_RESERVE`).
- **CelesTrak** GP (satélites, caché 3 h) y **SATCAT** (resumen semanal guardado en `sync_state.satcat`).
- **JPL Horizons** (sondas, efemérides cada 6 h × 4 días, interpoladas en el navegador; caché 12 h; de 2 en 2 con reintento) y **JPL CAD** (asteroides, caché 3 h).
- **NASA APOD**: la API de api.nasa.gov está rota (devuelve el logotipo) → se lee el **RSS oficial** `https://science.nasa.gov/feed/apod-basic/` (30 días).
- **Open-Meteo** (clima), **Spaceflight News API** (noticias), **Wikipedia ES** (resúmenes vía langlinks; fallos con caché corta), **astronomy-engine** (Sol/Luna/planetas en el navegador), **OpenFreeMap** (mapa base; MapTiler opcional con `NEXT_PUBLIC_MAPTILER_KEY`).
- **Gemini** `gemini-flash-lite-latest` para traducir EN→ES; tabla `translations` (md5 → es). `ensureEs` traduce al vuelo solo contenidos diarios (APOD).

### Sincronización (`src/lib/sync/run.ts`, `runSync`)
Disparadores: (1) autosync en `/api/live` vía `after()` si los datos tienen >15 min y como mucho 1 intento cada 10 min; (2) cron de Vercel diario `0 6 * * *` (`/api/cron/sync`, Bearer `CRON_SECRET`); (3) GitHub Actions cada 15 min (el **programado aún no se dispara solo**; el manual sí). Candado en BD (`sync_lock`).
Orden: próximos (detailed) / incremental `last_updated__gte` → instantáneas cada 3 h (eventos, astronautas en el espacio, estaciones, expediciones + **últimos 25 lanzamientos en detailed**) → catálogo semanal (agencias, plataformas) → **catálogos LL2 por páginas** (`catalog_jobs`: programs, launchers, landings, spacecraft, astronauts; tabla `catalog`) → histórico descendente (`backfill_desc`, mode normal) → SATCAT semanal → traducciones. Revalida `ll2` si cambian lanzamientos **o** catálogos.
Estado al cerrar: catálogo con programs 39, launchers 196, landings ~100 (sigue); **faltan spacecraft y astronauts** (llegan solos en las próximas horas). Histórico ~4.850 lanzamientos (offset ~4100, sigue).

## 2. Lecciones técnicas (no repetir errores)
- **Next 16 con `cacheComponents`**: leer `node_modules/next/dist/docs/` antes de usar APIs. `new Date()`/`Date.now()` no se pueden usar en render prerenderizado (usar datos o `"use cache"`); `generateStaticParams` debe devolver ≥1 elemento; tras crear rutas, `npx next typegen` (si `.next/dev/types` se corrompe, borrarlo).
- **Las páginas visitadas quedan montadas y ocultas (React Activity)**: nada de selectores globales `:has([data-x])` → usar `<HtmlFlag name="…">` (marca `<html data-…>` con efecto). No inicializar estado solo al montar si depende de la URL (ver `WorldMap`: ajuste en render con `seenUrl`).
- `"use cache"` cachea también los `null` de fallos → para APIs externas, `cacheLife` corto cuando falla (ver `wikiEs`, `getProbes`).
- No exportar funciones/constantes desde archivos `"use client"` para usarlas en el servidor (llegan como referencias de cliente) → helpers en `src/lib/format.ts` o módulos planos.
- En plantillas de `RegExp` con backticks escribir `\\s\\S` (sin doble barra se pierden). Al editar con Python vía heredoc se rompen `\n` y `\s`: usar archivos `.py` en el scratchpad o la herramienta Edit.
- SVG renderizado en servidor y cliente: redondear coordenadas (`q()` a 2 decimales) para evitar avisos de hidratación.
- SGP4: importar **siempre** de `@/lib/sgp4` (el índice de satellite.js carga WASM y cuelga el build).
- MapLibre: el contenedor necesita altura del flujo (fuerza `position:relative`; nada de `absolute inset-0` en el div del mapa). Worker copiado a `/public/maplibre` (postinstall) + `setWorkerUrl`.
- LL2 2.3.0: naves acopladas en `docking_location[].currently_docked.flight_vehicle_chaser.spacecraft`; Starman es `type: Non-Human` (se excluye de personas).
- Pausa de los globos: preferencia compartida en localStorage `net-globe-paused` (`GLOBE_PAUSED` en `orbit/earth.ts`); `orbitControls` la escucha.
- Zoom en SVG: componente `src/components/ui/ZoomPan.tsx` (Ctrl/⌘+rueda, pellizco, doble clic, arrastre; `children(k)` para tamaños constantes).
- En el panel del navegador de pruebas: rAF limitado si está oculto; esperar ~15 s tras editar antes de probar; dividir pruebas JS (<45 s). Con el panel oculto MapLibre/Three no dibujan y salen avisos `Transition was aborted` (no son fallos). Si ya hay un `next dev` del repo en :3000, usar ese (Next no permite dos).
- WebGL: en cada `dispose` llamar `renderer.forceContextLoss()` + liberar geometrías/materiales (`disposeScene` en `orbit/earth.ts`); si no, cada visita suma un contexto.
- Globos: la rueda sola desplaza la página; zoom con Ctrl/⌘ + rueda (`GlobeHint`); en táctil `pan-y` (un dedo horizontal gira, dos dedos zoom).
- Filtros con URL (`ExploreFilters`, `UrlFilters`, `SatExplorer`): el estado sigue a la URL en render (`seenQ`) y `set()` parte de `window.location.search`, no del `sp` capturado.
- Barra lateral contraída: `<html data-sb="c">` lo fija un script en `<head>` antes del primer pintado; variante Tailwind `sb-collapsed:`.
- Sync: cada petición a LL2 se registra en la BD **antes** de enviarse (atómico) y renueva el candado con dueño (`{owner, at}`, TTL 15 min); 429 → `ll2_blocked_until`. Fallos de APIs externas: `cacheLife` corto (expire ≥ 300 s para no romper el prerender).
- Python en Windows: escribir con `newline="
"` (si no, deja CRLF).
- Cuenta regresiva: HR = solo días/horas con «≈»; fechas sin hora (DAY, MON…) siempre en UTC.

## 3. Estética y criterios del usuario
Grafito cálido (`#0B0B0A`, acento `#FF5B1F`), **sin azul/morado "de IA"**. Todo adaptable a cualquier pantalla, nada cortado. Transiciones fluidas, sensación premium; optimizar sin empeorar la experiencia. Scroll nativo sin bloqueos ni animaciones con retraso. Datos lo más en tiempo real posible dentro de los límites. Respuestas breves y ahorro de tokens.

## 4. Pendientes
- [ ] **Usuario:** rotar contraseña de Neon y el secreto de OpenSky (quedaron en el chat). Las variables de OpenSky ya no se usan (módulo retirado); se pueden borrar de Vercel.
- [ ] Cron programado de GitHub Actions que no se dispara solo (cubierto por autosync + cron diario de Vercel).
- [ ] Revisar `/astronautas` y `/naves` cuando lleguen sus catálogos (diseño ya preparado: récords, explorador, modelos).
- [ ] Ideas no hechas: PostHog/Sentry, clave MapTiler (satélite), i18n inglés, QA a11y completa.
- [ ] Documento de investigación de las autoras: verificar citas sospechosas (Johnson 2023, Pérez-González & Ramírez 2021, Newman 2022, Restrepo & Gómez 2023, Agrawal & Gupta 2022), cambiar "telemetría en tiempo real", mencionar MapLibre, distinguir latencia del servidor y frescura del dato.
- Tráfico aéreo: **retirado** por decisión del usuario (código en el commit `83b4f3c`: OpenSky global + adsb.lol por zona).

## 5. Bitácora
- 2026-09-30 — F0–F10: plan, BD + sync, interfaz completa, landing 3D, satélites, despliegue en Vercel.
- 2026-10-01 — Programas, Reutilización, categoría Universo, catálogos LL2, SATCAT, traducciones genéricas, Wikipedia ES; correcciones de scroll bloqueado, "Ver en el mapa", pausa de globos.
- 2026-10-01 — Auditoría completa (UI, mapa/3D, datos/sync, páginas) y correcciones: 404/errores en español, ids inválidos → 404, paleta sin azules, atribución completa también en móvil, fugas WebGL, búsqueda global en portal, sync robusto (candado con dueño, registro atómico, 429), índices nuevos aplicados en Neon, radar de asteroides clicable; Población orbital y Más allá en 3D.
- 2026-10-01 — Pulido: APOD desde RSS oficial, radar de asteroides a escala con comparación de tamaño, pasos de satélites dibujados en la cúpula, sondas con foto y escalera de distancias, corte a escala de la población orbital, mapa de zonas de aterrizaje, cronología de programas, "ahora en el espacio" y naves acopladas; zoom en las tres visualizaciones.
