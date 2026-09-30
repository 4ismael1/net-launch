// Sincronizador por línea de comandos / GitHub Actions:
//   npm run sync                  · npm run sync -- --reset-cursors
import { runSync } from "../src/lib/sync/run";

runSync({ source: "cli", resetCursors: process.argv.includes("--reset-cursors") })
  .then((r) => {
    if (r.skipped) console.log(`omitido: ${r.skipped}`);
    process.exit(r.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
