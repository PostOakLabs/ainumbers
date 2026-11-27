## What changed and why

<!-- Replace this comment with one sentence: what this pull request changes and why it is needed. -->

## Proof

Paste the evidence next to each item. An item that does not apply to this pull request can be answered with N/A and a one line reason.

### Every pull request

- [ ] Full preflight: paste the exact `TOTAL <seconds>s` summary line printed by a full `node scripts/preflight.mjs` run (not `--quick`), with this pull request's head sha beside it.

### Kernel or node changes

- [ ] Execution hash: paste the `execution_hash` produced through the shared `chaingraph/kernels/_hash.mjs` path, with the golden-parity output line beside it.
- [ ] Receipt: paste the receipt path for the proof run. The receipt file must be part of this pull request's diff.

### Chain changes

- [ ] Chain execute: paste the verdict line printed by `node scripts/check-webmcp-chain-execute.mjs`.

### Workflow changes

- [ ] Zizmor: paste the link to the Zizmor check run for this pull request (the CI result of the zizmor static analysis check).

## Authorship

Choose one:

- [ ] Agent
- [ ] Human
- [ ] Mixed
