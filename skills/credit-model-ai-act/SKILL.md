---
name: credit-model-ai-act
description: "Score credit default risk and produce the EU AI Act conformity pack for the model. Use when the task is a banking or payment-operations question. Written for the model risk audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "credit-model-ai-act"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "1e8cd3fdd287"
---

# Credit model AI Act pack

Score credit default risk and produce the EU AI Act conformity pack for the model.

## Prompt

Put the credit model's governance evidence where an examiner can recompute it.

1. Call score_credit_default_risk on a synthetic applicant pool. Record the score distribution and the top features the model used.
2. Call assess_ai_act_conformity for the model as a high-risk system under the AI Act. Record each requirement's evidence verdict (data governance, logging, human oversight, accuracy).
3. Run the chain ai-governance-credit-ai-conformity with run_chain. Record the composed verdict and execution_hash.
4. Gap list: name the conformity items with no evidence yet and who owns each.
5. build_session_receipt over the scoring run, the conformity assessment, and the chain; give me the ledger link.
6. Write the note for the model-risk committee: the conformity status, the gap owners, and the ledger link, so the committee's evidence survives model retraining by re-running the same receipt.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.
GPU note: the score_credit_default_risk tool computes in your browser, so the MCP endpoint returns no execution_hash; export the Policy Mandate artifact the page produces and pass that full artifact to verify_execution_hash as claimed_hash.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp
