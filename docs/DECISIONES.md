# DECISIONES

| # | Decisión | Motivo |
|---|---|---|
| D1 | BD propia + sync programado (GitHub Actions cada 15 min) | LL2 limita a 15 req/h; el frontend no puede depender de él |
| D2 | Sync incremental con `last_updated__gte` | 1 petición detecta todos los cambios de fecha/estado |
| D3 | Neon Postgres + Drizzle | Gratis, SQL para estadísticas y búsqueda con trigramas |
| D4 | OpenFreeMap en lugar de los tiles públicos de OSM | Sin límites ni key, estilo Dark, respeta la infraestructura de OSM |
| D5 | MapLibre en lugar de Leaflet | WebGL, clustering nativo, proyección globo |
| D6 | Nominatim descartado (por ahora) | La búsqueda interna cubre bases y países; se evita el riesgo de sus políticas |
| D7 | Sin API de SpaceX ni APIs de NASA/ESA | Sesgo y abandono; LL2 ya las agrega |
| D8 | Spaceflight News API como extra opcional | Misma organización que LL2, vinculada por ID de lanzamiento |
| D9 | Landing 3D solo con datos reales, en la fase F10 | Prioridad al producto funcional; la estética no inventa datos |
| D10 | Cuenta regresiva según `net_precision` | Evita falsa precisión en fechas aproximadas |
