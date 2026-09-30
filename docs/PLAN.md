# PLAN DEL PROYECTO — Monitor Mundial de Lanzamientos Espaciales

> Nombre provisional: **NET** ("No Earlier Than", término oficial de fechas de lanzamiento). Cambiable.
> Entregable funcional de una investigación académica: centralizar información aeroespacial dispersa con APIs públicas + WebGIS.

---

## 1. Análisis del prompt original

**Fortalezas:** prioridades claras, honestidad de datos (no inventar telemetría), separación LANZAMIENTO vs OBJETO EN ÓRBITA, conciencia de límites de APIs, objetivo académico medible.

**Huecos / ambigüedades detectadas y cómo se resuelven:**

| Hueco | Resolución |
|---|---|
| LL2 gratis = **15 peticiones/hora** (verificado). El histórico completo (~7.500 lanzamientos) no cabe en llamadas en vivo. | Base de datos propia + sincronizador programado. El frontend **nunca** llama a LL2. |
| No define cómo detectar cambios de fecha/estado sin gastar peticiones. | Sync incremental con `last_updated__gte=<última sync>`: 1 petición trae todo lo que cambió. |
| Precisión de fechas: muchas fechas son "mes" o "trimestre", no minuto. Una cuenta regresiva al segundo sería falsa. | Usar `net_precision` de LL2: cuenta regresiva solo si la precisión es minuto/hora; si no, "NET Octubre 2026". |
| Zonas horarias no mencionadas. | Mostrar hora local del usuario + UTC + hora local de la base. |
| "Landing page" no está definida; el prompt pide "información protagonista, sin efectos innecesarios". | Landing 3D con scroll **construida con datos reales** (ver §6). Se hace después del núcleo funcional. |
| Búsqueda de "Falcon 9 → cohete" requiere páginas de vehículos, que no están en la navegación. | Se añaden páginas ligeras de **Vehículos**. |
| CelesTrak necesita el designador internacional (COSPAR). | LL2 2.3.0 trae `launch_designator` (verificado) → consulta `gp.php?INTDES=yyyy-nnn`. |
| Pruebas de usabilidad posteriores sin herramientas. | Kit de evaluación: página de metodología, métricas Lighthouse y cuestionario SUS externo. |
| OSM tiles públicos no deben usarse intensivamente. | **OpenFreeMap** (gratis, sin API key, sin límites, estilo Dark, datos OSM). Atribución obligatoria. |

## 2. Mejoras propuestas (añadidas al alcance)

1. **Índice de visibilidad / concentración** (clave para la tesis): qué % de lanzamientos concentran los 3 operadores principales, y sección **"Menos conocidos"** con un operador destacado cada día. Demuestra con datos el problema de la investigación.
2. **Transparencia de fuentes** en cada vista: "Fuente: Launch Library 2 · actualizado hace 12 min". Cumple la atribución y da rigor académico.
3. **Noticias relacionadas por misión** con **Spaceflight News API** (de The Space Devs, gratis, activa v4.33, vinculada por ID de lanzamiento). Centraliza más información sin integraciones raras. Prioridad baja.
4. **Añadir al calendario (.ics)** por lanzamiento. Reduce la necesidad de visitar otros sitios.
5. **Glosario de estados** (GO, TBD, TBC, HOLD…) con tooltips para usuarios novatos.
6. **Filtros en la URL** (enlaces compartibles, p. ej. `/lanzamientos?op=spacex&pais=US&dias=30`).
7. **Búsqueda global tipo paleta** (Ctrl+K) sobre lanzamientos, operadores, vehículos y bases.
8. **Página "Metodología y fuentes"**: fuentes, frecuencia de actualización, limitaciones y qué NO muestra la plataforma (telemetría). Sirve directamente para el documento de la investigación.
9. **Accesibilidad**: `prefers-reduced-motion`, contraste AA y teclado.

**Descartado a propósito:** API de SpaceX (sesgo y abandono), Nominatim (la búsqueda interna ya cubre bases y países; se reevalúa solo si hace falta), APIs de NASA/ESA (LL2 ya las agrega), telemetría o trayectorias simuladas.

## 3. Fuentes de datos (verificadas 30-09-2026)

| Fuente | Uso | Límite / condiciones | Estrategia |
|---|---|---|---|
| **Launch Library 2 v2.3.0** | Núcleo: lanzamientos, agencias, bases, pads, vehículos, streams | 15 req/h sin key. `lldev.thespacedevs.com` sin límite pero con datos reducidos/antiguos | Dev → `lldev`. Prod → sync programado a BD. Atribución a The Space Devs |
| **MapTiler** (datos OSM) | Mapa principal: estilo oscuro vectorial, **vista satélite** y **relieve 3D** para ver cada plataforma desde arriba | Gratis 100k tiles/mes, API key gratuita | Atribución "© MapTiler © OpenStreetMap contributors" |
| **OpenFreeMap** | Respaldo automático si MapTiler falla | Gratis, sin key, sin límites | Estilo Dark |
| **Open-Meteo** | Clima de la plataforma | Gratis no comercial, ~10.000 req/día, sin key | Llamada del servidor con caché de 30 min. Pronóstico hasta 16 días antes del NET |
| **CelesTrak GP** | Objetos catalogados por lanzamiento | Datos cada 2 h. >50 errores en 2 h = bloqueo de IP. 100 MB/día | Solo en servidor, caché ≥ 6 h en BD, cero reintentos agresivos |
| **Spaceflight News API v4** | Noticias vinculadas (opcional) | Gratis, sin key | Caché de 1 h |

