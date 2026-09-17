# ETF PCF Create/Redeem Basket Verification

Recomputes what an authorized participant's assembled ETF create/redeem basket should contain against the fund's daily Portfolio Composition File (PCF) and diffs it against what was actually assembled, for a declared number of creation units. Per PCF line, checks that the expected quantity (the PCF's per-unit quantity times units requested) is covered by the basket either in kind or through a declared cash-in-lieu substitution - never a silent gap - and flags any basket line that is not a PCF line at all. Separately recomputes the total cash the AP should have deposited or received: the PCF's declared per-unit balancing amount times units requested, plus the total cash-in-lieu substitution value, compared against the cash actually deposited within a declared tolerance. Cash tolerance is always a declared input, never defaulted. Verdict MATCHES when every line covers its expected quantity and the cash balances within tolerance; DIVERGES when any line mismatches or the cash breaks; INDETERMINATE when a required input (the tolerance, the transaction type, units requested, the creation-unit size, the PCF balancing amount, or at least one PCF line) is absent. All quantities are integer shares and all cash figures integer minor units, so the arithmetic is exact. Distinct from the shipped fund-NAV verification pack, which recomputes NAV per share rather than an in-kind basket against a PCF - cross-link, do not duplicate. Performs arithmetic only over a caller-declared PCF and a caller-declared basket; does not source, derive, or independently verify the PCF, does not price securities, and does not determine which lines are cash-in-lieu-eligible. Clause: DTCC's ETF Processing service (Fund/SERV, over NSCC) settles AP creation/redemption baskets against the fund's daily PCF; no DTCC endorsement of this tool is implied or claimed.

- Page: https://ainumbers.co/chaingraph/art-578-etf-pcf-basket-verification.html
- Markdown twin: https://ainumbers.co/chaingraph/art-578-etf-pcf-basket-verification.md
- MCP tool: verify_etf_pcf_basket (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- basket (unknown, required)
- cash_tolerance_minor (unknown, required)
- creation_unit_size (unknown, required)
- pcf (unknown, required)
- transaction_type (string, required)
- units_requested (unknown, required)

## Outputs

- cash_delta_minor (integer, optional)
- cash_deposited_minor (integer, optional)
- cash_in_lieu_total_minor (integer, optional)
- cash_matches (boolean, optional)
- cash_tolerance_minor (integer, optional)
- clause_note (string, optional)
- creation_unit_size (integer, optional)
- decision (object, optional)
- expected_cash_minor (integer, optional)
- findings (array, optional)
- line_count (integer, optional)
- line_results (array, optional)
- pcf_as_of (string, optional)
- rejected_inputs (array, optional)
- scope_note (string, optional)
- transaction_type (string, optional)
- units_requested (integer, optional)
- verdict (string, optional)

## Sample

```json
{
  "cash_tolerance_minor": 100,
  "transaction_type": "create",
  "units_requested": 1,
  "creation_unit_size": 50000,
  "pcf": {
    "as_of": "2026-08-07",
    "balancing_amount_per_unit_minor": 15000,
    "lines": [
      {
        "security_id": "US0378331005",
        "name": "Issuer A common stock",
        "quantity_per_unit": 500
      },
      {
        "security_id": "US5949181045",
        "name": "Issuer B common stock",
        "quantity_per_unit": 300
      },
      {
        "security_id": "US4592001014",
        "name": "Issuer C common stock",
        "quantity_per_unit": 200
      }
    ]
  },
  "basket": {
    "lines": [
      {
        "security_id": "US0378331005",
        "quantity": 500
      },
      {
        "security_id": "US5949181045",
        "quantity": 300
      },
      {
        "security_id": "US4592001014",
        "quantity": 200
      }
    ],
    "cash_in_lieu": [],
    "cash_deposited_minor": 15000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_etf_pcf_basket` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
