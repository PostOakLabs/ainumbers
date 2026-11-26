# Sukuk Tradability Composition

Checks whether sukuk with a mixed asset portfolio are tradable at a negotiated price, per authority and per period, from the portfolio composition alone. Two authority profiles are supported: the Securities Commission Malaysia Shariah Advisory Council 266th meeting resolutions of 16 March 2023, under which at least 33 percent of the sukuk proceeds must sit in non-debt investment assets at the time of each issuance, the percentage need not be maintained through the tenure but a non-debt component must remain at all times, and any non-debt component means the certificates are a portfolio of assets rather than debt, tradable at a negotiated price; and the State Bank of Pakistan IFPD Circular 10 of 2024 Appendix A adoption of AAOIFI Shariah Standard No. 59, under which tangible and like assets must be at least 33 percent of asset value (including ijarah and diminishing musharakah assets with debt created through tawarruq), assets combined without a commingled entity fall under the sale-of-debt provisions, and a genuine commingled entity not entirely composed of debt is tradable. Each authority-period verdict is one of tradable_at_negotiated_price, sale_of_debt_rules_apply or issuance_test_failed, with its paragraph. AAOIFI standards 17 and 59 as published, the draft standard 62 (a status note only, since it is not final), IIFA, CBB, DFSA, DSN-MUI and CMA are refused by name. Whether the portfolio is Shariah compliant overall is a caller determination; this node applies only the cited composition rules. Outputs are arithmetic and rule checks against the cited texts, not a fatwa, Shariah certification, legal opinion or regulatory approval.

- Page: https://ainumbers.co/chaingraph/art-854-sukuk-tradability-composition.html
- Markdown twin: https://ainumbers.co/chaingraph/art-854-sukuk-tradability-composition.md
- MCP tool: check_sukuk_tradability_composition (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "sukuk_type": "wakalah_bi_al_istithmar",
  "authorities": [
    "sc_malaysia",
    "sbp_pakistan"
  ],
  "commingled_entity": false,
  "periods": [
    {
      "non_debt_minor_units": 40000,
      "debt_minor_units": 40000,
      "cash_minor_units": 20000,
      "is_issuance_date": true
    },
    {
      "non_debt_minor_units": 10000,
      "debt_minor_units": 60000,
      "cash_minor_units": 30000,
      "is_issuance_date": false
    },
    {
      "non_debt_minor_units": 10000,
      "debt_minor_units": 70000,
      "cash_minor_units": 20000,
      "is_issuance_date": false
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_sukuk_tradability_composition` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
