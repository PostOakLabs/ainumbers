# GloBE Information Return (GIR) Composer

Assembles the OECD GloBE Information Return (GIR) data model for one MNE group / fiscal year by combining the outputs of art-454 (jurisdictional ETR), art-455 (SBIE / top-up), and art-456 (transitional safe harbour tests) into the GIR's jurisdictional-summary shape: per-jurisdiction ETR, SBIE, top-up tax, safe-harbour status, and the constituent-entity allocation split. Exports in two forms: an OECD GIR XML rendering (schema version pinned as a versioned policy_parameters input - this tool does not chase draft schema revisions) and a form-shaped JSON mirror, both carrying the composed execution_hash in their metadata. Every jurisdiction row where safe_harbour_met is true is composed with top-up forced to zero (deemed_zero_topup), consistent with art-456; jurisdictions with no safe-harbour test result compose the raw art-454/455 top-up figures unchanged. This tool assembles and formats only - it recomputes nothing upstream (ETR, SBIE, and safe-harbour verdicts are trusted inputs from their own nodes) and its XML/JSON export is explicitly marked NOT-SUBMITTABLE, since national filing gateways vary in accepted schema version and transport. Pure data assembly and templating. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-457-globe-gir-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-457-globe-gir-composer.md
- MCP tool: compose_globe_gir (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- fiscal_year (unknown, required)
- gir_schema_version (unknown, required)
- jurisdictions (array, required)
- mne_group_name (unknown, required)

## Outputs

- fiscal_year (integer, optional)
- gir_schema_version (string, optional)
- gir_xml_summary (object, optional)
- jurisdiction_rows (array, optional)
- jurisdictions_not_evaluated (integer, optional)
- jurisdictions_with_deemed_zero (integer, optional)
- mne_group_name (string, optional)
- submittable (boolean, optional)
- total_topup_tax (integer, optional)

## Sample

```json
{
  "mne_group_name": "Acme Global Group",
  "fiscal_year": 2024,
  "gir_schema_version": "OECD-GIR-2023-07",
  "jurisdictions": [
    {
      "jurisdiction_code": "DE",
      "jurisdictional_etr": 0.12,
      "sbie_amount": 500000,
      "topup_tax": 900000,
      "constituent_entities": [
        {
          "entity_name": "Acme DE Holdco",
          "allocation_share": 0.6
        },
        {
          "entity_name": "Acme DE OpCo",
          "allocation_share": 0.4
        }
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compose_globe_gir` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
