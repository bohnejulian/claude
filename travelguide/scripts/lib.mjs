// Gemeinsame Helfer für die Datenskripte: liest die Browser-Datendateien ein.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const root = fileURLToPath(new URL('..', import.meta.url));

export function loadBrowserData(relPath) {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(root + relPath, 'utf8'), ctx);
  return ctx.window;
}

export function writeBrowserData(relPath, globalName, data, comment) {
  const body = `// ${comment}\n// Automatisch erzeugt, nicht von Hand bearbeiten.\nwindow.${globalName} = ${JSON.stringify(data, null, 1)};\n`;
  writeFileSync(root + relPath, body);
}
