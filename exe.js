// Arrancador de Livalyst.exe (versión portable): el .exe lleva Node.js dentro y ejecuta el server.js que tiene al lado.
// Así, para actualizar la app basta con cambiar los archivos de la carpeta; el .exe solo cambia si cambia Node.js.
const fs = require('fs'), path = require('path'), { createRequire } = require('module');
const dir = path.dirname(process.execPath), server = path.join(dir, 'server.js');
process.chdir(dir);

// Mismos argumentos que con `node server.js …` (el .exe a veces repite su propia ruta como primer argumento)
const args = process.argv.slice(process.argv[1] === process.execPath ? 2 : 1);

// `--check archivo`: comprobar que un server.js nuevo no tiene errores antes de reiniciar con él
if (args[0] === '--check') {
  try { new (require('vm').Script)(fs.readFileSync(args[1], 'utf8'), { filename: args[1] }); process.exit(0); }
  catch { process.exit(1); }
}

// Sin ventana negra no hay consola: todo lo que Livalyst escribe va a livalyst.log, junto al .exe
let log = null;
try { log = fs.openSync(path.join(dir, 'livalyst.log'), process.env.CU_RESTART ? 'a' : 'w'); } catch {}
for (const s of [process.stdout, process.stderr]) s.write = (chunk, enc, cb) => {
  try { if (log !== null) fs.writeSync(log, String(chunk)); } catch {}
  (typeof enc === 'function' ? enc : cb)?.();
  return true;
};

// Si ya había un Livalyst abierto, se le pide que se cierre para que se abra este (como hacía «Iniciar Livalyst»)
async function closeOld() {
  const ask = (method, ms) => fetch('http://localhost:8787/' + (method === 'POST' ? 'quit' : 'config'), { method, signal: AbortSignal.timeout(ms) }).then(r => r.ok, () => false);
  if (process.env.CU_RESTART || !(await ask('GET', 800))) return;
  args.push('--reiniciado');
  await ask('POST', 1500);
  for (let i = 0; i < 12 && (await ask('GET', 500)); i++) await new Promise(r => setTimeout(r, 250));
}

closeOld().then(() => {
  process.argv = [process.execPath, server, ...args];
  createRequire(server)(server);
});
