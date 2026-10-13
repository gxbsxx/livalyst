// Fabrica Livalyst.exe: una copia de Node.js con exe.js dentro (Single Executable Application de Node).
// Uso: node build/make-exe.js <carpeta de salida>   — en Windows sale Livalyst.exe con icono y sin ventana negra.
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.resolve(process.argv[2] || path.join(root, 'dist')), win = process.platform === 'win32';
const exe = path.join(out, win ? 'Livalyst.exe' : 'Livalyst');
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: win });
fs.mkdirSync(out, { recursive: true });

const blob = path.join(out, 'sea.blob'), conf = path.join(out, 'sea-config.json');
fs.writeFileSync(conf, JSON.stringify({ main: path.join(root, 'exe.js'), output: blob, disableExperimentalSEAWarning: true }));
run(process.execPath, ['--experimental-sea-config', conf]);
fs.copyFileSync(process.execPath, exe);
if (win) run('npx', ['--yes', 'rcedit@4.0.1', exe, '--set-icon', path.join(__dirname, 'livalyst.ico'),
  '--set-version-string', 'ProductName', 'Livalyst', '--set-version-string', 'FileDescription', 'Livalyst']);
run('npx', ['--yes', 'postject@1.0.0-alpha.6', exe, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2']);

// Windows: marcar el .exe como programa de ventanas (subsistema 2) para que no abra una consola negra
if (win) {
  const b = fs.readFileSync(exe), pe = b.readUInt32LE(0x3c);
  if (b.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error('Livalyst.exe no parece un ejecutable de Windows');
  b.writeUInt16LE(2, pe + 4 + 20 + 68);
  fs.writeFileSync(exe, b);
}
fs.rmSync(blob); fs.rmSync(conf);
console.log('Hecho: ' + exe);
