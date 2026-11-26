# __vintages__

Use declarations for the dated-value table `data/vintages.json`. Kernels are read only: no kernel byte changes.

- `<kernel>.uses.json`: `{ kernel, uses: [{ fact, vintage, anchor, role }] }`. `role` is `computes` (the literal drives output; compared to the table) or `mentions` (prose only; the anchor must resolve, the value is not compared yet).
- `anchor`: `{ "regex": "<one capture group>" }` read from the kernel text (a `computes` regex must match exactly once), or `{ "export": "NAME", "pointer": "/a/0" }` for an exported constant.
- `check-vintages.mjs`: gates V1 (literal equals table), V2 (kernels sharing a fact and vintage agree, message names both), V3 (a kernel with a year literal on a numeric assignment line and no declaration; advisory through `v3-baseline.json`, hard red for a qualifier the baseline does not list and for a baseline entry that no longer qualifies: the baseline only shrinks), V4 (source digest resolves in `chaingraph/standard/clause-snapshot-registry.json`) and V6 (a `mentions` declaration whose anchored value differs from the table, listed on stdout, advisory). `--self-test` runs planted red and green controls.
- `v3-baseline.json`: the V3 advisory list of kernels still awaiting declarations. It only shrinks: a kernel leaves when a coverage row declares it. Never add to it to silence a red; a new qualifier must be declared by the row that adds it.

Entries in the table are added, never rewritten; a correction is a new entry with `corrects`. A new year's value never edits a kernel through this directory.
