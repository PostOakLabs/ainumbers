# DORA Major-Incident Reporting Threshold Classifier

DORA Article 19/20 reporting determination and reporting-clock start. Clients affected, transaction value, downtime, geographic spread, cross-border component. Fast, deterministic.

- Page: https://ainumbers.co/chaingraph/art-09-dora-incident-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-09-dora-incident-classifier.md
- MCP tool: classify_dora_incident (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- incident_type (string, optional)
- detection_datetime (string, required)
- clients_affected (integer, required)
- total_clients (integer, required)
- transaction_value_eur_millions (number, optional)
- outage_duration_minutes (integer, required)
- eu_member_states_affected (integer, optional)
- data_loss_occurred (boolean, optional)
- critical_function_affected (boolean, optional)
- cross_border_payment (boolean, optional)

## Outputs

- major_incident (boolean, optional)
- determination_code (string, optional)
- qualifying_criteria (array, optional)
- reporting_clock (object, optional)
- entity_type (string, optional)
- incident_type (string, optional)
- cross_border (boolean, optional)
- third_party_ict (boolean, optional)
- competent_authority_note (string, optional)
- regulatory_framework (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_dora_incident` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
