# DORA ICT Incident Classifier & Reporting Clock

Classifies an ICT-related incident as major or non-major under DORA (EU 2022/2554) Art. 18, applying the published RTS (EU 2024/1772) numeric criteria (clients affected %, duration, geographical spread, data losses, economic impact, critical-services impact, reputational impact), then starts the DORA Art. 19 reporting clock (4-hour initial notification, 72-hour intermediate report, 1-calendar-month final report, all from classification) once classified major. Follows the art-428-cyber-incident-clock deadline-clock pattern for the EU DORA regime; see that node for the analogous US banking/SEC/NYDFS clock. Not a duplicate of the existing art-09-dora-incident-classifier (earlier draft-RTS citation, no notification-clock link, infrastructure_mandate) - art-467 cites the final 2024 RTS/ITS package and is built to the attestation-clock pattern; the overlap between the two is flagged for review, not hidden. This node classifies and computes deadlines only; it does not itself transmit, file, or submit any regulatory notification, and it is not legal advice.

- Page: https://ainumbers.co/chaingraph/art-467-dora-incident-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-467-dora-incident-classifier.md
- MCP tool: classify_dora_ict_incident_and_clock_deadlines (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- classification_at (unknown, required)
- clients_affected_pct (unknown, required): Percentage value
- critical_services_affected (boolean, required)
- data_losses (boolean, required)
- duration_minutes (unknown, required)
- economic_impact_amount (unknown, required)
- geographical_spread_countries_count (unknown, required): Count
- incident_id (unknown, required)
- reputational_impact (boolean, required)

## Outputs

- criteria_detail (array, optional)
- incident_id (string, optional)
- major_incident (boolean, optional)
- note (string, optional)
- qualifying_criteria (array, optional)
- reporting_clock (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- verdict (string, optional)

## Sample

```json
{
  "incident_id": "INC-2026-0100",
  "classification_at": "2026-07-20T09:00:00Z",
  "clients_affected_pct": 2,
  "duration_minutes": 30,
  "geographical_spread_countries_count": 1,
  "data_losses": false,
  "economic_impact_amount": 5000,
  "critical_services_affected": false,
  "reputational_impact": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_dora_ict_incident_and_clock_deadlines` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
