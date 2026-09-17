# Model Validation Replication Cycle

Two-step validation cycle over a declared model specification, its stated inputs and its reported outputs, routed in through the shipped workbook bridge. Step 1 recomputes the reported outputs independently and returns a per-record and aggregate tolerance diff with the failing segment named, so an independent party reruns the model offline and reaches the same verdict. Step 2 runs the deterministic-given-data battery - discriminatory power, population and characteristic stability, back-test outcome against predicted, and calibration comparison - each scored against policy-supplied thresholds. Step 1 is gated hold whenever replication does not succeed, including the honest not-replicable-as-specified verdict. Step 2 is gated dual_control(2) for validation sign-off, where counting distinct approver identities is what mechanically evidences that the validator is independent of the developer; a test breach holds the sign-off for review. The model owner is bound as a separate role on the subject artifact so owner and validator are named apart. This surface evidences replication and testing only. It states no validation opinion, no view on conceptual soundness or fitness for use, and no sufficiency claim under any supervisory model-risk guidance.

- Page: https://ainumbers.co/chaingraph/chains/model-validation-cycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/model-validation-cycle.md

## Workflow chain: Model Validation Replication Cycle

Two-step validation cycle over a declared model specification, its stated inputs and its reported outputs, routed in through the shipped workbook bridge. Step 1 recomputes the reported outputs independently and returns a per-record and aggregate tolerance diff with the failing segment named, so an independent party reruns the model offline and reaches the same verdict. Step 2 runs the deterministic-given-data battery - discriminatory power, population and characteristic stability, back-test outcome against predicted, and calibration comparison - each scored against policy-supplied thresholds. Step 1 is gated hold whenever replication does not succeed, including the honest not-replicable-as-specified verdict. Step 2 is gated dual_control(2) for validation sign-off, where counting distinct approver identities is what mechanically evidences that the validator is independent of the developer; a test breach holds the sign-off for review. The model owner is bound as a separate role on the subject artifact so owner and validator are named apart. This surface evidences replication and testing only. It states no validation opinion, no view on conceptual soundness or fitness for use, and no sufficiency claim under any supervisory model-risk guidance.

Domain: Bank Capital & Credit Risk

### Steps

1. art-488-model-replication-diff
   Replication verdict, per-record and aggregate tolerance diff and the failing segments feed the quantitative test battery
2. art-489-model-test-battery
   Per-test pass or breach against the declared thresholds, each labelled with its standard name, closes the validation evidence bundle under dual control. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
