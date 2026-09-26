# ISA 530 Audit Sampling + MUS

Deterministic audit-sampling arithmetic in three caller-declared functions dispatched on method. monetary_unit_sampling sizes a MUS engagement: n = ceil(book_value * confidence_factor / (performance_materiality - expected_misstatement)) and sampling interval = round(book_value / n), failing closed whenever expected_misstatement >= performance_materiality. misstatement_projection applies the tainting method to caller-supplied sampled items (taint = (book - audited) / book, projected misstatement = sum of taint * interval) and adds the basic-precision figure confidence_factor * interval. benford_screen compares the observed first-significant-digit distribution of caller-supplied positive amounts against the Benford expected proportions with a chi-square deviation flag at the 5% level (8 degrees of freedom, critical value 15.507). The method's source standard is ISA 530 (iaasb.org): this node computes the arithmetic of the method and never certifies compliance with any standard, never opines on audit sufficiency, and never selects sample items. No randomness of any kind: the tool performs no selection logic, and any selection start point a caller uses is a caller-declared input, never generated here. Absent, non-numeric, or out-of-domain inputs resolve to INPUT_REJECTED with the field named, never guessed or defaulted.

- Page: https://ainumbers.co/chaingraph/art-693-isa530-audit-sampling-mus.html
- Markdown twin: https://ainumbers.co/chaingraph/art-693-isa530-audit-sampling-mus.md
- MCP tool: compute_isa530_audit_sampling_mus (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- method (string, required)
- book_value (number, optional)
- performance_materiality (number, optional)
- expected_misstatement (number, optional)
- confidence_factor (number, optional)
- sampling_interval (integer, optional)
- sampled_items (array, optional)
- amounts (array, optional)

## Outputs

- sample_size (integer,null, optional)
- sampling_interval (integer,null, optional)
- tolerable_misstatement (number,null, optional)
- confidence_factor (number,null, optional)
- item_count (integer, optional)
- usable_item_count (integer, optional)
- usable_count (integer, optional)
- per_item (array, optional)
- projected_misstatement (number,null, optional)
- basic_precision (number,null, optional)
- basic_precision_note (string, optional)
- first_digit_counts (object,null, optional)
- chi_square_statistic (number,null, optional)
- critical_value (number, optional)
- deviation_flag (boolean,null, optional)
- trace (string, required)
- overall (string, required)
- warnings (array, optional)

## Sample

```json
{
  "method": "monetary_unit_sampling",
  "book_value": 5000000,
  "performance_materiality": 250000,
  "expected_misstatement": 50000,
  "confidence_factor": 3
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_isa530_audit_sampling_mus` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
