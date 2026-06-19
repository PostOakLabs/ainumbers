# OpenChainGraph Conformance Suite

## What conformance means

Every OpenChainGraph tool implements a **pure decision kernel** (`kernels/*.kernel.mjs`) that:
1. Takes `policy_parameters` as input
2. Produces a deterministic `output_payload`
3. Commits to a verifiable `execution_hash` = SHA-256 of sorted-key JSON of `{policy_parameters, output_payload}`

A tool **conforms** when its kernel produces the same `output_payload` for a given set of `policy_parameters`, and the resulting `execution_hash` matches the pinned value in its fixture.

This is the same hash that appears in every emitted artifact (`execution_hash` field), which any third party can recompute independently using `chaingraph/verify.html` or the canonicalization logic in `kernels/_hash.mjs`.

## How to run

```bash
# From the repo root:
node chaingraph/conformance/run.mjs

# First-time: pin hashes into fixture files after verifying output is correct
node chaingraph/conformance/run.mjs --update
```

Exit code 0 = all checks pass. Exit code 1 = one or more failures (details printed to stderr).

## Subset checking

The runner uses a **subset check** for `expected_output_payload`: every key you include in the fixture must match the kernel output, but keys you omit are ignored. This lets you exclude fields whose values are runtime-dependent (e.g. `criteria_detail[].value` in art-09 uses `Number.toLocaleString()` and varies by system locale). The hash check (`--update`) always pins the full hash computed on the pinning machine's locale, so the hash is locale-pinned at first-run time.

## How to add a new fixture

1. Create `vectors/<tool_id>.fixture.json` with this shape:

```json
{
  "tool_id": "art-XX-your-tool-name",
  "mcp_name": "your_mcp_tool_name",
  "policy_parameters": {
    // realistic inputs that exercise the happy path
  },
  "expected_output_payload": {
    // trace kernel.compute(policy_parameters) by hand, or run once and copy
  },
  "expected_execution_hash": "sha256:COMPUTE_ON_FIRST_RUN"
}
```

2. Run `node run.mjs` to verify your `expected_output_payload` matches kernel output.
3. Run `node run.mjs --update` to pin the hash.
4. Commit both the fixture and the updated hash.

The kernel must be registered in `kernels/index.mjs` (it will be if it was built through the standard workstream process).

## How an external tool can self-certify

If you are implementing a compatible tool outside the AINumbers suite:

1. Copy `kernels/_hash.mjs` (or inline its logic — it is pure WebCrypto, no dependencies).
2. Confirm your `canonicalPreimage(policy_parameters, output_payload)` produces the same string as the reference implementation for the shared test vectors above.
3. Run the fixtures against your kernel: your output must match `expected_output_payload` (key-sorted deep equal) and your hash must match the pinned `expected_execution_hash`.
4. Artifacts you emit can be verified at `https://ainumbers.co/chaingraph/verify.html`.

The OCG spec lives at `https://ainumbers.co/chaingraph/openchain-graph-spec.html`.
