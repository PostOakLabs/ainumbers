# Workpaper Bundle Composer

Terminal composer for a substantive-procedure evidence bundle: a procedure identifier, a caller-declared population hash, the prior substantive-recalculation kernels' execution-hash artifacts (art-462 JE rule screen, art-463 recalc suite, art-464 confirmation matcher, or any other procedure kernel), an exception list with disposition inputs, and three declared sign-off roles (preparer, reviewer, partner). Mints no new judgment - it does not re-run upstream kernels, does not recompute the population hash, and does not decide whether an exception is resolved, only whether a disposition was declared for it. Exception disposition is recorded as an approval record with a reason_code, never a silent close. Partner release is single-signer but always tagged gate_status review_required per the §27 Human Accountability vocabulary - this node records that a release occurred; it does not enforce countersignature. Second of two ARCB-K-2 kernels. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-465-workpaper-bundle-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-465-workpaper-bundle-composer.md
- MCP tool: compose_workpaper_bundle (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- exceptions (unknown, required)
- kernel_artifacts (unknown, required)
- partner (unknown, required)
- population_hash (unknown, required)
- preparer (unknown, required)
- procedure_id (unknown, required)
- reviewer (unknown, required)

## Outputs

- disposed_exception_count (integer, optional)
- exception_count (integer, optional)
- exceptions (array, optional)
- kernel_artifact_count (integer, optional)
- kernel_artifacts (array, optional)
- malformed_kernel_artifacts (array, optional)
- population_hash (string, optional)
- procedure_id (string, optional)
- roles (object, optional)
- undisposed_exceptions (array, optional)

## Sample

```json
{
  "procedure_id": "PROC-AR-CONFIRM-2026Q2",
  "population_hash": "sha256:aaaa1111bbbb2222",
  "kernel_artifacts": [
    {
      "tool_id": "art-462-je-ruleset-screen",
      "execution_hash": "1111aaaa"
    },
    {
      "tool_id": "art-463-recalc-suite",
      "execution_hash": "2222bbbb"
    },
    {
      "tool_id": "art-464-confirmation-matcher",
      "execution_hash": "3333cccc"
    }
  ],
  "exceptions": [
    {
      "item_id": "EXC-1",
      "reason_code": "TOLERANCE_EXCEEDED",
      "disposition": "ACCEPTED_IMMATERIAL",
      "disposed_by_role": "engagement_reviewer"
    }
  ],
  "preparer": {
    "role": "staff_auditor",
    "statement": "Prepared the substantive procedure workpapers for this area."
  },
  "reviewer": {
    "role": "engagement_reviewer",
    "statement": "Reviewed the prepared workpapers and disposed all noted exceptions."
  },
  "partner": {
    "role": "engagement_partner",
    "statement": "Released the area for reporting."
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compose_workpaper_bundle` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
