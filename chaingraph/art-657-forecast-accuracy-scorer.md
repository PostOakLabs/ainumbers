# Forecast Accuracy Scorer

Scores a batch of resolved probabilistic forecasts (a stated probability paired with the realized yes/no outcome) using two textbook proper scoring rules - the Brier score and the logarithmic score - plus a Brier Skill Score against a caller-supplied reference forecast. Each forecast may optionally carry an informational subject-matter category label (economic indicator, election/political, sports competition, gaming-style event, weather/climate, or other) so results can be broken out per category in the output. Those category labels are descriptive grouping only, supplied by the caller: this node makes no determination of contract eligibility, legality, or regulatory status, and cites no specific rule. Scope limit: it scores calibration of already-resolved forecasts; it does not itself resolve markets, price contracts, or assess venue compliance.

- Page: https://ainumbers.co/chaingraph/art-657-forecast-accuracy-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-657-forecast-accuracy-scorer.md
- MCP tool: compute_forecast_accuracy_score (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- forecasts (array, required)
- reference_probability (number, optional)

## Outputs

- accuracy_class (string, required)
- base_rate (number, required)
- brier_reference (number, required)
- brier_score (number, required)
- brier_skill_score (number, required)
- category_breakdown (array, required)
- category_note (string, required)
- disclaimer (string, required)
- log_score (number, required)
- n (number, required)
- reference_probability (number, required)
- scoring_note (string, required)
- warnings (array, required)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_forecast_accuracy_score` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