## 4. Arquitectura

```
GitHub Actions (cron cada 15 min)
   └─ scripts/sync  →  LL2 (≤ 12 req/h, deja margen)
          ├─ incremental: last_updated__gte  (cambios de fecha/estado)
          ├─ backfill histórico con el presupuesto sobrante (1957→hoy, ~75 págs)
          └─ catálogos (agencias, bases, pads, vehículos) semanal
        ↓ upsert normalizado
   Neon Postgres (gratis)  ←── Drizzle ORM
        ↓
   Next.js (App Router, Vercel Hobby)
     ├─ Server Components leen la BD, ISR + revalidación on-demand tras cada sync
     ├─ /api/weather/[pad]   → Open-Meteo (caché 30 min)
     ├─ /api/orbit/[launch]  → CelesTrak (caché en BD 6 h)
     └─ Cliente: cuenta regresiva local, mapa, 3D
```

**Resiliencia:** si LL2 cae, la web sigue sirviendo la BD y muestra "última actualización hace X". Si el clima o CelesTrak fallan, se oculta solo ese módulo. Los clientes HTTP llevan timeout, backoff exponencial, respeto de `429`/`Retry-After` y registro de la sync en la tabla `sync_runs`.

## 5. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Framework | **Next.js + TypeScript** | SSR/ISR, SEO en páginas de misión, rutas API integradas, gratis en Vercel |
| Estilos | **Tailwind CSS v4** + componentes propios (Radix primitives) | Control total del look "centro de control", sin estética genérica |
| BD | **Neon Postgres** + **Drizzle** | Gratis, SQL real para estadísticas, `pg_trgm` para búsqueda |
| Sync | **GitHub Actions cron** | El cron de Vercel Hobby es solo diario; Actions es gratis |
| Mapa | **MapLibre GL JS v5** + MapTiler (satélite + relieve 3D) | Clustering nativo, WebGL, **proyección globo**, zoom hasta ver el pad real |
| 3D landing | **Three.js** + React Three Fiber + drei | Globo con datos reales |
| 3D extra | **@react-three/postprocessing** (bloom), shaders propios de atmósfera | Nivel visual de sitios premiados |
| Scroll/animación | **GSAP** (ScrollTrigger, SplitText, todos los plugins premium, ahora gratis) + **Lenis** + Motion | Estándar de sitios premiados |
| Gráficas | **Apache ECharts** (tema propio) | Más potente y animado: mapa de calor por calendario, series largas, transiciones |
| Analítica UX | **PostHog** (gratis 1M eventos) | Grabación de sesiones y mapas de calor = **evidencia para las pruebas de usabilidad** |
| Errores | **Sentry** (gratis) | Detectar fallos antes de la presentación |
| Órbitas | **satellite.js** (SGP4) | Cálculo desde TLE/OMM, etiquetado como "posición calculada" |
| i18n | **next-intl** (es por defecto, en preparado) | Nombres oficiales sin traducir |
| Búsqueda UI | **cmdk** | Paleta Ctrl+K |
| Tests | Vitest (normalizadores y sync) | Donde se rompe de verdad |

## 6. Dirección estética

**Concepto:** "Sala de operaciones + revista científica". Oscuro, preciso y denso en datos. Sin gradientes morados ni esquinas exageradas.

- **Paleta:** fondo `#07090D`, superficies `#0E1218` / `#141A22`, bordes de 1 px `#1F2833`, texto `#E6EAF0` / `#8A96A6`. **Un solo acento: naranja ignición `#FF5B1F`.**
- **Estados:** GO verde `#2BD67B` · TBC ámbar `#F5B83D` · TBD gris `#6B7788` · HOLD naranja · IN FLIGHT cian `#38C6F4` (pulso) · SUCCESS verde apagado · FAILURE rojo `#FF4D4F` · PARTIAL morado apagado.
- **Tipografía:** *Geist* para la interfaz y *Geist Mono* / *JetBrains Mono* para cifras, coordenadas, T− y UTC (números tabulares).
- **Detalles:** radios de 4–6 px, retícula visible sutil, etiquetas tipo HUD (`LAT 28.5623° N`), microanimaciones de 150–250 ms y contadores que "ruedan".

### Landing con scroll (ruta `/`, el dashboard queda debajo o en `/panel`)

