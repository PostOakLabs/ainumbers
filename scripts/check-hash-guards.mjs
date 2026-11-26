#!/usr/bin/env node
/**
 * scripts/check-hash-guards.mjs — standalone hash-guard lint (HASH-GUARD-TEMPLATE-LINT-1).
 *
 * Kernel side only. A kernel PASSES only if its source carries the never-throw hash
 * guard in one of two shapes:
 *   (a) a bigint branch that records a hash refusal: a `typeof x === 'bigint'` check
 *       (findHashRefusal-style walk, the merged shape in 790-event-position-limit-check
 *       and the 797 family) AND a recorded refusal (`hash_refusal` assignment or a
 *       REFUSED_INPUT_* reason literal); or
 *   (b) a try/catch around the executionHash() call whose catch records such a refusal.
 * A kernel with neither throws 'Do not know how to serialize a BigInt' out of
 * buildArtifact on unhashable input.
 *
 * Usage:
 *   node scripts/check-hash-guards.mjs <slug>...
 *     <slug>  a kernel number ('790' or 'art-790') or a full kernel stem
 *             ('790-event-position-limit-check')
 *
 * Exit 0: every named kernel carries the guard.
 * Exit 1: at least one kernel is missing the guard (each failure line names the kernel
 *         and the missing element).
 * Exit 2: bad usage, or a slug that resolves to no kernel file exactly once.
 *
 * STANDALONE BY DESIGN (HASH-GUARD-TEMPLATE-LINT-1): not wired into preflight, CI,
 * or any baseline. Node stdlib only.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const KERNELS = resolve(HERE, '..', 'chaingraph', 'kernels');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/check-hash-guards.mjs <slug>...   (e.g. 790 art-592 art-106)');
  process.exit(2);
}

const stems = readdirSync(KERNELS).filter((f) => f.endsWith('.kernel.mjs')).sort();

// Resolve one CLI slug to exactly one kernel stem, or null with a reason.
function resolveSlug(arg) {
  const num = arg.match(/^(?:art-)?(\d+)$/);
  if (num) {
    const re = new RegExp('^(?:art-)?' + num[1] + '-.+\\.kernel\\.mjs$');
    const hits = stems.filter((s) => re.test(s));
    return hits.length === 1 ? { stem: hits[0] } : { error: 'resolves to ' + hits.length + ' kernels (' + (hits.join(', ') || 'none') + ')' };
  }
  const bare = arg.replace(/\.kernel\.mjs$/, '');
  const hits = stems.filter((s) => s.replace(/\.kernel\.mjs$/, '') === bare);
  return hits.length === 1 ? { stem: hits[0] } : { error: 'resolves to ' + hits.length + ' kernels (' + (hits.join(', ') || 'none') + ')' };
}

// The static guard test: returns null when the kernel passes, else a missing-elements string.
function missingGuard(src) {
  const hasBigintBranch = /typeof\s+[A-Za-z_$][\w$]*\s*===?\s*['"]bigint['"]/.test(src);
  const recordsRefusal = /hash_refusal/.test(src) || /REFUSED_INPUT_(?:UNSAFE_NUMBER|HASH_LIMIT)/.test(src);
  const guardedWalk = hasBigintBranch && recordsRefusal;

  // Shape (b): a try block whose body calls executionHash, followed by a catch that
  // records a refusal (bounded window; the accepted shape is small and local).
  let guardedTryCatch = false;
  const tryRe = /try\s*\{[^{}]*?executionHash\s*\([\s\S]{0,200}?\}\s*catch\s*\([^)]*\)\s*\{([\s\S]{0,400}?)\}/g;
  let m;
  while ((m = tryRe.exec(src)) !== null) {
    if (/(?:hash_refusal|REFUSED_INPUT_)/.test(m[1])) { guardedTryCatch = true; break; }
  }

  if (guardedWalk || guardedTryCatch) return null;
  const parts = [];
  if (!hasBigintBranch) parts.push('no bigint guard branch');
  if (!recordsRefusal) parts.push('no recorded hash refusal (hash_refusal / REFUSED_INPUT_*)');
  if (hasBigintBranch && recordsRefusal) parts.push('guard present but not reachable in one accepted shape');
  return parts.join(' and ');
}

let pass = 0;
const failures = [];
for (const arg of args) {
  const r = resolveSlug(arg);
  if (r.error) {
    console.error('UNRESOLVABLE ' + arg + ': ' + r.error);
    process.exit(2);
  }
  const src = readFileSync(resolve(KERNELS, r.stem), 'utf8');
  const missing = missingGuard(src);
  if (missing === null) {
    console.log('PASS ' + arg + ' (' + r.stem + ')');
    pass++;
  } else {
    console.log('FAIL ' + arg + ' (' + r.stem + '): ' + missing);
    failures.push(arg);
  }
}

console.log('hash-guard lint: ' + pass + ' pass, ' + failures.length + ' fail');
process.exit(failures.length > 0 ? 1 : 0);
