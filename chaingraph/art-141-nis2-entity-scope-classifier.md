# NIS2 Entity Scope Classifier (Essential / Important / Out-of-Scope)

Classify an entity as Essential, Important, or Out-of-Scope under NIS2 Directive 2022/2555 Annex I and II, applying sector codes, employee/turnover size thresholds, and automatic-essential carve-outs (DNS providers, qualified trust service providers, public electronic communications networks). Feeds the Art. 21 gap checker (art-142). NIS2 entity classification active October 2024; annual registration window January–June each year.

- Page: https://ainumbers.co/chaingraph/art-141-nis2-entity-scope-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-141-nis2-entity-scope-classifier.md
- MCP tool: classify_nis2_entity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- annual_turnover_eur (unknown, optional)
- employee_count (unknown, optional): Count
- is_dns_provider (unknown, optional)
- is_public_electronic_comms_network (unknown, optional)
- is_qualified_trust_service_provider (unknown, optional)
- sector_code (unknown, optional)

## Outputs

- annex (string, optional)
- annual_turnover_eur (integer, optional)
- applicable_penalties (object, optional)
- automatic_essential (boolean, optional)
- classification_basis (string, optional)
- employee_count (integer, optional)
- entity_classification (string, optional)
- sector_code (string, optional)

## Sample

```json
{
  "sector_code": "energy",
  "employee_count": 500,
  "annual_turnover_eur": 80000000,
  "is_dns_provider": false,
  "is_qualified_trust_service_provider": false,
  "is_public_electronic_comms_network": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_nis2_entity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
