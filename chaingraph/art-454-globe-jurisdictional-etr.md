# GloBE Jurisdictional ETR Calculator

Computes a jurisdiction's OECD Pillar Two (GloBE) effective tax rate from caller-declared constituent-entity financial data: sums entity-level GloBE income/loss to a jurisdictional net (Art 3.1), sums entity-level adjusted covered taxes (Art 4), and divides to get the ETR. If the jurisdictional net is a GloBE loss, no ETR is computed and the jurisdiction is flagged rather than divided by a non-positive base. Top-up tax percentage = max(0, minimum_rate - ETR); minimum_rate defaults to the Art 5.1 15% rate but is taken as a versioned policy-parameter input, not hardcoded. Election flags (de minimis, stock-based comp, aggregate deferred-tax adjustment) are caller-declared policy parameters - this kernel echoes which elections were declared, it does not decide them; election judgment and DTA characterization stay with the filer. First node in the GloBE annual cycle, feeding the substance-based income exclusion / top-up node (art-455) and, downstream, the safe-harbour tests (art-456) and GIR composer (art-457). Pure arithmetic aggregation only. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-454-globe-jurisdictional-etr.html
- Markdown twin: https://ainumbers.co/chaingraph/art-454-globe-jurisdictional-etr.md
- MCP tool: compute_globe_jurisdictional_etr (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- aggregate_deferred_tax_adjustment (boolean, required)
- de_minimis_election (boolean, required)
- entities (array, required)
- jurisdiction_name (unknown, required)
- minimum_rate (number, required)
- stock_based_comp_election (boolean, required)

## Outputs

- adjusted_covered_taxes (integer, optional)
- declared_elections (object, optional)
- entities (array, optional)
- entity_count (integer, optional)
- etr (number, optional)
- jurisdiction_name (string, optional)
- jurisdictional_globe_income (integer, optional)
- minimum_rate (number, optional)
- net_globe_income_or_loss (integer, optional)
- no_etr_computed (boolean, optional)
- top_up_tax_amount (integer, optional)
- top_up_tax_percentage (number, optional)

## Sample

```json
{
  "jurisdiction_name": "Ruritania",
  "minimum_rate": 0.15,
  "entities": [
    {
      "entity_name": "Ruritania OpCo 1",
      "net_income_or_loss": 600000,
      "covered_taxes": 60000
    },
    {
      "entity_name": "Ruritania OpCo 2",
      "net_income_or_loss": 300000,
      "covered_taxes": 30000
    },
    {
      "entity_name": "Ruritania HoldCo",
      "net_income_or_loss": 100000,
      "covered_taxes": 10000
    }
  ],
  "de_minimis_election": false,
  "stock_based_comp_election": false,
  "aggregate_deferred_tax_adjustment": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_globe_jurisdictional_etr` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
