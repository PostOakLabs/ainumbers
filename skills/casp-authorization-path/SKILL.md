---
name: casp-authorization-path
description: "Am I a MiCA CASP, what own funds do I need, and is my surveillance MAR-ready? Use when the task is a crypto-asset or on-chain question. Written for the crypto firms audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "casp-authorization-path"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# CASP authorization path

Am I a MiCA CASP, what own funds do I need, and is my surveillance MAR-ready?

## Prompt

Scope your MiCA CASP posture with each answer under a receipt.

1. Call run_mica_casp_fit with your synthetic service inventory (which crypto-asset services you render, to whom). Record the fit verdict per service.
2. Call assess_mica_casp_readiness for the authorization gap list. Record each gap with its class.
3. Call calculate_mica_own_funds on the synthetic balance sheet. Record the computed own-funds requirement and which of the three bases binds.
4. Call assess_mar_crypto_surveillance on a synthetic order/transaction sample. Record the coverage verdict and the flagged patterns.
5. Pick the one gap that blocks authorization first; state the evidence the reviewer will ask for.
6. build_session_receipt over the four runs; give me the ledger link.
7. Write the board note: the fit verdict, the own-funds number, the top gap, and the ledger link. Say plainly that these are deterministic self-assessments from your inputs, not a regulator's determination.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
