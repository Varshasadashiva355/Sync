import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'data'), { recursive: true });

await Promise.all([
  cp(path.join(root, 'index.html'), path.join(output, 'index.html')),
  cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true }),
  cp(path.join(root, 'shared'), path.join(output, 'shared'), { recursive: true }),
  cp(path.join(root, 'data', 'seed.json'), path.join(output, 'data', 'seed.json')),
]);

console.log('Static preview built in dist/');