// check-kernel-determinism.test.mjs — RED/GREEN controls for the import-specifier
// rule (KERNEL-IMPORT-SPECIFIER-LINT-1) inside check-kernel-determinism.mjs.
//
// Per SO #34's "verify a checker by mutation, not by reading it", same discipline as
// this file's precedent check-guest-builtin-safety.test.mjs:
//   RED   (a) a synthetic kernel with a static `import { x } from './_detmath.mjs'`
//             is flagged (the §18 guest loader resolves nothing but './_hash.mjs').
//   RED   (b) a synthetic kernel with a dynamic import() that is NOT on the allowlist
//             is flagged — even the exact './_proof.mjs' spec, in the wrong file.
//   GREEN (c) the load-bearing negative control: every static form naming
//             './_hash.mjs', a commented-out dynamic-import doc mention (the
//             art-336:76 shape) and a `.import(` property access produce ZERO
//             violations — a gate that reds good kernels gets disabled within the hour.
//   GREEN (d) the REAL tree: 0 violations of any kind, and the set of dynamic
//             (file, spec) pairs found equals exactly the allowlist "imports"
//             entries (3: art-106, art-108, art-110), each carrying a reason.
//   GREEN (e) the gate itself, run exactly as preflight GATES names it: exit 0 with
//             the count line (modules scanned, 0 violations, 3 allowlisted).
//
// Controls (a)-(c) exercise the exported scanImports() on in-memory line arrays — no
// fixture files, no filesystem writes. Control (d) re-scans chaingraph/kernels with the
// same exported function. Control (e) spawns the gate as a child process.

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { scanImports } from './check-kernel-determinism.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KERNELS_DIR = resolve(HERE, '..', 'chaingraph', 'kernels');
const ALLOWLIST_PATH = resolve(HERE, 'kernel-determinism-allowlist.json');

// ── RED (a): static import from anything other than './_hash.mjs' ────────────
{
  const { violations } = scanImports('zzz-synthetic.kernel.mjs', [
    "import { sha256 } from './_hash.mjs';",   // legit — must NOT be flagged
    "import { x } from './_detmath.mjs';",     // RED: not './_hash.mjs'
  ]);
  assert.equal(violations.length, 1,
    `RED (a): exactly one violation expected, got ${JSON.stringify(violations)}`);
  assert.equal(violations[0].kind, 'static import-from');
  assert.equal(violations[0].spec, './_detmath.mjs');
  assert.equal(violations[0].line, 2);
  console.log('✓ RED (a): static import of ./_detmath.mjs flagged; the legit ./_hash.mjs line is not');
}

// ── RED (b): dynamic import() whose (file, spec) pair is not allowlisted ─────
{
  const { violations, dynamicImports } = scanImports('art-999-synthetic.kernel.mjs', [
    "import { sha256 } from './_hash.mjs';",
    "  const { sign } = await import('./_proof.mjs');", // art-106's spec, wrong file
  ]);
  assert.equal(violations.length, 1,
    `RED (b): exactly one violation expected, got ${JSON.stringify(violations)}`);
  assert.equal(violations[0].kind, 'dynamic import()');
  assert.equal(violations[0].spec, './_proof.mjs');
  assert.deepEqual(dynamicImports, ['./_proof.mjs']);
  console.log('✓ RED (b): dynamic import(\'./_proof.mjs\') in a non-allowlisted file flagged');
}

// ── GREEN (c): load-bearing negative control — clean kernel, zero violations ──
{
  const { violations } = scanImports('zzz-clean.kernel.mjs', [
    "import { sha256, sha512Hmac } from './_hash.mjs';",
    "import * as hash from './_hash.mjs';",
    "import './_hash.mjs';",
    "export { sha256 } from './_hash.mjs';",
    "// MEASURED (art-336:76 shape): a dynamic `import('./_hash.mjs')` doc mention stays inert",
    "const loader = { import: (s) => s }; loader.import('./x.mjs'); // property access, not import()",
  ]);
  assert.equal(violations.length, 0,
    `GREEN (c): zero violations expected on a clean kernel, got ${JSON.stringify(violations)}`);
  console.log('✓ GREEN (c): all ./_hash.mjs static forms, a commented mention and a .import( property access stay unflagged');
}

// ── GREEN (d): the real tree — 0 violations, dynamic imports == allowlist ────
{
  const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
  const entries = allowlist.imports?.entries ?? [];
  assert.equal(entries.length, 3, 'GREEN (d) precondition: allowlist "imports" lists exactly 3 entries');
  for (const e of entries) {
    assert.ok(e.file && e.spec && e.reason, `GREEN (d): allowlist entry ${e.file} → ${e.spec} carries a reason`);
  }
  const expected = new Set(entries.map(e => `${e.file}\u0000${e.spec}`));

  let filesScanned = 0;
  const dynamicFound = new Set();
  for (const fname of readdirSync(KERNELS_DIR).sort()) {
    if (!fname.endsWith('.kernel.mjs')) continue;
    filesScanned++;
    const { violations, dynamicImports } =
      scanImports(fname, readFileSync(resolve(KERNELS_DIR, fname), 'utf8').split('\n'));
    assert.equal(violations.length, 0,
      `GREEN (d): real tree must have 0 violations, ${fname} produced ${JSON.stringify(violations)}`);
    for (const spec of dynamicImports) dynamicFound.add(`${fname}\u0000${spec}`);
  }
  assert.deepEqual([...dynamicFound].sort(), [...expected].sort(),
    `GREEN (d): dynamic imports in the tree (${[...dynamicFound].size}) must be exactly the 3 allowlisted pairs`);
  console.log(`✓ GREEN (d): real tree — ${filesScanned} modules scanned, 0 violations, ${dynamicFound.size} dynamic imports, all 3 allowlisted (art-106/108/110)`);
}

// ── GREEN (e): the gate itself, as preflight runs it ─────────────────────────
{
  const r = spawnSync(process.execPath, [resolve(HERE, 'check-kernel-determinism.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, `GREEN (e): gate must exit 0 — stderr: ${r.stderr}`);
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  assert.match(out,
    /kernel-determinism (?:clean|PASSED with \d+ baseline warning\(s\)) — \d+ modules scanned, 0 violations, 0 import-specifier violations, 3 allowlisted dynamic import/,
    `GREEN (e): count line missing — stdout: ${out}`);
  console.log('✓ GREEN (e): gate exits 0 with the count line (modules scanned, 0 violations, 3 allowlisted)');
}

console.log('\n✓ check-kernel-determinism.test.mjs — all controls green.');
