# NIS2 Governance Readiness Checker (Art. 20 - Management Body Accountability)

Assess NIS2 Art. 20 management-body accountability: board approval of Art. 21 measures, quarterly status updates, CISO designation, cybersecurity training coverage, and board review freshness (board_review_age_days). Grades governance A–F; flags personal liability risk (board has not approved Art. 21 or review stale >365 days). §16 proof OPT-IN signing candidate. Terminal stage of nis2-incident-and-supply-chain-readiness chain.

- Page: https://ainumbers.co/chaingraph/art-146-nis2-governance-readiness-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-146-nis2-governance-readiness-checker.md
- MCP tool: check_nis2_governance_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "board_approved_art21_measures": true,
  "board_receives_quarterly_status_updates": true,
  "ciso_or_equivalent_designated": true,
  "board_cybersecurity_training_completed": true,
  "training_covers_threat_landscape": true,
  "training_covers_incident_response": true,
  "board_review_age_days": 90
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_nis2_governance_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
