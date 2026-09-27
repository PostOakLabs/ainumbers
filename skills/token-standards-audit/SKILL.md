---
name: token-standards-audit
description: "Audit an ERC-4626 vault’s share math, an ERC-1967 proxy slot, an ERC-2981 royalty, and an airdrop proof in one pass. Use when the task is a crypto-asset or on-chain question. Written for the protocol devs audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "token-standards-audit"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# Token standards audit

Audit an ERC-4626 vault’s share math, an ERC-1967 proxy slot, an ERC-2981 royalty, and an airdrop proof in one pass.

## Prompt

One pass over four token-standard claims, each under its own receipt.

1. Call recompute_erc4626_vault_share_math on a synthetic vault (totalAssets, totalSupply, one deposit, one withdrawal). Record previewRetain/share math both directions and any rounding direction.
2. Call classify_erc1967_proxy_slot on a synthetic storage dump. Record whether the proxy slot classifies as expected and which implementation slot it points to.
3. Call calculate_erc2981_royalty for a synthetic sale. Record the royalty and the receiver; confirm rounding matches the standard's expectation.
4. Call verify_merkle_airdrop_proof for one claimed airdrop allocation against a synthetic root. Record pass/fail and the proof path.
5. Negative tests: perturb the vault's totalSupply by 1 wei and confirm the share math changes; corrupt one airdrop proof nibble and confirm it fails. Quote both.
6. build_session_receipt over all four checks; anchor the root with anchor_stamp.
7. Give me the ledger link and the OTS receipt.
8. Write the audit note: each claim, its verdict, its hash, and the two receipts, so the protocol team pins the evidence to the block they audited.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
