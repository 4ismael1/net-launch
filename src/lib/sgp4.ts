// Solo las funciones SGP4 de satellite.js (JS puro). Su índice principal también carga un
// build WebAssembly con dependencias de Node (node:worker_threads) que rompe el bundle del navegador.
export { json2satrec } from "../../node_modules/satellite.js/dist/io.js";
export { propagate, gstime } from "../../node_modules/satellite.js/dist/propagation.js";
export {
  eciToGeodetic, eciToEcf, geodeticToEcf, ecfToLookAngles, degreesLat, degreesLong, degreesToRadians, radiansToDegrees,
} from "../../node_modules/satellite.js/dist/transforms.js";
export { jday } from "../../node_modules/satellite.js/dist/ext.js";
export { sunPos } from "../../node_modules/satellite.js/dist/sun.js";
export { shadowFraction } from "../../node_modules/satellite.js/dist/shadow.js";
export type { SatRec } from "../../node_modules/satellite.js/dist/propagation/SatRec.js";
