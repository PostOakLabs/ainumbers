---
name: agent-spend-policy-stress
description: "Stress my agent’s spend policy against 10,000 synthetic transactions and export the Policy Mandate. Use when the task is an agentic commerce or payments question. Written for the treasury audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "agent-spend-policy-stress"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# Agent spend policy stress

Stress my agent’s spend policy against 10,000 synthetic transactions and export the Policy Mandate.

## Prompt

Find out what your agent's spend policy actually does before a live agent finds out for you.

1. Write down the policy as you believe it is (per-transaction cap, daily cap, merchant allowlist). This is the claim you are testing.
2. Call simulate_spend_policy with 10,000 synthetic transactions spanning: under-cap, at-cap, over-cap, burst-across-midnight, and allowlist-boundary cases. Record the approve/decline counts per class.
3. Call simulate_agent_spend_policy for the agent-shaped variants (parallel requests, retry storms, currency round-trips). Record where the policy and the agent disagree.
4. Find the worst class: the transactions where the outcome contradicts your step-1 claim. Quote three examples with inputs.
5. Adjust the policy (or file the fix), re-run only the failing class, and quote the new counts.
6. Export the effective Policy Mandate your simulation ran under; record its digest.
7. build_session_receipt over the runs; give me the ledger link.
8. Write the note for treasury: what the policy really enforces, the three example transactions, the mandate digest, and the ledger link.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.
GPU note: the simulate_spend_policy tool computes in your browser, so the MCP endpoint returns no execution_hash; export the Policy Mandate artifact the page produces and pass that full artifact to verify_execution_hash as claimed_hash.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
