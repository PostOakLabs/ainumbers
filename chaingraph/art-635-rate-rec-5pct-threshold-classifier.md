# Rate Reconciliation 5% Threshold Classifier

Applies the quantitative 5 percent threshold of ASC 740-10-50-12A(b), as amended by FASB Accounting Standards Update No. 2023-09, to one candidate rate reconciliation item. Takes the signed effect of the item, continuing operations pretax income, the applicable statutory federal or national rate of the domicile jurisdiction, the reconciling item category and whether the filer is a public business entity; returns the item as a percentage of the threshold base, a crossing flag, the separate disclosure consequence, and the disaggregation 740-10-50-12A(b) requires of that category. The comparison is taken in absolute amount on BOTH sides, which is stated at BC35 of the Update and corroborated by 740-10-50-12A(b)(2) requiring separate disclosure where an item's gross amount, positive or negative, meets the threshold. That is what makes the test well defined for a loss making entity, so a negative pretax income is ordinary here rather than degenerate. The category enum has nine members, not eight: 740-10-50-12A(a) closes a list of eight, and 740-10-50-12A(b)(3) separately addresses an item within none of them, which an eight member enum could not express. The arithmetic fact and the legal consequence are separate fields because 740-10-50-12A applies to a public business entity while 740-10-50-13 gives other entities a qualitative requirement and no numerical reconciliation. rounding_steps is none before comparison: every verdict is decided by exact cross multiplication on unrounded inputs, never by rounding a percentage and then comparing, and the reported percentage is computed after the verdict and never feeds it. A zero threshold base is reported as not assessable with a named caveat rather than divided silently, because BC38 records that the Board considered and declined to give guidance for the break even and no or minimal rate cases; for the same reason this node draws no numeric break even band. Zero network calls: it does not compute the rate reconciliation, does not determine the statutory rate, does not decide an item's category, does not choose the level of aggregation at which the threshold is applied, and does not apply the separate income taxes paid test of ASC 740-10-50-23.

- Page: https://ainumbers.co/chaingraph/art-635-rate-rec-5pct-threshold-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-635-rate-rec-5pct-threshold-classifier.md
- MCP tool: classify_rate_rec_5pct_threshold (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- reconciling_item_category (string, optional)
- reconciling_item_amount (number, required)
- pretax_income (number, required)
- statutory_rate_pct (number, required)
- entity_is_public_business_entity (boolean, optional)

## Outputs

- reconciling_item_category (string,null, optional)
- category_recognized (boolean, optional)
- reconciling_item_amount (number,null, optional)
- pretax_income (number,null, optional)
- statutory_rate_pct (number,null, optional)
- entity_is_public_business_entity (boolean, optional)
- threshold_base_amount (number,null, optional)
- threshold_amount (number,null, optional)
- pct_of_threshold_base (number,null, optional)
- crosses_5pct_threshold (boolean,null, optional)
- must_disclose_separately (boolean,null, optional)
- required_disaggregation (string,null, optional)
- disaggregation_citation (string,null, optional)
- denominator_near_zero_caveat (string,null, optional)
- management_judgment_required (boolean, optional)
- not_assessable_reason (string,null, optional)
- break_even_judgment_note (string, optional)
- citation (string, optional)
- basis (string, optional)

## Sample

```json
{
  "reconciling_item_category": "tax_credits",
  "reconciling_item_amount": 10.5,
  "pretax_income": 1000,
  "statutory_rate_pct": 21,
  "entity_is_public_business_entity": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_rate_rec_5pct_threshold` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
