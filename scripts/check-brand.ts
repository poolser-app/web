import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('docs/brand/manifest.json', root), 'utf8'));
assert.match(manifest.revision, /^[0-9a-f]{40}$/);
for (const [path, item] of Object.entries(manifest.files) as [string, { sha256: string }][]) {
  const file = new URL(path, root);
  assert.ok(fileURLToPath(file).startsWith(fileURLToPath(root)));
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), item.sha256, `Brand copy changed: ${path}`);
}
console.log(`Verified ${Object.keys(manifest.files).length} brand copies at ${manifest.revision}`);