Todo lo que se ve son datos reales de la BD:
1. **Hero:** globo 3D (textura NASA Black Marble, dominio público) con las bases reales como puntos que brillan según su actividad. Encima, la tarjeta **NEXT LAUNCH** con la T− real y botones. Cumple el requisito "ver el próximo lanzamiento al abrir".
2. **"La información está dispersa":** al hacer scroll, decenas de fragmentos (agencias, webs, redes) flotan en 3D y **convergen en un único panel**. Es la metáfora visual de la tesis.
3. **Recorrido por el planeta:** la cámara gira a regiones (Florida, Guayana Francesa, Baikonur, Jiuquan, Sriharikota, Tanegashima, Mahia…) con conteos reales, destacando organizaciones menos conocidas.
4. **Cifras:** contadores animados (lanzamientos del año, países, operadores) y el índice de concentración.
5. **CTA:** transición del globo al mapa MapLibre → "Explorar el planeta".

Reglas: se carga en diferido, versión ligera en móviles o GPU débil, estático con `prefers-reduced-motion`, botón "Ir directo a la plataforma". Nunca se dibujan trayectorias de cohetes simuladas.

## 7. Páginas

`/` landing (portada narrativa, solo la primera vez; botón "Entrar") · `/panel` **dashboard = corazón de la app** (vista de centro de control con barra superior de NEXT LAUNCH, mapa, lista de próximos, métricas, actividad reciente) · `/mapa` · `/lanzamientos` (explorador próximos/pasados) · `/lanzamientos/[slug]` · `/organizaciones` + `[id]` · `/bases` + `[id]` (base → pads) · `/vehiculos/[id]` · `/estadisticas` · `/orbita/[launch]` · `/metodologia` · búsqueda global Ctrl+K.

## 8. Modelo de datos (resumen)

`launches` (id LL2, slug, name, status, net, net_precision, window_start/end, provider_id, rocket_config_id, pad_id, mission, orbit, launch_designator, image, raw jsonb, last_updated) · `agencies` · `locations` · `pads` (lat/lng) · `rocket_configs` · `vid_urls` / `info_urls` · `orbital_objects` (norad, intdes, omm jsonb, fetched_at) · `sync_runs`. Guardar `raw jsonb` evita volver a pedir datos si luego se necesita otro campo.

## 9. Fases (una sesión de chat por fase para ahorrar tokens)

| Fase | Contenido | Prioridad del prompt |
|---|---|---|
| **F0** | Estructura, docs y git ✅ | — |
| **F1** | Next.js + BD + cliente LL2 + normalizador + sync + GitHub Action + backfill | P1, P2 |
| **F2** | Sistema de diseño, layout y navegación, dashboard (próximo lanzamiento, T−, estadísticas rápidas) | P4 |
| **F3** | Mapa mundial: clusters, popups, panel de base, filtros, globo | P3 |
| **F4** | Página de misión: estados, mini-mapa, streams (embed/WATCH LIVE, oficial vs externo), .ics | P4 |
| **F5** | Explorador con filtros combinables en URL + búsqueda global | P5 |
| **F6** | Organizaciones, bases, vehículos, histórico, "menos conocidos" | P6 |
| **F7** | Estadísticas + índice de concentración | P7 |
| **F8** | Clima Open-Meteo | P8 |
| **F9** | CelesTrak + vista orbital 3D (SGP4) | P9 |
| **F10** | Landing 3D con scroll | Estética |
| **F11** | QA responsive, a11y, rendimiento, metodología, noticias SNAPI, kit de usabilidad | Cierre |

## 10. Requisitos previos (el usuario)

- Cuentas gratis: **GitHub**, **Vercel**, **Neon** (F1) · **MapTiler** (F3) · **PostHog** y **Sentry** (F11).
- Node.js 20+ instalado.
- Opcional: API key de LL2 vía Patreon para acelerar el backfill (no es necesaria).

## 11. Ampliación (2026-09-30): estructura de la app y más fuentes

**Estructura de la app (tipo Linear/Vercel):** menú lateral fijo (colapsable a iconos; en móvil, barra inferior), barra superior con búsqueda Ctrl+K y el chip de NEXT LAUNCH siempre visible, y un mismo layout en todas las secciones. Menú: Panel · Mapa · Lanzamientos · Eventos · En el espacio · Organizaciones · Bases · Vehículos · Estadísticas · Noticias · Metodología.

**Fuentes añadidas:**
| Fuente | Aporta | Cuenta |
|---|---|---|
| LL2 (otros endpoints) | Eventos (acoplamientos, EVAs), astronautas, estaciones espaciales, naves, expediciones → sección "En el espacio ahora" | No (mismo sync) |
| Wikipedia REST (es) | Resúmenes en **español** de organizaciones, cohetes y bases (caché en BD) | No |
| DeepL API Free | Traducción al español de las descripciones de misiones de LL2 (500k caracteres/mes, caché en BD, etiqueta "traducción automática") | Sí (pide tarjeta solo para verificar) |
| NOAA SWPC | Clima espacial (índice Kp, fulguraciones) como contexto | No |
| NASA APOD (api.nasa.gov) | Imagen astronómica del día en el panel | Sí (key gratis) |
| CelesTrak + satellite.js | Posición **calculada** de la ISS y Tiangong en el mapa | No |
