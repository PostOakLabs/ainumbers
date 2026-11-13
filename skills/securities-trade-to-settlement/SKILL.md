---
name: securities-trade-to-settlement
description: "Lint the sese.023 instruction and sese.024 advice, classify T+1 cut-off breaches, score the fail probability, and seal the run as a receipt. Use when the task is a banking or payment-operations question. Written for the post-trade operations audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "securities-trade-to-settlement"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e1ce005ada9"
---

# A securities trade from instruction to settlement

Lint the sese.023 instruction and sese.024 advice, classify T+1 cut-off breaches, score the fail probability, and seal the run as a receipt.

## Prompt

Follow one securities trade from instruction to settlement and leave a receipt any reviewer can re-check.

1. Lint a synthetic sese.023 settlement instruction with lint_securities_settlement_message (schema conformance, mandatory fields, ISIN checks); fix the reported defects in the input and re-run until clean. Record the execution hash.
2. Lint the matching sese.024 status advice the same way and confirm the status progression the instruction and the advice describe together.
3. Classify the post-trade timings with classify_t1_posttrade_timing on declared trade dates and market cut-offs. List every step that breaches its cut-off under the T+1 regime and the margin each step has left.
4. Score the trade's fail probability with predict_settlement_fail from anonymized configuration features (SSI match status, instrument liquidity tier, counterparty fail-history band, deadline proximity). Report the score and the drivers behind it.
5. Seal the run with build_session_receipt over the hashes from steps 1 to 4, then call verify_execution_hash (send each receipt's execution_hash as claimed_hash) so every number re-verifies from the receipt alone.
Deliverable: lint verdicts, the cut-off breach list, the fail score with its drivers, the ledger link, and one sentence on what the receipts prove (the declared synthetic inputs were validated, classified, and scored as given) and what they do not prove (no real client data, no settlement outcome, no compliance determination).
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
