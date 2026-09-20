# NIS2 ICT Supply-Chain Diligence Scorer (Art. 21(2)(d) / ENISA)

Score ICT vendor due-diligence posture against NIS2 Art. 21(2)(d) and ENISA ICT supply-chain risk framework. Seven controls: ISO 27001 certification, vendor incident history, audit clause, breach-notification SLA ≤72h, EU-only data residency, sub-contractor mapping, availability SLA ≥99.5%. Emits risk score, tier (Low/Medium/High/Critical), active flags, and remediation checklist.

- Page: https://ainumbers.co/chaingraph/art-145-nis2-ict-supply-chain-diligence-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-145-nis2-ict-supply-chain-diligence-scorer.md
- MCP tool: score_nis2_supply_chain_diligence (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- audit_clause_in_contract (any, optional): type not evidenced by kernel source
- breach_notification_sla_hours (any, optional): type not evidenced by kernel source
- data_residency_eu_only (any, optional): type not evidenced by kernel source
- service_availability_pct (any, optional): Percentage value; type not evidenced by kernel source
- sub_contractor_count (any, optional): Count; type not evidenced by kernel source
- vendor_incident_history_12mo (any, optional): type not evidenced by kernel source
- vendor_iso27001_certified (any, optional): type not evidenced by kernel source

## Outputs

- active_risk_flags (array, optional)
- enisa_control_coverage_pct (integer, optional)
- remediation_checklist (array, optional)
- risk_score (integer, optional)
- risk_tier (string, optional)
- vendor_incident_history_12mo (integer, optional)

## Sample

```json
{
  "vendor_iso27001_certified": true,
  "vendor_incident_history_12mo": 0,
  "audit_clause_in_contract": true,
  "breach_notification_sla_hours": 24,
  "data_residency_eu_only": true,
  "sub_contractor_count": 2,
  "service_availability_pct": 99.9
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_nis2_supply_chain_diligence` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
