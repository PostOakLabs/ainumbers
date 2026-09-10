# NIS2 Incident Significance Scorer (Art. 23 Reporting Threshold)

Score whether an operational event meets the NIS2 Art. 23 significant-incident threshold (any of: service disruption ≥1h, ≥1,000 affected users, estimated financial loss ≥€100k, third-party cascade, malicious act, cross-border impact). Emits significance verdict (not_significant / significant / critical), fires 24h/72h/30d reporting clocks, and identifies recipient authorities. Root stage of nis2-incident-and-supply-chain-readiness chain.

- Page: https://ainumbers.co/chaingraph/art-144-nis2-incident-significance-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-144-nis2-incident-significance-scorer.md
- MCP tool: score_nis2_incident_significance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cross_border_impact (unknown, optional)
- entity_classification (unknown, optional)
- estimated_affected_users (unknown, optional)
- estimated_financial_loss_eur (unknown, optional)
- involves_malicious_act (unknown, optional)
- service_disruption_hours (unknown, optional)
- third_party_cascade_impact (unknown, optional)

## Outputs

- early_warning_deadline_hours (integer, optional)
- estimated_affected_users (integer, optional)
- estimated_financial_loss_eur (integer, optional)
- final_report_deadline_days (integer, optional)
- notification_deadline_hours (integer, optional)
- recipients (array, optional)
- reporting_required (boolean, optional)
- service_disruption_hours (integer, optional)
- significance_verdict (string, optional)
- triggering_factors (array, optional)

## Sample

```json
{
  "service_disruption_hours": 4,
  "estimated_affected_users": 5000,
  "estimated_financial_loss_eur": 500000,
  "third_party_cascade_impact": false,
  "involves_malicious_act": false,
  "cross_border_impact": false,
  "entity_classification": "essential"
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_nis2_incident_significance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
