# ASC 280 Reportable Segment Tester

Applies the ASC 280-10-50-12 quantitative thresholds to one caller-declared candidate operating segment and computes the ASC 280-10-50-14 seventy-five percent coverage test, reporting each of the three ten percent tests separately with its own denominator. The three tests do not share a denominator: the revenue test runs the segment's revenue including intersegment sales or transfers against combined internal and external revenue of all reported operating segments, the profit-or-loss test runs the absolute amount of the segment's reported profit or loss against the greater in absolute amount of the combined profit of segments that did not report a loss and the combined loss of segments that did, and the assets test runs segment assets against combined assets of all operating segments. Netting the two profit-or-loss sides together, a plausible misreading, produces a smaller denominator and over-flags segments, so the denominator side actually used is reported. Thresholds are inclusive, and every comparison is made by exact cross multiplication on unrounded inputs rather than by rounding a percentage first, so a value sitting exactly on ten or seventy-five percent classifies as meeting it instead of being pushed under by binary floating point; reported percentages are rounded for display only, strictly after every comparison. The five ASC 280-10-50-11 aggregation criteria are echoed back as nullable booleans and are never computed or guessed by this node, with unanswered criteria named individually and a management-judgment flag raised rather than read as false. A zero or non-positive denominator reports not_assessable for that test, never a failing threshold. Source of the rule is FASB Statement No. 131 paragraphs 17, 18, 19 and 20 as carried into the Codification; ASU 2023-07 does not amend these paragraphs, which its own amendment instruction and scope statement both confirm. Verify-only: does not identify operating segments, does not aggregate them, does not decide the chief operating decision maker question, and does not assert that an entity's segment note is compliant.

- Page: https://ainumbers.co/chaingraph/art-633-asc280-reportable-segment-tester.html
- Markdown twin: https://ainumbers.co/chaingraph/art-633-asc280-reportable-segment-tester.md
- MCP tool: test_asc280_reportable_segment (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- segment_revenue_external (number, required): Candidate segment external customer revenue
- segment_revenue_intersegment (number, optional): Candidate segment intersegment sales or transfers
- combined_revenue_all_reported_segments (number, required): Combined internal and external revenue of all reported operating segments
- segment_profit_or_loss (number, required): Candidate segment reported profit or loss, signed
- combined_profit_of_profitable_segments (number, required): Combined reported profit of segments that did not report a loss
- combined_loss_of_loss_segments (number, required): Combined reported loss of segments that did report a loss
- segment_assets (number, required): Candidate segment assets
- combined_assets_all_segments (number, required): Combined assets of all operating segments
- reportable_external_revenue (number, required): Cumulative external revenue of reportable segments
- total_consolidated_revenue (number, required): Total consolidated revenue
- aggregation_similar_products_services (boolean,null, optional): Aggregation criterion (a), echoed only
- aggregation_similar_production_processes (boolean,null, optional): Aggregation criterion (b), echoed only
- aggregation_similar_customer_type (boolean,null, optional): Aggregation criterion (c), echoed only
- aggregation_similar_distribution_methods (boolean,null, optional): Aggregation criterion (d), echoed only
- aggregation_similar_regulatory_environment (boolean,null, optional): Aggregation criterion (e), echoed only
- reportable_segment_count (number,null, optional): Optional, drives the practical-limit advisory only

## Outputs

- is_reportable_by_quantitative_threshold (boolean, optional)
- tests_met (array, optional)
- tests_not_assessable (array, optional)
- tests (array, optional)
- coverage_75_pct (object, optional)
- aggregation_criteria (object, optional)
- unanswered_aggregation_criteria (array, optional)
- management_judgment_required (boolean, optional)
- aggregation_criteria_answered_count (number, optional)
- aggregation_criteria_met_count (number, optional)
- majority_of_criteria_met (boolean, optional)
- reportable_segment_count (number,null, optional)
- practical_limit_consideration_advised (boolean, optional)
- threshold_pct (number, optional)
- coverage_threshold_pct (number, optional)
- comparison_basis (string, optional)
- rounding_steps (string, optional)
- oracle (string, optional)
- regulatory_basis (string, optional)
- note (string, optional)

## Sample

```json
{
  "segment_revenue_external": 60,
  "segment_revenue_intersegment": 40,
  "combined_revenue_all_reported_segments": 1000,
  "segment_profit_or_loss": 10,
  "combined_profit_of_profitable_segments": 200,
  "combined_loss_of_loss_segments": -50,
  "segment_assets": 400,
  "combined_assets_all_segments": 5000,
  "reportable_external_revenue": 675,
  "total_consolidated_revenue": 900,
  "aggregation_similar_products_services": true,
  "aggregation_similar_production_processes": true,
  "aggregation_similar_customer_type": true,
  "aggregation_similar_distribution_methods": true,
  "aggregation_similar_regulatory_environment": true,
  "reportable_segment_count": 4
}
```

## Verify

Run the sample policy_parameters through MCP tool `test_asc280_reportable_segment` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
