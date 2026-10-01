---
name: stablecoin-reserve-proof
description: "Pre-check a GENIUS Act reserve attestation, stress it under MiCA, and verify the reserve proof chain. Use when the task is a crypto-asset or on-chain question. Written for the issuers audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "stablecoin-reserve-proof"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "8770e0e5aba5"
---

# Stablecoin reserve proof

Pre-check a GENIUS Act reserve attestation, stress it under MiCA, and verify the reserve proof chain.

## Prompt

Take one reserve attestation from PDF-trust to proof chain.

1. Call precheck_reserve_attestation on a synthetic GENIUS-style attestation (reserve assets, liabilities, custodian lines). Record every flagged field.
2. Call simulate_stablecoin_reserve with a redemption scenario (10% and 30% same-day redemption). Record the survival verdict per scenario.
3. Call calculate_mica_own_funds for the same balance sheet under the MiCA own-funds classes. Record the required amount.
4. Run the chain reserve-proof-verification with run_chain, which composes the checks into one verdict. Record execution_hash.
5. Break-test: inflate one reserve line by 1 unit, re-run the chain, confirm the verdict changes. Revert.
6. anchor_stamp the passing chain's execution_hash on OpenTimestamps.
7. Give me the ledger link for the chain receipt and the OTS receipt.
8. Write the note for the issuer's CFO: what the proof covers (arithmetic and disclosure consistency, not the existence of bank balances), the stress results, and both receipts.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.
GPU note: the simulate_stablecoin_reserve tool computes in your browser, so the MCP endpoint returns no execution_hash; export the Policy Mandate artifact the page produces and pass that full artifact to verify_execution_hash as claimed_hash.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
