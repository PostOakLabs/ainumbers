// coverage.mjs — floor coverage + freshness ratchet, extracted from
// repo/scripts/check-fv-floor-coverage.mjs. Pure logic preserved verbatim (classifyFloor,
// evaluateCoverage, findProvenanceViolations); only the disk-walking (deriveLiveKernels) is
// parameterized so this package can point at any repo's node/kernel layout, not just this one's.

const HEADER_RE = /kernel_digest_at_authoring:\s*(sha256:[0-9a-f]{64})/i;

// Given a kernel's current source text, its floor file's text (or null if absent), and the
// canonical sourceDigest() function, return one of missing/stale/floored + a human reason.
export async function classifyFloor(kernelSource, floorSource, sourceDigestFn) {
  if (floorSource == null) return { state: 'missing', reason: 'no floor file' };
  const m = floorSource.match(HEADER_RE);
  if (!m) return { state: 'missing', reason: 'floor file present but has no valid "kernel_digest_at_authoring: sha256:…" header — presence alone is not a binding claim' };
  const recorded = m[1];
  const current = await sourceDigestFn(kernelSource);
  if (recorded !== current) {
    return { state: 'stale', reason: `floor file's recorded digest (${recorded}) does not match the kernel as it stands now (${current})`, recorded, current };
  }
  return { state: 'floored', reason: 'floor file digest matches current kernel source', recorded, current };
}

// Pure over an already-derived live-kernel list + injectable file readers.
export async function evaluateCoverage(liveKernels, readKernelSource, readFloorSource, sourceDigestFn) {
  const results = [];
  for (const k of liveKernels) {
    const kernelSource = readKernelSource(k.tool_id);
    const floorSource = readFloorSource(k.tool_id);
    const classified = await classifyFloor(kernelSource, floorSource, sourceDigestFn);
    results.push({ ...k, ...classified });
  }
  const unfloored = results.filter((r) => r.state === 'missing' || r.state === 'stale');
  const floored = results.filter((r) => r.state === 'floored');
  return { results, unfloored, floored, total: results.length };
}

// REGRESSION = was known+floored (or not-yet-live) at last pin, now unfloored — always fails.
// NEW-UNFLOORED = never seen before, ships unfloored — always fails (no legitimate deferral,
// unlike a §18-style gpu:false carve-out; every new node must ship its floor in the same push).
export function findProvenanceViolations(currentUnfloored, oldBaseline) {
  const unflooredBefore = new Set(oldBaseline?.unfloored_nodes ?? []);
  const knownBefore = new Set(oldBaseline?.known_live_nodes ?? []);
  const regressions = [];
  const newUnfloored = [];
  for (const r of currentUnfloored) {
    if (unflooredBefore.has(r.name)) continue;
    if (knownBefore.has(r.name)) regressions.push(r);
    else newUnfloored.push(r);
  }
  return { regressions, newUnfloored };
}
