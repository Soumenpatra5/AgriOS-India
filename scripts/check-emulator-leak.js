import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns to detect prohibited emulator references
const PROHIBITED = [
  'FIREBASE_AUTH_EMULATOR_HOST',
  'VITE_USE_AUTH_EMULATOR=true',
  '127.0.0.1:9099',
  'localhost:9099',
  'demo-agrios'
];

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(res);
    } else {
      yield res;
    }
  }
}

async function main() {
  const root = path.resolve(__dirname, '..', 'dist');
  try {
    await fs.access(root);
  } catch (_) {
    // No dist directory – nothing to scan
    process.exit(0);
  }

  let found = false;
  for await (const filePath of walk(root)) {
    const content = await fs.readFile(filePath, 'utf8');
    for (const pat of PROHIBITED) {
      if (content.includes(pat)) {
        console.error(`Prohibited string "${pat}" found in ${filePath}`);
        found = true;
      }
    }
  }
  process.exit(found ? 1 : 0);
}

main();
