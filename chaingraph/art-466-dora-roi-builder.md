# DORA Register of Information (RoI) Builder & Cross-Validator

Constructs and cross-validates the core Register of Information (RoI) template relationships required under DORA (EU 2022/2554) Art. 28/30: entity + ICT third-party providers + functions + contractual arrangements. Validates ISO 17442 LEI format + mod-97 check-digit on the entity and every provider, referential integrity (every function's provider_id, every contract's function_id and provider_id, and function-to-contract provider consistency), and mandatory-field completeness per record type, emitting a form-shaped JSON dataset plus a validation report with per-record findings and compliance_flags. Distinct from the RoI's official xBRL-CSV submission format, which this kernel does NOT emit (a later WU handles ESA-format conversion). Distinct from art-467-dora-incident-classifier (this validates the standing RoI dataset; that classifies a single ICT incident's reporting obligations). Criticality of functions/providers is a caller-declared flag, not judged here.

- Page: https://ainumbers.co/chaingraph/art-466-dora-roi-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-466-dora-roi-builder.md
- MCP tool: build_dora_roi_register (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- contracts (unknown, required)
- entity (unknown, required)
- functions (unknown, required)
- providers (unknown, required)

## Outputs

- contracts (array, optional)
- entity (object, optional)
- functions (array, optional)
- note (string, optional)
- providers (array, optional)
- validation_report (object, optional)

## Sample

```json
{
  "entity": {
    "entity_name": "Test Bank NV",
    "entity_lei": "529900T8BM49AURSDO55"
  },
  "providers": [
    {
      "provider_id": "prov-1",
      "name": "CloudCo Ireland Ltd",
      "lei": "529900T8BM49AURSDO55",
      "country": "IE",
      "service_type": "cloud_iaas"
    }
  ],
  "functions": [
    {
      "function_id": "fn-1",
      "provider_id": "prov-1",
      "name": "Core banking hosting",
      "critical": true,
      "function_type": "ict_services"
    }
  ],
  "contracts": [
    {
      "contract_id": "ctr-1",
      "function_id": "fn-1",
      "provider_id": "prov-1",
      "contract_reference": "CTR-2026-001",
      "start_date": "2024-01-01",
      "governing_law": "Ireland"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_dora_roi_register` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
