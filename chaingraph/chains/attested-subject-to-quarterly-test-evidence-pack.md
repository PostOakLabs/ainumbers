# Attested Subject to Quarterly Test Evidence Pack

AI governance and assurance, not lifecycle-bound. Identifier handoff (subject_hash), not a computed value passed on. Two-step quarterly evidence flow: bind a sealed artifact into a subject identifier, then compose the quarter's testing-evidence pack tied to that subject. Stop condition before step 2: proceed only when step 1 reports binding_complete true and producer_pinned true; a pack built over an incomplete or unpinned subject is labelled not attested.

- Page: https://ainumbers.co/chaingraph/chains/attested-subject-to-quarterly-test-evidence-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/attested-subject-to-quarterly-test-evidence-pack.md

## Workflow chain: Attested Subject to Quarterly Test Evidence Pack

AI governance and assurance, not lifecycle-bound. Identifier handoff (subject_hash), not a computed value passed on. Two-step quarterly evidence flow: bind a sealed artifact into a subject identifier, then compose the quarter's testing-evidence pack tied to that subject. Stop condition before step 2: proceed only when step 1 reports binding_complete true and producer_pinned true; a pack built over an incomplete or unpinned subject is labelled not attested.

Domain: AI Governance

### Steps

1. art-502-bind-attested-subject
   Then the step 2 run takes the step 1 output's subject_hash unchanged by name and wraps the pack's per-test receipt digests into an evidence bundle tied to that subject
2. art-378-quarterly-test-evidence-composer
   Then, only when the stop condition holds (binding_complete true and producer_pinned true), the quarterly testing-evidence pack is composed and its per-test receipt digests are wrapped into an evidence bundle tied to subject_hash; otherwise the pack is labelled not attested
3. cry-05-agent-action-audit-trail-aggregator
   Then the session receipts are aggregated into the session receipt

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Is this quarter's test evidence tied to one identified, pinned subject, or is the pack not attested?
Run the AINumbers MCP tool `run_chain` with {"chain":"attested-subject-to-quarterly-test-evidence-pack"} and read `art-378-quarterly-test-evidence-composer.ha_evidence_bundle`.
Re-run with `inputs` for `art-378-quarterly-test-evidence-composer`, reusing the values that result echoed, with `subject_hash` changed so remove subject_hash and watch ha_evidence_bundle go null. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/attested-subject-to-quarterly-test-evidence-pack.html
