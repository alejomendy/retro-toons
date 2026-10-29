// Ajustes del addon LACartoons para el plan gratis de Render (512 MB de memoria).
// Se aplica al construir la imagen (ver Dockerfile). Si el código del addon cambia y algún
// reemplazo deja de aplicar, el build falla a propósito en vez de seguir sin el ajuste.
const fs = require("fs");

const file = process.argv[2];
let src = fs.readFileSync(file, "utf8");

function replaceOnce(from, to, what) {
  const count = src.split(from).length - 1;
  if (count !== 1) throw new Error(`patch-low-memory: "${what}" aparece ${count} veces (se esperaba 1)`);
  src = src.replace(from, to);
}

// 1) Chromium con banderas de bajo consumo de memoria.
replaceOnce(
  "args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],",
  // Sin --single-process: con eso Chromium se cae al cerrar una página y el addon queda con un navegador muerto.
  "args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions', '--mute-audio', '--js-flags=--max-old-space-size=128'],",
  "argumentos de chromium.launch",
);

// Si Chromium se cerró (falta de memoria, crash), se vuelve a abrir en vez de reutilizar el muerto.
replaceOnce("    if (!browserInstance) {", "    if (!browserInstance || !browserInstance.isConnected()) {", "chequeo de browserInstance");

// 2) Una sola página de Chromium a la vez: varios episodios pedidos juntos hacían que el
//    proceso pasara los 512 MB y Render lo reiniciara. Las demás búsquedas esperan su turno.
replaceOnce("async function extractGenericStreams(pageUrl, referer, isRpmvid = false) {", "async function extractGenericStreamsRaw(pageUrl, referer, isRpmvid = false) {", "extractGenericStreams");
src += `

// --- Agregado por RetroToons (addon/patch-low-memory.js) ---
let __genericQueue = Promise.resolve();
function extractGenericStreams(...args) {
    const run = __genericQueue.then(() => extractGenericStreamsRaw(...args));
    __genericQueue = run.catch(() => {});
    return run;
}
`;

fs.writeFileSync(file, src);
console.log("patch-low-memory: aplicado a", file);
