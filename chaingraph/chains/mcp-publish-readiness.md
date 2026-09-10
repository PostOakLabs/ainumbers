# MCP Publish-Readiness Chain

Validates an MCP server manifest → lints tool definitions → audits OAuth 2.1 → scans for tool-poisoning → scores developer readiness. Full 5-stage MCP compliance journey before shipping a production MCP server.

- Page: https://ainumbers.co/chaingraph/chains/mcp-publish-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mcp-publish-readiness.md

## Workflow chain: MCP Publish-Readiness Chain

Validates an MCP server manifest → lints tool definitions → audits OAuth 2.1 → scans for tool-poisoning → scores developer readiness. Full 5-stage MCP compliance journey before shipping a production MCP server.

Domain: AI & Agent Governance

### Steps

1. 275-mcp-server-json-validator
   schema_errors,version_compliance,missing_fields feed Stage 2 tool linting
2. 274-mcp-tool-definition-linter
   lint_errors,naming_violations,schema_gaps feed Stage 3 OAuth audit
3. 278-mcp-oauth-authorization-auditor
   auth_scheme,token_scope_gaps,pkce_compliance feed Stage 4 poisoning scan
4. 282-mcp-tool-poisoning-scanner
   poisoning_risk_score,suspicious_instructions,injection_patterns feed Stage 5 readiness score
5. 288-mcp-developer-readiness-scorecard
   readiness_score,deployment_verdict - Exports MCP compliance mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
