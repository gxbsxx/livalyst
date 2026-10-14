// Ejecuta todas las pruebas: arranca Livalyst con datos limpios, pasa cada prueba y lo cierra.
// Uso: cd tests && npm install && node run.js   (lo mismo hace GitHub en cada cambio)
const { spawn, execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
fs.rmSync(path.join(root, 'datos'), { recursive: true, force: true }); // configuración nueva en cada pasada
const env = { ...process.env }; delete env.APPDATA;
const server = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: 'inherit' });
const TESTS = ['boot', 'check', 'topcheck', 'e2e', 'fx', 'tw', 'room', 'roomclear', 'wsroom', 'lottie', 'anims', 'live', 'pruebas']; // boot primero: necesita el servidor recién arrancado
let failed = [];
setTimeout(() => {
  for (const t of TESTS) {
    process.stdout.write(`\n▶ ${t}\n`);
    try { execFileSync(process.execPath, [t + '.js'], { cwd: __dirname, stdio: 'inherit', timeout: 180e3 }); }
    catch { failed.push(t); }
  }
  server.kill();
  console.log(failed.length ? `\n✖ Fallan: ${failed.join(', ')}` : '\n✔ Todas las pruebas pasan');
  process.exit(failed.length ? 1 : 0);
}, 3000);
