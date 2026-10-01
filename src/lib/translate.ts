// Traducción automática EN→ES con Gemini (capa gratuita). Solo la usa el sincronizador.
// Los resultados se guardan en la BD: cada texto se traduce una sola vez.

const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
const SYSTEM =
  "Eres un traductor técnico aeroespacial. Traduce cada texto del inglés al español neutro, con precisión y sin añadir información. " +
  "NO traduzcas nombres propios: misiones, cohetes, naves, agencias, empresas, programas, bases y plataformas (p. ej. Falcon 9, Crew Dragon, Starlink, Commercial Crew Program, Cape Canaveral). " +
  'Devuelve exclusivamente JSON {"t": [..]} con las traducciones en el mismo orden y la misma cantidad que la entrada.';

/** `timeoutMs`: el sincronizador lo acorta para no pasarse del plazo de la función (máx. 60 s). */
export async function translateBatch(texts: string[], timeoutMs = 60_000): Promise<string[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !texts.length || timeoutMs < 1000) return null;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(Math.min(timeoutMs, 60_000)),
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ parts: [{ text: JSON.stringify(texts) }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
  });
  if (res.status === 429) throw new Error("Gemini: límite de la capa gratuita alcanzado");
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const out = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}")?.t;
  // Si el modelo no respeta el formato, descartamos el lote entero (nunca guardamos algo desalineado).
  return Array.isArray(out) && out.length === texts.length && out.every((x) => typeof x === "string" && x.trim()) ? out : null;
}
