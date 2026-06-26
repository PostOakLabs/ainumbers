// empty-input-finite.test.mjs — every registered kernel must produce a CANONICALIZABLE
// output_payload when called with empty input {}.
//
// WHY: a kernel that does `notional * x` with a missing `notional` returns NaN in
// output_payload. NaN is not valid I-JSON (RFC 8785 §3.2.2.3), so execution_hash
// canonicalization throws — and over /mcp that surfaces as a runtime "Kernel compute error:
// Non-finite number (NaN) is not valid I-JSON" (this is exactly what 505 hit on the live
// post-deploy hash-sweep, 2026-06-26). golden-parity + kernel-contract only ever run the kernel
// with its FIXTURE input (which is well-populated), so neither catches it. This gate runs the
// degenerate empty-input path deterministically for ALL kernels, before deploy.
//
// CONTRACT: compute({}) must EITHER
//   (a) throw cleanly (a graceful "missing input" rejection — the Worker turns this into an
//       isError tool result, which is acceptable), OR
//   (b) return an output_payload that canonicalizes (no NaN/Infinity/unsafe-int).
// A kernel that SILENTLY returns non-finite output (neither throws nor produces finite output)
// is the bug — that fails here.
//
// Usage:  node empty-input-finite.test.mjs

import { KERNELS } from './index.mjs';
import { canonicalPreimage } from './_hash.mjs';

let fails = 0, ok = 0, threw = 0;
for (const [tool_id, k] of Object.entries(KERNELS)) {
  if (!k || typeof k.compute !== 'function') continue;
  let out;
  try {
    out = k.compute({});
  } catch {
    // compute({}) threw → graceful rejection of empty input. Acceptable (no silent NaN).
    threw++;
    continue;
  }
  try {
    // Throws on NaN/Infinity/unsafe-int anywhere in the returned output_payload.
    canonicalPreimage({}, (out && out.output_payload) ?? {});
    ok++;
  } catch (e) {
    console.error(`X ${tool_id}: empty-input output is NOT canonicalizable — ${String(e.message).slice(0, 120)}`);
    fails++;
  }
}

const total = ok + threw + fails;
if (fails) {
  console.error(`\nempty-input-finite FAILED — ${fails}/${total} kernel(s) silently return non-finite output on empty input. Guard the offending numeric coercion (e.g. Number.isFinite(Number(x)) ? Number(x) : 0).`);
  process.exit(1);
}
console.log(`empty-input-finite OK — ${total} kernels (${ok} finite output, ${threw} reject empty input cleanly), 0 emit non-finite.`);
