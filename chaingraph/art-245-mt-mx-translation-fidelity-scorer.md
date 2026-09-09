# MT103 to MX Translation Fidelity Scorer

Scores ISO 15022 MT103 to ISO 20022 pacs.008 translation fidelity for CBPR+ November 2026 migration. Checks field presence mapping (:20: to UETR, :50K/A to Dbtr/Nm, :59/:59A to Cdtr/Nm, :52A/:57A to BIC agents, :70: to RmtInf/Ustrd, :71A to ChrgBr), truncation risks (140-char remittance info, address line lengths), and charge bearer code mapping (OUR=DEBT, SHA=SHAR, BEN=CRED). Outputs fidelity score and per-field mapping results.

- Page: https://ainumbers.co/chaingraph/art-245-mt-mx-translation-fidelity-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-245-mt-mx-translation-fidelity-scorer.md
- MCP tool: score_mt_mx_translation_fidelity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- mt_f20 (unknown, required)
- mt_f23b (unknown, required)
- mt_f32a (unknown, required)
- mt_f50 (unknown, required)
- mt_f52a (unknown, required)
- mt_f57a (unknown, required)
- mt_f59 (unknown, required)
- mt_f70 (unknown, required)
- mt_f71a (unknown, required)
- mx_cdtr_agt (unknown, required)
- mx_cdtr_nm (unknown, required)
- mx_chrg_br (unknown, required)
- mx_dbtr_agt (unknown, required)
- mx_dbtr_nm (unknown, required)
- mx_rmt_ustrd (unknown, required)
- mx_uetr (unknown, required)

## Outputs

- cbpr_plus_deadline (string, optional)
- charge_bearer_map (object, optional)
- compliant (boolean, optional)
- error_count (integer, optional)
- fidelity_score (integer, optional)
- fidelity_tier (string, optional)
- issues (array, optional)
- mapping_results (array, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- truncation_risks (array, optional)

## Sample

```json
{
  "mt_f20": "PAYMENT20260705",
  "mt_f23b": "CRED",
  "mt_f32a": "260705EUR10000,",
  "mt_f50": "Acme Corp",
  "mt_f52a": "DEUTDEFFXXX",
  "mt_f57a": "BARCGB22XXX",
  "mt_f59": "Global Trade AG",
  "mt_f70": "/INV/2026/001 trade payment",
  "mt_f71a": "SHA",
  "mx_uetr": "550e8400-e29b-41d4-a716-446655440000",
  "mx_dbtr_nm": "Acme Corp",
  "mx_cdtr_nm": "Global Trade AG",
  "mx_cdtr_agt": "BARCGB22XXX",
  "mx_dbtr_agt": "DEUTDEFFXXX",
  "mx_rmt_ustrd": "/INV/2026/001 trade payment",
  "mx_chrg_br": "SHAR"
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_mt_mx_translation_fidelity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
