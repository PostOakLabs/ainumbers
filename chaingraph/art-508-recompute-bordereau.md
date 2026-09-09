# Delegated Authority Bordereau Recomputation

Recomputes a delegated authority bordereau the way the carrier reviewer does, from the same file the coverholder sent. It foots gross premium, brokerage, coverholder commission, mapped taxes and levies, ceded premium and net per currency, derives net from its components and compares that against a mapped net column, then compares the whole footing field by field against the totals the coverholder asserts. Exact agreement on a footing is a weak result and the tool says so, because both sides added the same column. The check that carries weight is utilisation of the binding authority: the aggregate and per risk limits are held by the carrier and are not on the bordereau, so they are declared caller inputs and are never derived from the document under review, which is what gives that comparison independent provenance. It also reports lines outside the declared period or permitted currency list, repeated policy references, absent expected periods and lines whose mapped fields are missing. Which of the supplied columns carries which measure is a caller declaration, as are the standard label and version, which are pinned into the artifact and shown on screen: no field list, schema, rate table or commission table is bundled or read, and nothing claims which revision of any standard is current, so a later revision makes an old receipt dated rather than wrong. The arithmetic reads only mapped numeric and reference columns. Every other column is ignored and reaches no result, and no rejection record echoes a cell value, so insured names, addresses and claim narratives stay out of the computed output. Money is fixed point in integer minor units with two decimal display throughout, decimal input is parsed from its string form rather than by floating point, and zero rows, an empty mapping and a zero limit each resolve to a defined result rather than to a not a number. Absent asserted totals the run is reported as recompute only, which is its own state and never a pass. Stated boundary: a difference means the two arithmetics disagree on the rows supplied, not that the coverholder misreported. It performs no data standard conformance validation, no terms of business or sanctions screening, no reserving or pricing adequacy assessment, and makes no assertion that authority was properly exercised, which is a conclusion for the delegated authority audit.

- Page: https://ainumbers.co/chaingraph/art-508-recompute-bordereau.html
- Markdown twin: https://ainumbers.co/chaingraph/art-508-recompute-bordereau.md
- MCP tool: recompute_bordereau (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "period_label": "2025-07 monthly premium bordereau",
  "bordereau_class": "premium",
  "standard_label": "Coverholder premium bordereau layout as agreed in the binding authority",
  "standard_version": "2025-04 revision",
  "amounts_in": "major_units",
  "field_mapping": {
    "policy_ref": "Unique Market Reference",
    "period": "Reporting Period",
    "inception_date": "Risk Inception Date",
    "currency": "Settlement Currency",
    "gross_premium": "Gross Written Premium",
    "brokerage": "Brokerage Amount",
    "coverholder_commission": "Coverholder Commission Amount",
    "ceded": "Reinsurance Ceded Premium",
    "net": "Net Premium Due To Carrier",
    "sum_insured": "Limit Of Liability",
    "taxes": [
      "IPT Amount",
      "Levy Amount"
    ]
  },
  "rows": [
    {
      "Unique Market Reference": "B1234SYN0001",
      "Reporting Period": "2025-07",
      "Risk Inception Date": "2025-07-04",
      "Settlement Currency": "GBP",
      "Gross Written Premium": "10000.00",
      "Brokerage Amount": "1000.00",
      "Coverholder Commission Amount": "1500.00",
      "Reinsurance Ceded Premium": "2000.00",
      "IPT Amount": "1200.00",
      "Levy Amount": "35.00",
      "Net Premium Due To Carrier": "4265.00",
      "Limit Of Liability": "500000.00",
      "Insured Name": "Wilhelmina Ashgrove-Pettifer",
      "Insured Address": "14 Nonesuch Lane, Blythebury",
      "Claim Narrative": "Escape of water from a first floor bathroom"
    },
    {
      "Unique Market Reference": "B1234SYN0002",
      "Reporting Period": "2025-07",
      "Risk Inception Date": "2025-07-19",
      "Settlement Currency": "GBP",
      "Gross Written Premium": "2500.55",
      "Brokerage Amount": "250.05",
      "Coverholder Commission Amount": "375.00",
      "Reinsurance Ceded Premium": "0.00",
      "IPT Amount": "300.07",
      "Levy Amount": "8.75",
      "Net Premium Due To Carrier": "1566.68",
      "Limit Of Liability": "250000.00",
      "Insured Name": "Cornelius Vandersloot",
      "Insured Address": "2 Quiddity Row, Farthinghoe"
    },
    {
      "Unique Market Reference": "B1234SYN0003",
      "Reporting Period": "2025-07",
      "Risk Inception Date": "2025-07-22",
      "Settlement Currency": "EUR",
      "Gross Written Premium": "4000.00",
      "Brokerage Amount": "400.00",
      "Coverholder Commission Amount": "600.00",
      "Reinsurance Ceded Premium": "0.00",
      "IPT Amount": "0.00",
      "Levy Amount": "0.00",
      "Net Premium Due To Carrier": "3000.00",
      "Limit Of Liability": "100000.00",
      "Insured Name": "Perpetua Quillfeather"
    }
  ],
  "asserted_totals": [
    {
      "currency": "GBP",
      "gross_premium": "12500.55",
      "brokerage": "1250.05",
      "coverholder_commission": "1875.00",
      "taxes": "1543.82",
      "ceded": "2000.00",
      "net": "5831.68"
    },
    {
      "currency": "EUR",
      "gross_premium": "4000.00",
      "net": "3000.00"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_bordereau` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
