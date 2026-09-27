---
name: tokenized-treasury-dvp
description: "Validate a DTC-custodied tokenized treasury issuance and its Canton selective-disclosure DvP. Use when the task is a crypto-asset or on-chain question. Written for the capital markets audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "tokenized-treasury-dvp"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# Tokenized treasury DvP

Validate a DTC-custodied tokenized treasury issuance and its Canton selective-disclosure DvP.

## Prompt

Check a tokenized treasury trade where each party is supposed to see only its leg.

1. Call validate_dtc_tokenized_treasury on a synthetic DTC-custodied issuance (CUSIP, par, coupon, token wrapper). Record the structural verdict and any flagged field.
2. Build the synthetic DvP: two parties, each with a leg, payment-versus-payment.
3. Call validate_canton_selective_disclosure. Confirm party A's attestation reconciles while exposing only A's leg, and the same for B.
4. Privacy test: attempt to read the counterparty leg from A's view; confirm the tool returns nothing. Quote the returned shape.
5. Run the chain wholesale-settlement-cross-network-dvp with run_chain. Record the composed verdict and execution_hash.
6. build_session_receipt over the two validations and the chain; give me the ledger link.
7. Write the note for the settlement desk: what reconciled, what each party can see, and the ledger link, so both parties verify the same receipt without sharing books.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
