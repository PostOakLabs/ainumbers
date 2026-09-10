# E-Invoice Transmission Receipt Builder

Build a hash-anchored receipt proving a specific e-invoice's transmitted bytes were format-validated and VAT-arithmetic-checked, with the routed mandate attached. Binds to the as-transmitted document digest (and, for hybrid Factur-X, the embedded XML digest separately). Proves validation was run; never certifies tax compliance, legal validity, or clearance-platform acceptance. Carries SPEC.md §27 pre-transmission gate wiring (review_required release gate, emergency_override for a rejected batch) - schema-only, enforcement pending HA-RETRO-1. Terminal node of the einvoice-validation-pipeline chain. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-296-einvoice-transmission-receipt-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-296-einvoice-transmission-receipt-builder.md
- MCP tool: build_einvoice_transmission_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- document (unknown, required)
- format_validation (unknown, required)
- routed_mandate (unknown, required)
- vat_verification (unknown, required)

## Outputs

- claim_strength (string, optional)
- document_sha256 (string, optional)
- embedded_xml_sha256 (string, optional)
- format (string, optional)
- format_gate_passed (boolean, optional)
- ha_wiring (object, optional)
- not_legal_advice (string, optional)
- routed_mandate (object, optional)
- steps (array, optional)
- validated (boolean, optional)
- vat_gate_passed (boolean, optional)

## Sample

```json
{
  "document": {
    "document_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "embedded_xml_sha256": null,
    "format": "xrechnung"
  },
  "format_validation": {
    "structural_completeness": true
  },
  "vat_verification": {
    "consistent": true
  },
  "routed_mandate": {
    "regime_country": "FR",
    "applicable_format": "factur-x_or_ubl",
    "mandatory_from": "2026-09-01",
    "phase_status": "mandatory",
    "transmission_channel": "PDP",
    "table_version": "einvoice-mandate-table-2026-07-13"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_einvoice_transmission_receipt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
