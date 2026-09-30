---
name: is-this-counterparty-real
description: "Check the LEI, its relationships, and the GLEIF snapshot digest before you onboard them. Use when you want a short routine task run against the AINumbers suite. Written for the onboarding audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "is-this-counterparty-real"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Is this counterparty real?

Check the LEI, its relationships, and the GLEIF snapshot digest before you onboard them.

## Prompt

Onboarding check for one counterparty, with every claim re-verifiable.

1. Get the counterparty's LEI from their paperwork. Do not accept a name alone.
2. Call lei_kyb_check on the LEI. Record the registered status, entity type, and any exceptions.
3. Call check_lei_relationship_consistency to pull the relationship tree (parents, children). Flag any relationship your onboarding form does not mention.
4. Call digest_gleif_snapshot on the GLEIF snapshot file covering today. Record the snapshot digest; this is the public dataset your conclusions rest on.
5. If the counterparty presented a SAID, call acdc_said_check on it and record whether it resolves.
6. Give me the ledger link for the session receipt covering all four checks (build_session_receipt if your client does not build it automatically).
7. Write the onboarding note for the KYC reviewer: what was checked, against which snapshot digest, what matched, what needs a human call, and the ledger link.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
