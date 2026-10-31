# Parametric Index to Trigger Payout Check

Three-stage check over a parametric trigger. Step 1 aggregates hash-pinned measurement receipts into an index value under a caller-declared metric, aggregation, and window, and stops the chain when there is insufficient evidence. Step 2 evaluates that index value against the caller-supplied threshold, coverage amount, and parametric limit, and returns trigger hit, trigger fraction, and payout amount. Step 3 aggregates the run's execution hashes into a session receipt. art-251 triggers on the high side only: index_value at or above threshold, so low-side perils such as drought cannot be modeled with this chain. Step 2's inputs contain no metric name, and unit equality is never checked, so the caller must use the same unit for the index and the threshold. Headline example: summed rainfall in millimetres over a window, against a threshold in millimetres. The verdict is an arithmetic finding under the policy terms supplied, not a settlement decision, and not actuarial, legal, or regulatory advice.

- Page: https://ainumbers.co/chaingraph/chains/parametric-index-to-trigger-payout-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/parametric-index-to-trigger-payout-check.md

## Workflow chain: Parametric Index to Trigger Payout Check

Three-stage check over a parametric trigger. Step 1 aggregates hash-pinned measurement receipts into an index value under a caller-declared metric, aggregation, and window, and stops the chain when there is insufficient evidence. Step 2 evaluates that index value against the caller-supplied threshold, coverage amount, and parametric limit, and returns trigger hit, trigger fraction, and payout amount. Step 3 aggregates the run's execution hashes into a session receipt. art-251 triggers on the high side only: index_value at or above threshold, so low-side perils such as drought cannot be modeled with this chain. Step 2's inputs contain no metric name, and unit equality is never checked, so the caller must use the same unit for the index and the threshold. Headline example: summed rainfall in millimetres over a window, against a threshold in millimetres. The verdict is an arithmetic finding under the policy terms supplied, not a settlement decision, and not actuarial, legal, or regulatory advice.

Domain: Insurance & Reinsurance

### Steps

1. art-309-parametric-index-deriver
   Aggregates hash-pinned receipts into output_payload.index_value under a caller-declared metric, aggregation, and window. When output_payload.insufficient_evidence is true, the chain ends here and the payout run is not started, because a 0 index must never reach the payout. Stage 1 of 3.
2. art-251-compute-parametric-trigger-payout
   Evaluates the cited output_payload.index_value as index_value against the caller-supplied threshold, coverage_amount, and parametric_limit, and returns trigger_hit, trigger_fraction, and payout_amount. art-251 triggers on the high side only: index_value at or above threshold. This run's inputs contain no metric name, and unit equality is never checked, so the caller must use the same unit for the index and the threshold. Stage 2 of 3.
3. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage).

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our summed rainfall receipts total 180 mm against a 150 mm threshold. What payout does the trigger give?
Run the AINumbers MCP tool `run_chain` with {"chain":"parametric-index-to-trigger-payout-check"} and read `art-251-compute-parametric-trigger-payout.payout_amount`.
Re-run with `inputs` for `art-251-compute-parametric-trigger-payout`, reusing the values that result echoed, with `threshold` changed so raise the threshold above the summed index so the trigger no longer hits. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/parametric-index-to-trigger-payout-check.html
