# CASS 15 Safeguarding Reconciliation Check

Compares a UK payment or e-money firm's safeguarding requirement (CASS 15.8.29G) against the components of its safeguarding resource (CASS 15.8.26R) for one caller-declared as-of date, and classifies the arithmetic outcome as reconciled, shortfall, or excess against a caller-declared tolerance. Resource components carry the four component types CASS 15.8.26R enumerates: relevant funds bank account, segregated but not yet placed, relevant assets, and insurance or guarantee. Money is handled as integer minor units throughout with 2dp display, an empty or zero figure set resolves to a defined verdict, and any value that is not a usable integer amount is named in rejected_inputs rather than silently dropped. Single-run and stateless: the firm performs its reconciliation no less than once each reconciliation day because CASS 15.8.19R requires it of the firm, and this tool operates nothing, stores nothing, and retains nothing. A shortfall verdict is an arithmetic finding about the figures supplied, never a determination that the firm has breached CASS 15.

- Page: https://ainumbers.co/chaingraph/art-499-check-safeguarding-reconciliation.html
- Markdown twin: https://ainumbers.co/chaingraph/art-499-check-safeguarding-reconciliation.md
- MCP tool: check_safeguarding_reconciliation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, required)
- component_breakdown (array, required)
- currency (string, required)
- reconciliation_type (unknown, required)
- relevant_funds_total (unknown, required)
- relevant_funds_total_minor_units (unknown, required)
- safeguarding_requirement_minor_units (unknown, required)
- safeguarding_resource_components (array, required)
- tolerance_minor_units (unknown, required)

## Outputs

- as_of_date (string, optional)
- citations (object, optional)
- component_count (integer, optional)
- components (array, optional)
- currency (string, optional)
- difference_direction (string, optional)
- difference_display (string, optional)
- difference_minor_units (integer, optional)
- minor_unit_exponent (integer, optional)
- note (string, optional)
- rationale (array, optional)
- reconciliation_type (string, optional)
- rejected_inputs (array, optional)
- ruleset (object, optional)
- safeguarding_requirement_display (string, optional)
- safeguarding_requirement_minor_units (integer, optional)
- safeguarding_resource_display (string, optional)
- safeguarding_resource_minor_units (integer, optional)
- subtotals_by_component_type (array, optional)
- tolerance_display (string, optional)
- tolerance_minor_units (integer, optional)
- verdict (string, optional)
- within_tolerance (boolean, optional)

## Sample

```json
{
  "as_of_date": "2026-07-29",
  "currency": "GBP",
  "reconciliation_type": "internal",
  "safeguarding_requirement_minor_units": 48250000,
  "tolerance_minor_units": 100,
  "safeguarding_resource_components": [
    {
      "account_ref": "ACC-REF-A1",
      "component_type": "relevant_funds_bank_account",
      "amount_minor_units": 41000000
    },
    {
      "account_ref": "ACC-REF-B2",
      "component_type": "segregated_not_yet_placed",
      "amount_minor_units": 2250000
    },
    {
      "account_ref": "ACC-REF-C3",
      "component_type": "relevant_assets",
      "amount_minor_units": 3000000
    },
    {
      "account_ref": "ACC-REF-D4",
      "component_type": "insurance_or_guarantee",
      "amount_minor_units": 2000000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_safeguarding_reconciliation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
