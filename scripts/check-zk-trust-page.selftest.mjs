#!/usr/bin/env node
/**
 * scripts/check-zk-trust-page.selftest.mjs — the GATE-SELFTEST-META-1 paired
 * red-proof entry for scripts/check-zk-trust-page.mjs (ZK-TRUST-STAGES-GATE-1).
 * Runs the gate's own --selftest mode (RED drift, RED missing sentinel, RED
 * banned wording, RED un-negated claim, --fix heal + idempotency, and the
 * repeated-key controls from PR-2888-DERIVED-PAGE-READ-1) so the pairing
 * meta-gate sees the sibling filename it requires; one implementation, no
 * second copy of the fixtures.
 *
 * PR-2888-SELFTEST-PAIR-1: SPAWNED, not imported. The gate runs main() only
 * when it is the entry module, so an `await import()` delegate would run zero
 * controls and pass vacuously. The gate reads `--selftest` (no hyphen), so the
 * meta-gate's `--self-test` GATES-entry form would have run the real check.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const gate = join(dirname(fileURLToPath(import.meta.url)), 'check-zk-trust-page.mjs');
const r = spawnSync(process.execPath, [gate, '--selftest'], { stdio: 'inherit' });
if (r.error) { console.error(`check-zk-trust-page.selftest: could not run the gate: ${r.error.message}`); process.exit(2); }
process.exit(r.status ?? 1);
