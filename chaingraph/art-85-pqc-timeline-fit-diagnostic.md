# PQC Timeline & Migration Fit Diagnostic

12-dimension A-F diagnostic mapping an organisation's cryptographic estate and sector to the CNSA 2.0 / EU-2030 / G7 / DORA post-quantum milestones, flagging the end-2026 EU crypto-inventory deadline. Routes to the existing pqc-migration chain for inventory/HNDL/roadmap/agility and to the new protocol chains (TLS/PKI, SWIFT/ISO 20022, FIDO, blockchain).

- Page: https://ainumbers.co/chaingraph/art-85-pqc-timeline-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-85-pqc-timeline-fit-diagnostic.md
- MCP tool: run_pqc_timeline_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agility_maturity (unknown, optional)
- cnsa_applicability (unknown, optional)
- crypto_inventory_status (unknown, optional)
- hndl_data_shelf_life (unknown, optional)
- hndl_long_shelf_flag (unknown, optional)
- inventory_complete (unknown, optional)
- notes (unknown, optional)
- protocol_estate (unknown, optional)
- regulatory_drivers (unknown, optional)
- sector (unknown, optional)
- sector_preset (unknown, optional)
- vendor_pqc_roadmap (unknown, optional)

## Outputs

- dim_scores (object, optional)
- do_now (array, optional)
- inventory_deadline_flag (boolean, optional)
- milestone_fit (string, optional)
- milestones (object, optional)
- note (string, optional)
- prepare_ahead (array, optional)
- primary_recommendation (string, optional)
- protocol_routes (array, optional)
- readiness_grade (string, optional)
- reference_version (string, optional)
- total_score (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `run_pqc_timeline_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
