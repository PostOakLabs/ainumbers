---
name: consumer-loan-compliance
description: "Does this loan pass QM points-and-fees, HPML escrow, Reg Z thresholds and MLA coverage? Use when the task is a banking or payment-operations question. Written for the lenders audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "consumer-loan-compliance"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Consumer loan compliance

Does this loan pass QM points-and-fees, HPML escrow, Reg Z thresholds and MLA coverage?

## Prompt

Run one synthetic loan through the four consumer checks and bind the results.

1. Write the loan facts once (amount, rate, points, fees, lien status, borrower type). Synthetic data only.
2. Call lookup_reg_z_thresholds for the current applicable thresholds. Record them; everything downstream cites these.
3. Call check_qm_points_and_fees. Record pass/fail with the points-and-fees computation shown.
4. Call test_hpml_escrow. Record whether the escrow requirement attaches and why.
5. Call classify_mla_charge_inclusion over the fee list. Record which charges count as MLA fees and the final coverage verdict.
6. Call compute_deterministic_amortization_schedule. Record the APR-consistent schedule digest.
7. Boundary test: move the loan amount 1 dollar past a threshold from step 2 and confirm the affected verdicts flip. Revert.
8. build_session_receipt over the five checks; give me the ledger link.
9. Write the note for the loan file: each verdict with its cited threshold, the boundary test, and the ledger link. State that these are deterministic rule checks against your inputs, not a compliance opinion.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
