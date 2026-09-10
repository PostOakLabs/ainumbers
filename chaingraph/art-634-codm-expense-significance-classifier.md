# CODM Significant Expense Classifier

Classifies one candidate segment expense under the significant expense principle that ASU 2023-07 added to ASC 280, returning whether it is separately disclosable under ASC 280-10-50-26A, whether it folds into other segment items under ASC 280-10-50-26B and through which of that paragraph's buckets, or whether it sits outside the principle entirely, together with the exact paragraphs cited and a plain basis sentence. Two things the Update does not supply are therefore not invented here. It closes no list of expense category names: ASC 280-10-50-26A directs an entity to identify the expenses in its own chief operating decision maker reporting first and then disclose the significant ones, so the category vocabulary is entity specific and category name is not an input. It states no quantitative significance benchmark, requiring instead that qualitative and quantitative factors be weighed, so significance arrives as a caller declared judgment and is never computed here. The one enum the clause genuinely closes is ASC 280-10-50-22's specified items, whose subparagraphs run (a) through (j) with (i) superseded by ASU 2015-01, leaving 9 live members. The declared domain is 4 booleans x 10 specified item values, counting the 9 live items plus none, for 160 states, every one of them enumerated. Evaluation under ASC 280-10-50-26A turns on a disjunction, not a single test: an expense easily computable from information regularly provided to the chief operating decision maker is evaluated alongside one that is regularly provided, which is what ASC 280-10-55-15A and 55-15B provide and where the Update's own cost of sales worked example lives. Nothing inside the reported measure of segment profit or loss is ever excluded entirely, because ASC 280-10-50-26B defines other segment items as a reconciling residual and its bucket (a) captures precisely the expense that is not regularly provided. The buckets of ASC 280-10-50-26B are reported as an array rather than a single value because that paragraph says other segment items may include them and they overlap by design. ASC 280-10-50-22 is reported separately and reaches further than the significant expense principle does, since it applies when a specified amount is included in the measure of segment profit or loss or is otherwise regularly provided even if not included in that measure. Performs no arithmetic at all: no ratio, no scale, no threshold compare, no rounding. Verify only: does not identify operating segments, does not apply the ASC 280-10-50-12 thresholds or the ASC 280-10-50-14 coverage test, does not determine the chief operating decision maker, does not compute segment profit or loss or the other segment items amount, does not author the qualitative description ASC 280-10-50-26B requires, and does not assert that an entity's segment note is compliant.

- Page: https://ainumbers.co/chaingraph/art-634-codm-expense-significance-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-634-codm-expense-significance-classifier.md
- MCP tool: classify_codm_expense_significance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- included_in_segment_profit_measure (boolean, optional)
- regularly_provided_to_codm (boolean, optional)
- easily_computable_from_codm_information (boolean, optional)
- assessed_significant (boolean, optional)
- specified_item_50_22 (string, optional)

## Outputs

- included_in_segment_profit_measure (boolean, optional)
- regularly_provided_to_codm (boolean, optional)
- easily_computable_from_codm_information (boolean, optional)
- assessed_significant (boolean, optional)
- specified_item_50_22 (string, optional)
- input_outside_declared_domain (boolean, optional)
- evaluated_under_50_26A (boolean, optional)
- must_disclose_separately_50_26A (boolean, optional)
- folds_into_other_segment_items_50_26B (boolean, optional)
- other_segment_items_buckets (array, optional)
- outside_significant_expense_principle (boolean, optional)
- separate_disclosure_required_50_22 (boolean, optional)
- citation (string, optional)
- basis (string, optional)
- segment_level_duties_not_decided_here (string, optional)
- bucket_c_scope_note (string, optional)

## Sample

```json
{
  "included_in_segment_profit_measure": true,
  "regularly_provided_to_codm": false,
  "easily_computable_from_codm_information": true,
  "assessed_significant": true,
  "specified_item_50_22": "none"
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_codm_expense_significance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
