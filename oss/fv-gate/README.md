# fv-gate

Property-test floor runner + coverage/freshness ratchet, extracted from ainumbers' internal CI gates
(`repo/scripts/run-proptests.mjs` + `repo/scripts/check-fv-floor-coverage.mjs`). Zero dependencies —
Node 18+ built-ins only.

Scope, stated plainly: this checks that a hand-written property-test file exists per unit and that its
recorded source digest matches the unit's current source. It is **not** a formal-verification proof —
internal engineering QC, no assurance-grade claim, no reliance framing.

## What it does

1. **Floor runner** — globs `*.proptest.mjs` in a directory, runs each as a child process, aggregates
   pass/fail by exit code. Empty directory = no-op PASS.
2. **Coverage + freshness ratchet** (optional — skipped automatically if no node-graph layout is found) —
   for each live unit, checks its floor file carries a `kernel_digest_at_authoring: sha256:<hex>` header
   matching the unit's current source digest. A ratchet baseline pins the unfloored count; it can only
   shrink. Two provenance checks (REGRESSION, NEW-UNFLOORED) always fail independent of the ceiling.
3. **Receipt + SARIF** — every run can emit a schema'd JSON receipt (`schema/receipt.schema.json`) and a
   SARIF 2.1.0 log for code-scanning integration. Neither existed in the two source scripts; both are
   additive, they do not change pass/fail semantics.

## Usage

```
node bin/fv-gate.mjs \
  --kernels-dir chaingraph/kernels \
  --proptests-dir chaingraph/kernels/__proptests__ \
  --meta-path chaingraph/chaingraph.meta.json \
  --nodes-dir chaingraph/graph/nodes \
  --baseline fv-gate-baseline.json \
  --out-json fv-gate-receipt.json \
  --out-sarif fv-gate.sarif
```

Flags: `--summary`, `--list-unfloored`, `--update-baseline`. Any repo without a node-graph layout can
run in proptests-only mode by pointing `--proptests-dir` at its floor-file directory and omitting
`--meta-path`/`--nodes-dir` (or leaving them unresolvable) — coverage/ratchet is skipped, only the
floor runner executes.

## GitHub Action

```yaml
- uses: ./oss/fv-gate
  with:
    kernels-dir: chaingraph/kernels
```

See `action.yml` for the full input list.

## Pre-commit hook

```
cp hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

## License

Apache-2.0.
