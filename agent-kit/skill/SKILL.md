---
name: ainumbers
description: Deterministic regulatory-computation estate: 640+ compliance tools, chains, a verify ledger, and a timestamping anchor, callable over MCP with zero-egress in-page twins. Rules: synthetic data only; verify with verify_execution_hash before trusting; return a ledger link; never paste PII. MCP: https://mcp.ainumbers.co/mcp
license: CC-BY-4.0
metadata:
  openclaw:
    requires:
      bins: []
---

# AINumbers agent skill

ainumbers: the AINumbers deterministic compliance estate over MCP.

Find the right tool with find_chain / find_tool, run it, verify the artifact
with verify_execution_hash before trusting any verdict, and hand back the
ledger link so a human can re-verify without contacting anyone.

Rules (binding, from kit.json):
- Synthetic data only: never paste personal or production data; every tool page ships a synthetic sample and the PII banner.
- Verify before trusting: call verify_execution_hash on any artifact before relying on its verdict.
- Return a ledger link: hand back the ledger_url so a human can re-verify without contacting us.
- Never paste PII: input fields accept synthetic values only; the pages enforce zero egress, keep it that way.

Surfaces: MCP https://mcp.ainumbers.co/mcp · anchor MCP https://anchor.ainumbers.co/mcp
Ledger https://ledger.ainumbers.co/ · catalog https://ainumbers.co/llms.txt

Deep links follow the fragment-only contract in kit.json (deeplink_contract):
#p=v1.<base64url(gzip(JSON policy_parameters))> plus optional &run=1.

Showcase prompts: same-law-three-doorways, signed-policy-agentic-commerce, zero-egress-emir-proof, ai-marked-asset-anchored, air-gapped-helm-handover (bodies: mcp/showcase-prompts.json).
