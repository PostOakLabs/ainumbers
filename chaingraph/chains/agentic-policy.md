# Agentic Policy

Agentic mandate sandbox > Google AP2 mandate builder > AP2/MCP policy validator > MCP developer readiness scorecard.

- Page: https://ainumbers.co/chaingraph/chains/agentic-policy.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agentic-policy.md

## Workflow chain: Agentic Policy

Agentic mandate sandbox > Google AP2 mandate builder > AP2/MCP policy validator > MCP developer readiness scorecard.

Domain: AI & Agent Governance

### Steps

1. rbe-06-agentic-mandate-sandbox
   mandate_draft and guardrail_flags feed Stage 2 AP2 mandate build
2. 285-google-ap2-mandate-builder
   ap2_mandate and payment_policy feed Stage 3 policy validation
3. 320-ap2-mcp-policy-validator
   validation_results and policy_gaps feed Stage 4 readiness scorecard
4. 288-mcp-developer-readiness-scorecard
   Exports agentic policy composite mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
