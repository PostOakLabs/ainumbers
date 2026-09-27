---
name: payments-day-end-to-end
description: "One payments day: validate the pain.001, parse the camt.053, reconcile, predict fails, price CSDR penalties, seal the evidence. Use when you are walking a role through a full scenario and want the evidence captured at each step. Written for the payments infrastructure operator audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "payments-day-end-to-end"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp https://anchor.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# Payments day, end to end

One payments day: validate the pain.001, parse the camt.053, reconcile, predict fails, price CSDR penalties, seal the evidence.

## Prompt

Run one payments day end to end and leave evidence a regulator and an auditor can both check.

1. Validate a synthetic pain.001 with pain001_validate; fix the reported defects in the input and re-run until clean. Record the hash.
2. Parse a synthetic camt.053 with camt053_parse, then recon_match the statement lines against the pain.001 batch. Report matched / unmatched with reasons.
3. Run verify_address_migration_batch on the beneficiary addresses to check ISO 20022 structured-address readiness.
4. Predict fails with predict_settlement_fail on today's trades, price the CSDR penalties with calculate_csdr_penalty, and model buy-in exposure with model_buy_in_exposure. Then run run_t1_readiness_diagnostic and list the top three gaps.
5. Call build_evidence_pack over every hash from steps 1-4 with the kernel_digests from chaingraph.json.
6. On helmd: catalog.search "2052a", workflow.dry_run the daily classify pack, artifact.verify it, and note that the export needs a human consent ticket; do not request one.
7. Anchor the evidence pack digest with anchor_stamp on OpenTimestamps. Give me the ledger link for the pack and a one-page day-end note: counts, exceptions, penalties, T+1 gaps, and how each number is re-verified without contacting us.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.
GPU note: the verify_address_migration_batch tool computes in your browser, so the MCP endpoint returns no execution_hash; export the Policy Mandate artifact the page produces and pass that full artifact to verify_execution_hash as claimed_hash.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
- https://anchor.ainumbers.co/mcp
