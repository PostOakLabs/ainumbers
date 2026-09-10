# MCP Server Attestation

MCP deployability diagnostic > signed server self-attestation (composite A-F grade).

- Page: https://ainumbers.co/chaingraph/chains/mcp-server-attestation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mcp-server-attestation.md

## Workflow chain: MCP Server Attestation

MCP deployability diagnostic > signed server self-attestation (composite A-F grade).

Domain: AI & Agent Governance

### Steps

1. art-28-mcp-server-deployability-diagnostic
   deployability grade and execution_hash feed Stage 2 readiness scorecard
2. art-18-mcp-developer-readiness-scorecard
   readiness score and execution_hash feed Stage 3 self-attestation
3. art-33-mcp-server-self-attestation-pack
   Exports the composite MCP server attestation artifact - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
