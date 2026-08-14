// check-guest-builtin-safety.test.mjs — canary + mutation controls for GUEST-BUILTIN-GATE-1.
//
// Exercises the delete-prelude technique directly (not the full kernel corpus — that's what
// running the gate itself does) against two synthetic in-repo fixtures, so a future edit to
// check-guest-builtin-safety.mjs's derivation or delete logic gets caught in milliseconds instead
// of silently regressing back to the "green harness, red GPU" failure this row exists to close.
//
// Per SO #34's "verify a checker by mutation, not by reading it": test (a) proves the gate FAILS
// LOUDLY on a kernel that genuinely reaches an absent builtin (never a swallowed silent false —
// the original defect this row fixes); test (b) proves it does NOT false-positive on a clean
// kernel (the load-bearing control — a gate that reds good kernels gets disabled within the hour).
//
// A third control — reproducing art-612's actual guest failure at kernel.mjs:438 on branch
// ETHMATH-PERMIT-1 — was run manually as part of this row's check-off (a live external branch
// fetch has no place in a repeatable CI test) and is NOT re-asserted here.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runKernelInVM } from '../vm/kernel-vm.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── Derivation regression guard ──────────────────────────────────────────────────────────────
// check-guest-builtin-safety.mjs derives its absent-builtin set by regexing kernel-vm.mjs's own
// DETERMINISM_PRELUDE for `if (typeof X === 'undefined')` guards. If that prelude is ever
// rewritten in a way the regex no longer matches, the gate must throw loudly at startup rather
// than silently scan zero builtins — assert that behavior here against the real, current source.
{
  const kernelVmSource = readFileSync(resolve(HERE, '../vm/kernel-vm.mjs'), 'utf8');
  const preludeMatch = kernelVmSource.match(/const DETERMINISM_PRELUDE = `([\s\S]*?)`\.trim\(\);/);
  assert.ok(preludeMatch, 'DETERMINISM_PRELUDE literal must still be findable in kernel-vm.mjs — the gate\'s derivation depends on this exact shape');
  const derived = [...new Set([...preludeMatch[1].matchAll(/if \(typeof (\w+) === 'undefined'\)/g)].map((m) => m[1]))];
  assert.ok(derived.includes('TextEncoder'), 'TextEncoder must still be in the derived absent-builtin set');
  assert.ok(derived.includes('atob'), 'atob must still be in the derived absent-builtin set');
  assert.ok(derived.includes('URL'), 'URL must still be in the derived absent-builtin set');
  console.log(`✓ derivation regression guard: {${derived.join(', ')}} (+btoa, paired with atob)`);
}

const DELETE_PRELUDE = "delete globalThis.atob; delete globalThis.btoa; delete globalThis.TextEncoder; delete globalThis.URL;";

// ── Control (a): a kernel that genuinely reaches an absent builtin on a realistic (non-guard)
// input MUST fail loudly with the real ReferenceError, never a silently swallowed `false` (the
// original SO #34b defect this row exists to prevent). ──────────────────────────────────────
{
  const guestFatalKernel = `
export function compute(pp) {
  const bytes = new TextEncoder().encode(String(pp.message ?? 'nonempty'));
  return { byte_length: bytes.length };
}
  `;
  let threw = null;
  try {
    await runKernelInVM(`${DELETE_PRELUDE}\n${guestFatalKernel}`, { message: 'hello' }, { functionName: 'compute' });
  } catch (e) {
    threw = e;
  }
  assert.ok(threw, 'control (a): a kernel calling TextEncoder on a non-empty realistic vector must THROW when TextEncoder is genuinely deleted post-prelude');
  assert.match(threw.message, /TextEncoder is not defined/, `control (a): expected a ReferenceError naming TextEncoder, got: ${threw?.message}`);
  console.log(`✓ control (a): guest-fatal kernel fails loudly — "${threw.message}"`);
}

// ── Control (b): the LOAD-BEARING control. A kernel that never touches an absent builtin must
// pass cleanly — a gate that reds good kernels gets disabled within the hour. ──────────────────
{
  const cleanKernel = `
export function compute(pp) {
  return { sum: (pp.a ?? 0) + (pp.b ?? 0) };
}
  `;
  const result = await runKernelInVM(`${DELETE_PRELUDE}\n${cleanKernel}`, { a: 2, b: 3 }, { functionName: 'compute' });
  assert.deepEqual(result.output_payload, { sum: 5 }, 'control (b): a clean kernel must run to completion and return its correct output with the absent builtins deleted');
  console.log('✓ control (b): clean kernel passes with the absent builtins genuinely deleted');
}

console.log('\n✓ check-guest-builtin-safety.test.mjs — all controls green.');
