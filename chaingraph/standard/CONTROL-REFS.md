# Node control references: the `control_refs` field (CTRLREF-1)

Status: optional, additive profile of the OpenChainGraph standard. It lives in its own document so the
normative `SPEC.md` bytes, and with them the `spec_digest` every `registry/kernel/` record resolves to,
are unchanged. Nothing here changes `execution_hash`, `required[]` or `chaingraph_version`.

A catalog node MAY carry `control_refs`, an array of `{framework, id}` objects naming the control
identifiers in an external framework that the node's output is meant to be cited against by a GRC
consumer. The `framework` enum is the one the OCG Execution Receipt predicate v0.2 uses for its
`controlRefs` member (`nist-800-53r5`, `aiuc-1`, `nist-ai-rmf`, `soc2-tsc`, `iso27001-2022`).

**CTRLREF-1.1 Ids only.** `id` carries the control identifier and nothing else. An entry MUST NOT carry
a control title, description, or any control text, and the object admits no other member. The
standard never reproduces framework text.

**CTRLREF-1.2 Id shape.** A `nist-800-53r5` id matches `^[A-Z]{2}-\d+(\(\d+\))?$` and MUST exist in the
published NIST SP 800-53 Rev. 5 catalog (a control `AC-6`, or an enhancement `AC-6(1)`). An `aiuc-1` id
matches `^AIUC-[A-F]-\d{2}$`. The other frameworks accept any non-empty `id` in this version.

**CTRLREF-1.3 What a tag is.** A pointer for a human reviewer. It does not claim that any control is
satisfied, certified, or accepted by anyone. The field is hash-excluded node metadata: no
`execution_hash`, `required[]`, or `chaingraph_version` change, and absence is fully conformant.

**CTRLREF-1.4 Conformance.** `schema-validate.mjs` checks the member's shape (the framework enum and
the ids-only object; its draft-2020-12 subset validator does not evaluate the schema's conditional id
patterns); `check-control-refs.mjs` checks every node's entries against those patterns, checks each NIST
id against a committed id list extracted from the CC0 OSCAL catalog
(`nist-800-53r5-control-ids.json`), and rejects any entry carrying title or text.

Run: `node chaingraph/standard/check-control-refs.mjs` (and `--self-test`).

Promotion into `SPEC.md` (with its §15 gate row and the spec page section) is a later decision that
moves `spec_digest` and needs the registry records re-resolved in the same change.
