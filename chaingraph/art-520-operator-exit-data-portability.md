# Operator Exit & Data Portability

Evaluates a caller-declared operator-exit and data-portability posture: per data category, whether an export path exists and whether its format is open or proprietary, producing a stranded-category list rather than a coverage ratio. Checks declared operator- versus supplier-control of named components and flags a contractual-operator claim unsupported by that declared control, single-supplier dependencies with no declared substitute, escrow arrangements, and notice period / transition-assistance terms. Undeclared is a distinct, non-failing state from an explicit negative declaration throughout. Evaluates declarations only - never a supplier audit, vendor rating, or enforceability opinion, and no output names or characterises a supplier. Region-portable: every fact is a caller-declared input, with no country, currency, scheme or supplier hardcoded. Deterministic arithmetic only. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-520-operator-exit-data-portability.html
- Markdown twin: https://ainumbers.co/chaingraph/art-520-operator-exit-data-portability.md
- MCP tool: check_operator_exit_portability (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- contractual_operator (unknown, required)
- data_categories (array, required)
- declared_components (array, required)
- dependencies (array, required)
- escrow_arrangements (unknown, required)
- notice_period_days (number, required): Duration in days
- transition_assistance_terms (string, required)

## Outputs

- as_of (string, optional)
- categories (array, optional)
- category_count (integer, optional)
- components (array, optional)
- contractual_operator (string, optional)
- declared_component_count (integer, optional)
- dependencies (array, optional)
- escrow_description (string, optional)
- escrow_exists (string, optional)
- exit_readiness_exceptions (array, optional)
- note (string, optional)
- notice_period_days (integer, optional)
- notice_period_declared (boolean, optional)
- operator_claim_unsupported (boolean, optional)
- operator_control_ratio_declared (string, optional)
- operator_controlled_count (integer, optional)
- portable (boolean, optional)
- proprietary_format_categories (array, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- single_supplier_no_substitute (array, optional)
- stranded_categories (array, optional)
- stranded_category_count (integer, optional)
- supplier_controlled_count (integer, optional)
- transition_assistance_declared (boolean, optional)
- transition_assistance_terms (string, optional)
- undeclared_categories (array, optional)
- undeclared_component_count (integer, optional)

## Sample

```json
{
  "as_of": "2026-08-01",
  "contractual_operator": true,
  "data_categories": [
    {
      "category": "transaction_ledger",
      "export_exists": true,
      "format": "csv",
      "format_open": true,
      "export_cadence": "daily",
      "last_successful_export": "2026-07-31"
    },
    {
      "category": "customer_account_master",
      "export_exists": true,
      "format": "json",
      "format_open": true,
      "export_cadence": "weekly",
      "last_successful_export": "2026-07-28"
    }
  ],
  "declared_components": [
    {
      "name": "core_ledger_engine",
      "controlled_by": "operator"
    },
    {
      "name": "reporting_warehouse",
      "controlled_by": "operator"
    }
  ],
  "dependencies": [
    {
      "name": "clearing_network_access",
      "single_supplier": false,
      "substitutable": true
    }
  ],
  "escrow_arrangements": {
    "exists": true,
    "description": "source escrow held by a third-party agent"
  },
  "notice_period_days": 180,
  "transition_assistance_terms": "180 days of vendor-supplied migration support per the exit schedule"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_operator_exit_portability` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
