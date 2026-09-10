#!/usr/bin/env node
/**
 * scripts/check-infra-registry.selftest.mjs — the GATE-SELFTEST-META-1 paired
 * red-proof entry for scripts/check-infra-registry.mjs (INFRA-PAGE-1).
 * Delegates to the gate's own --selftest mode (RED-then-GREEN fixture proof:
 * missing-meta RED, out-of-enum RED, stale-entry RED, GREEN after the fix) so
 * the pairing meta-gate can see the paired filename it requires; one
 * implementation, no second copy of the fixtures.
 */
import process from 'node:process';
if (!process.argv.includes('--selftest')) process.argv.push('--selftest');
await import('./check-infra-registry.mjs');
