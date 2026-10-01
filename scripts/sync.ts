// Sincronizador por línea de comandos / GitHub Actions:
//   npm run sync                  · npm run sync -- --reset-cursors
import { runSync } from "../src/lib/sync/run";

// Plazo de 7 min: el job de GitHub se corta a los 12 y una ejecución cortada a mitad deja el candado puesto
runSync({ source: "cli", resetCursors: process.argv.includes("--reset-cursors"), deadlineMs: 7 * 60_000 })
  .then((r) => {
    if (r.skipped) console.log(`omitido: ${r.skipped}`);
    process.exit(r.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
