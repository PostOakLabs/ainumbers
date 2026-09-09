# GloBE Permanent De Minimis Exclusion Evaluator

Recomputes the PERMANENT GloBE de minimis exclusion of Article 5.5 of the OECD GloBE Model Rules (Pillar Two, December 2021) from per-year figures the caller supplies. This is a different rule from the transitional CbCR safe harbour de minimis test, which is a single-year test taken from the Qualified CbCR and is already computed by art-456-globe-safe-harbour-tests; this node does not recompute that test. Article 5.5.2 averages the GloBE Revenue and the GloBE Income or Loss of a jurisdiction across the current and the two preceding Fiscal Years, and Article 5.5.1 then compares those averages against two thresholds: the Average GloBE Revenue must be less than EUR 10 million, and the Average GloBE Income or Loss must be a loss or less than EUR 1 million. Both thresholds and the averaging window length arrive as versioned policy parameters carrying their own source and source digest, never as constants in kernel source, so a later threshold change is a parameter-set version bump rather than a kernel edit. A GloBE Loss year enters the average as a signed negative amount, per Article 5.5.3(b) and Commentary paragraphs 84 and 91, and is never coerced to zero. A preceding Fiscal Year in which no Constituent Entities had GloBE Revenue or GloBE Losses is excluded from the computation under Article 5.5.2's second sentence, which shrinks the divisor rather than contributing a zero; a jurisdiction in scope for fewer years than the window is an ordinary case and is reported as partial_window_used. The per-year input array is bounded by a declared and enforced max_years. Both conditions must hold together, which Commentary paragraph 81 states as aggregate and cumulative. The Article 5.5.1 Annual Election is the Filing Constituent Entity's judgment and enters only as a declared input that the node echoes back; a deemed-zero result is reported only where the election was declared made, and it is a recomputed arithmetic outcome on declared inputs rather than a filing conclusion. Any absent year, absent threshold parameter or undeclared election raises manual_review_required and withholds the availability verdict, and no missing value is ever silently defaulted. Annualisation of short Fiscal Years, conversion into euro, and the Article 5.5.4 removal of Stateless Constituent Entities and Investment Entities are applied upstream by the caller and declared to this node. Verify-only: the node recomputes declared arithmetic and reports whether it matches or diverges. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-637-globe-de-minimis-exclusion.html
- Markdown twin: https://ainumbers.co/chaingraph/art-637-globe-de-minimis-exclusion.md
- MCP tool: evaluate_globe_de_minimis_exclusion (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- de_minimis_parameters (unknown, required)
- election_made (unknown, required)
- fiscal_year (number, required)
- jurisdiction (unknown, required)
- max_years (number, required)
- stateless_and_investment_entities_excluded (boolean, required)
- years (array, required)
- years_jurisdiction_in_scope (number, required)

## Outputs

- average_globe_income_eur (integer, optional)
- average_globe_income_is_loss (boolean, optional)
- average_globe_revenue_eur (integer, optional)
- averaging_window_years (integer, optional)
- de_minimis_available (boolean, optional)
- deemed_zero_topup (boolean, optional)
- election_made (boolean, optional)
- fiscal_year (integer, optional)
- income_test_met (boolean, optional)
- jurisdiction (string, optional)
- manual_review_required (boolean, optional)
- max_years_enforced (integer, optional)
- notes (array, optional)
- parameter_set_version (string, optional)
- partial_window_used (boolean, optional)
- revenue_test_met (boolean, optional)
- thresholds_applied (object, optional)
- years_evaluated (array, optional)
- years_excluded_no_constituent_entities (integer, optional)
- years_included (integer, optional)

## Sample

```json
{
  "jurisdiction": "Jurisdiction B",
  "fiscal_year": 2026,
  "max_years": 3,
  "years_jurisdiction_in_scope": 3,
  "election_made": true,
  "stateless_and_investment_entities_excluded": true,
  "de_minimis_parameters": {
    "parameter_set_version": "oecd-globe-model-rules-2021-12",
    "averaging_window_years": {
      "value": 3,
      "effective_from": "2021-12-20",
      "effective_to": null,
      "source": "OECD GloBE Model Rules (Pillar Two), December 2021, Article 5.5.2",
      "source_digest": "sha256:796d1a16fad360204a76450f5246e038263ef4bc652356f25d367d4b9389e306"
    },
    "revenue_threshold_eur": {
      "value": 10000000,
      "effective_from": "2021-12-20",
      "effective_to": null,
      "source": "OECD GloBE Model Rules (Pillar Two), December 2021, Article 5.5.1(a)",
      "source_digest": "sha256:796d1a16fad360204a76450f5246e038263ef4bc652356f25d367d4b9389e306"
    },
    "income_threshold_eur": {
      "value": 1000000,
      "effective_from": "2021-12-20",
      "effective_to": null,
      "source": "OECD GloBE Model Rules (Pillar Two), December 2021, Article 5.5.1(b)",
      "source_digest": "sha256:796d1a16fad360204a76450f5246e038263ef4bc652356f25d367d4b9389e306"
    }
  },
  "years": [
    {
      "fiscal_year": 2024,
      "globe_revenue_eur": 2000000,
      "globe_income_or_loss_eur": 100000
    },
    {
      "fiscal_year": 2025,
      "globe_revenue_eur": 1000000,
      "globe_income_or_loss_eur": 100000
    },
    {
      "fiscal_year": 2026,
      "globe_revenue_eur": 3000000,
      "globe_income_or_loss_eur": -200000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `evaluate_globe_de_minimis_exclusion` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
