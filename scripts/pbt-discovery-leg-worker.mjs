// pbt-discovery-leg-worker.mjs — FV-PBT-NASTIER-GEN-1 discovery-leg child process.
//
// WHY A SEPARATE PROCESS PER KERNEL: a nasty input (e.g. the 10,000-char string, or
// a null-proto object hitting an unguarded `for...in`) can make a kernel hang or
// blow the heap, not just throw cleanly. run-proptests.mjs --discovery-leg spawns
// this file once per kernel via spawnSync with a timeout, exactly like the
// committed-seed floor runner isolates each *.proptest.mjs -- so one kernel's
// pathological reaction to a nasty value is itself the finding, not a crash that
// takes the whole discovery run down with it.
//
// USAGE: node pbt-discovery-leg-worker.mjs <kernelId> <kernelPath> <fixturesPath> <seed>
// Prints one JSON line to stdout: { kernelId, findings: [...] } and always exits 0
// on a clean run (a caught throw inside the kernel is a FINDING, not a worker
// failure); a non-zero exit / timeout means the parent records "hang_or_crash".

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [, , kernelId, kernelPath, fixturesPath, seedArg] = process.argv;
const seed = Number(seedArg);

async function main() {
  const { mulberry32, runDiscoveryLeg } = await import(new URL('../chaingraph/kernels/__proptests__/_pbt-common.mjs', import.meta.url));
  const { compute } = await import(pathToFileURL(kernelPath).href);
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const baselineVec = (fixtures.vectors || []).find((v) => Object.keys(v.policy_parameters || {}).length > 0);
  const baseline = baselineVec ? baselineVec.policy_parameters : {};
  const rng = mulberry32(seed);
  const findings = Object.keys(baseline).length ? runDiscoveryLeg(kernelId, compute, baseline, rng) : [];
  process.stdout.write(JSON.stringify({ kernelId, findings }) + '\n');
  process.exit(0);
}

main().catch((err) => {
  process.stdout.write(JSON.stringify({ kernelId, findings: [], workerError: String((err && err.message) || err) }) + '\n');
  process.exit(0);
});
