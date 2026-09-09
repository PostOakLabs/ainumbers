# Quantized Credit Model Scorer

Runs a fixed, int8-quantized logistic-regression-class credit-decisioning model as a pure integer inference kernel and returns the score it produced from the supplied normalized inputs. Proves that THIS fixed quantized model produced THIS score from THESE inputs. It is not a fairness attestation and not a model-quality certification, and the underlying model is a synthetic offline demand-test artifact, not fit for real regulatory credit decisioning. The quantization_parity block on the artifact records the float-vs-quantized agreement rate measured over 1000 held-out vectors.

- Page: https://ainumbers.co/chaingraph/art-348-score-credit-model-quantized.html
- Markdown twin: https://ainumbers.co/chaingraph/art-348-score-credit-model-quantized.md
- MCP tool: score_credit_model_quantized (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- normalized_fixp16 (array, required)

## Outputs

- accumulator_fixp (integer, optional)
- bits (integer, optional)
- decision (integer, optional)
- n_features (integer, optional)
- quant_method (string, optional)
- threshold_fixp (integer, optional)

## Sample

```json
{
  "normalized_fixp16": [
    -20129,
    99164,
    96151,
    113542,
    -79509,
    67994,
    46535,
    3936,
    -81611,
    -76625
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_credit_model_quantized` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
