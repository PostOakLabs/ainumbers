# Cat Bond Trigger Terms Validator

Validates catastrophe bond trigger term structure and computes layer arithmetic: attachment/exhaustion point ordering, pro-rata layer penetration factor, payout amount, and layer position (BELOW_ATTACHMENT / WITHIN_LAYER / ABOVE_EXHAUSTION). Cat bonds outstanding $63.9B Q1 2026 (record $25.6B issuance 2025). Validates ISDA/IAIS trigger term constraints including attachment > 0 and exhaustion > attachment. Use in parametric-trigger-adjudication chain downstream of trigger evaluation, or standalone in cat-bond-trigger-validation chain. ZERO PII.

- Page: https://ainumbers.co/chaingraph/art-252-validate-cat-bond-trigger-terms.html
- Markdown twin: https://ainumbers.co/chaingraph/art-252-validate-cat-bond-trigger-terms.md
- MCP tool: validate_cat_bond_trigger_terms (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- attachment_point (unknown, required)
- coverage_amount (unknown, required)
- exhaustion_point (unknown, required)
- pro_rata_enabled (boolean, required)
- reported_loss (unknown, required)
- second_loss_amount (unknown, required)

## Outputs

- attachment_breached (boolean, optional)
- cascade_attachment_check (string, optional)
- coverage_amount_used (integer, optional)
- excess_above_attachment (integer, optional)
- exhaustion_reached (boolean, optional)
- implied_coverage (integer, optional)
- issues (array, optional)
- layer_position (string, optional)
- layer_width (integer, optional)
- not_legal_advice (string, optional)
- payout_amount (integer, optional)
- pii_note (string, optional)
- pro_rata_factor (number, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- terms_valid (boolean, optional)

## Sample

```json
{
  "reported_loss": 750000000,
  "attachment_point": 500000000,
  "exhaustion_point": 1000000000,
  "coverage_amount": 500000000,
  "pro_rata_enabled": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_cat_bond_trigger_terms` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
