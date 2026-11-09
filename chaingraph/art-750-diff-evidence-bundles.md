# Diff Evidence Bundles

Evidence-bundle diff: takes two parsed JSON bundles (bundle_a = baseline, bundle_b = comparison) plus an optional as_of timestamp and reports, as values only, what moved between them. Inputs are classified the same way the estate's verification desk classifies them (OCG artifact carrying an execution_hash, chain given as a step-artifact array or a steps array, evidence bundle carrying a subject_hash without an execution_hash, or a records array); anything else is refused by throw with a named reason. Four comparison sections follow: hash- and digest-bearing fields (execution_hash, subject_hash, receipt hashes, chained workpaper hashes), version-bearing fields, a normalized human-accountability view (approval, rejection and override membership sets plus threshold or gate-policy fields, where a legacy records array, an embedded sign_off and the converged evidence-bundle shape all normalize to the same keys so a shape migration alone never surfaces as a diff row), and the verdict, taken from verification_result first, then explicit verdict-family fields, then derived from a checks array, with a regressed flag when the verdict moved toward fail, reject or hold. Nesting is capped at 200 levels for hostile-input safety. The one wall-clock read the source page performs (override freshness) is a caller-supplied as_of parameter here: it is required whenever an override record is present. The node ports the internal comparison math of the existing root page bundle-diff.html (kept untouched) so an MCP auditor gets an execution_hash-bearing result instead of a page-only view. compute_proof_ready is deferred; the kernel is pure structural comparison with no float arithmetic, no transcendentals and no loop bound taken from policy_parameters.

- Page: https://ainumbers.co/chaingraph/art-750-diff-evidence-bundles.html
- Markdown twin: https://ainumbers.co/chaingraph/art-750-diff-evidence-bundles.md
- MCP tool: compute_diff_evidence_bundles (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- bundle_a (object,array, required): Baseline: a parsed OCG artifact (execution_hash), a chain (steps), an evidence bundle (subject_hash, no execution_hash) or a records array. Required.
- bundle_b (object,array, required): Comparison bundle, same accepted shapes as bundle_a. Required.
- as_of (string, optional): ISO 8601 clock reading for override freshness; required when an override record is present.

## Outputs

- input_class_a (string, optional)
- input_class_b (string, optional)
- inputs_differ_in_class (boolean, optional)
- hashes (object, optional)
- versions (object, optional)
- human_accountability (object, optional)
- verdict (object, optional)
- changed_section_count (integer, optional)
- bundles_identical (boolean, optional)

## Sample

```json
{
  "bundle_a": {
    "tool_id": "art-699-example-check",
    "tool_version": "1.0.0",
    "chaingraph_version": "0.4.0",
    "execution_hash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    "output_payload": {
      "verdict": "PASS",
      "ratio": 0.75
    }
  },
  "bundle_b": {
    "tool_id": "art-699-example-check",
    "tool_version": "1.0.0",
    "chaingraph_version": "0.4.0",
    "execution_hash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    "output_payload": {
      "verdict": "PASS",
      "ratio": 0.75
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_diff_evidence_bundles` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
