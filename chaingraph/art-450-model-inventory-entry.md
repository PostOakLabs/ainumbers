# Model Inventory Entry Builder

Builds a single model-inventory record for a bank's SR 26-2 model-risk-management inventory: checks the caller-declared attributes (model name, owner, purpose, tier, development/deployment dates, last validation date) against the SR 26-2 required-field set, assigns a proportionality tier (limited/moderate/high) from caller-declared materiality and complexity inputs, and returns a completeness score plus a list of missing required fields. First node in the model-passport lifecycle (inventory entry, then outcome-analysis comparison in art-451, then validation status in art-453). Distinct from the shipped program-level gap analyzers (tools 339/451 SR 26-02 and SR 11-7 gap assessors), which score an institution's overall MRM program, not a single model's inventory record. Distinct from art-380 (AI workpaper record), which documents a completed assessment rather than registering a model. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-450-model-inventory-entry.html
- Markdown twin: https://ainumbers.co/chaingraph/art-450-model-inventory-entry.md
- MCP tool: build_model_inventory_entry (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- ai_ml_model (boolean, required)
- business_purpose (unknown, required)
- complexity_score (unknown, required)
- deployment_date (unknown, required)
- development_date (unknown, required)
- last_validation_date (unknown, required)
- materiality_score (unknown, required)
- model_name (unknown, required)
- model_owner (unknown, required)
- third_party_vendor (boolean, required)
- usage_scope (unknown, required)

## Outputs

- ai_ml_model (boolean, optional)
- completeness_score (integer, optional)
- complexity_score (integer, optional)
- inventory_record (object, optional)
- materiality_score (integer, optional)
- missing_required_fields (array, optional)
- model_name (string, optional)
- third_party_vendor (boolean, optional)
- tier (string, optional)
- tier_sum (integer, optional)
- usage_scope (string, optional)

## Sample

```json
{
  "model_name": "Retail Credit Scoring Model v3",
  "model_owner": "Model Risk Management",
  "business_purpose": "Consumer credit approval scoring",
  "development_date": "2025-03-01",
  "deployment_date": "2025-06-15",
  "last_validation_date": "2026-01-10",
  "materiality_score": 4,
  "complexity_score": 3,
  "usage_scope": "enterprise_wide",
  "third_party_vendor": false,
  "ai_ml_model": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_model_inventory_entry` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
