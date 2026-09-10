# DORA Readiness Diagnostic

12-question scored diagnostic across four DORA pillars (ICT risk management, incident classification & reporting, resilience testing, third-party risk). Graded A–F with remediation map. Single-node ChainGraph (chain_depth: 0). Common entry point for the DORA Readiness Chain; diagnostic grade determines scenario routing (A/B/C). Promoted from guides/dora-readiness-diagnostic.html.

- Page: https://ainumbers.co/chaingraph/art-29-dora-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-29-dora-readiness-diagnostic.md
- MCP tool: run_dora_readiness_diagnostic (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- answers (unknown, required)

## Outputs

- all_answered (boolean, optional)
- applicable_deadline_note (string, optional)
- domain_scores (array, optional)
- gaps (array, optional)
- gaps_count (integer, optional)
- grade (string, optional)
- grade_title (string, optional)
- immediate_action_required (boolean, optional)
- incident_route_recommended (boolean, optional)
- regulatory_framework (string, optional)
- score_pct (integer, optional)
- supervisory_exposure (boolean, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `run_dora_readiness_diagnostic` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
