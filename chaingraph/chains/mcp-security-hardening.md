# MCP Server Security Hardening

MCP tool definition linting > MCP server JSON validation > MCP OAuth authorisation audit > MCP tool-poisoning scan > MCP DNS-rebinding transport audit: composite MCP security mandate.

- Page: https://ainumbers.co/chaingraph/chains/mcp-security-hardening.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mcp-security-hardening.md

## Workflow chain: MCP Server Security Hardening

MCP tool definition linting > MCP server JSON validation > MCP OAuth authorisation audit > MCP tool-poisoning scan > MCP DNS-rebinding transport audit: composite MCP security mandate.

Domain: AI & Agent Governance

### Steps

1. 274-mcp-tool-definition-linter
   tool_definition_issues and schema_gaps feed Stage 2 MCP server JSON validation
2. 275-mcp-server-json-validator
   server_json_errors and config_mismatches feed Stage 3 MCP OAuth audit
3. 278-mcp-oauth-authorization-auditor
   oauth_vulnerabilities and auth_gaps feed Stage 4 tool-poisoning scan
4. 282-mcp-tool-poisoning-scanner
   poisoning_risk_score and exploit_vectors feed Stage 5 DNS-rebinding audit
5. 284-mcp-transport-dns-rebinding-auditor
   transport_security_assessment and composite_mcp_mandate - final MCP security mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
