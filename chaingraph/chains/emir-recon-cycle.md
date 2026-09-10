# EMIR Inter-TR Reconciliation Cycle

Two-step daily cycle over the trade repository's own ISO 20022 reconciliation response and the firm's submitted state. Step 1 independently reproduces the reconciliation verdict per field against a policy-supplied field and tolerance table with a suppression list, emits agreement or disagreement with the repository, and builds a break set keyed for stable diffing across cycles. Step 2 ages that break set against the prior sealed break set, splitting newly opened, persisting and newly closed breaks and running the escalation clock. Step 1 is gated review_required for cycle sign-off, with the reporting-operations owner as reviewer. Step 2 is gated escalate once any break passes its policy ageing limit. Each break disposition is recorded as a separate annotation record naming the acting identity, so the accountability trail is per break rather than per cycle, and the prior cycle's sealed break set is referenced by subject_hash rather than mutated in place.

- Page: https://ainumbers.co/chaingraph/chains/emir-recon-cycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/emir-recon-cycle.md

## Workflow chain: EMIR Inter-TR Reconciliation Cycle

Two-step daily cycle over the trade repository's own ISO 20022 reconciliation response and the firm's submitted state. Step 1 independently reproduces the reconciliation verdict per field against a policy-supplied field and tolerance table with a suppression list, emits agreement or disagreement with the repository, and builds a break set keyed for stable diffing across cycles. Step 2 ages that break set against the prior sealed break set, splitting newly opened, persisting and newly closed breaks and running the escalation clock. Step 1 is gated review_required for cycle sign-off, with the reporting-operations owner as reviewer. Step 2 is gated escalate once any break passes its policy ageing limit. Each break disposition is recorded as a separate annotation record naming the acting identity, so the accountability trail is per break rather than per cycle, and the prior cycle's sealed break set is referenced by subject_hash rather than mutated in place.

Domain: EMIR

### Steps

1. art-482-emir-recon-adjudicator
   Per-field agreement or disagreement with the repository plus a stably keyed break set feed the ageing and escalation-clock stage
2. art-483-emir-break-ageing
   Ageing buckets, recurrence counts, the newly-opened / persisting / newly-closed split and escalation-clock status close the cycle bundle. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
