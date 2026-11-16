# __vintages__

Use declarations for the dated-value table `data/vintages.json`. Kernels are read only: no kernel byte changes.

- `<kernel>.uses.json`: `{ kernel, uses: [{ fact, vintage, anchor, role }] }`. `role` is `computes` (the literal drives output; compared to the table) or `mentions` (prose only; the anchor must resolve, the value is not compared yet).
- `anchor`: `{ "regex": "<one capture group>" }` read from the kernel text (a `computes` regex must match exactly once), or `{ "export": "NAME", "pointer": "/a/0" }` for an exported constant.
- `check-vintages.mjs`: gates V1 (literal equals table), V2 (kernels sharing a fact and vintage agree, message names both) and V4 (source digest resolves in `chaingraph/standard/clause-snapshot-registry.json`). `--self-test` runs planted red and green controls.

Entries in the table are added, never rewritten; a correction is a new entry with `corrects`. A new year's value never edits a kernel through this directory.
