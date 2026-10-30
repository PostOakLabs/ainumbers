# Control Test Exception Disposition Check

Check SOX 404 / ICFR control-test exceptions in three independent runs plus a session receipt: plan an attribute sample from caller-declared policy inputs and a caller-declared population hash (ART-458), reconcile a caller-declared sample and per-item test results into a test conclusion with an exception list (ART-461), then assemble a signed workpaper bundle that records a disposition for each exception, grouped by control (ART-465), closing with a session receipt aggregating the run execution hashes (CRY-05). Each run is an independent recompute from its own declared inputs. The bundle records that a disposition was declared. It does not judge whether a disposition was correct. Population hash is carried between runs as a declared field. It is not cross-verified by any kernel in this chain. This chain is a workpaper completeness check. It is not a severity verdict and not an audit opinion.

- Page: https://ainumbers.co/chaingraph/chains/control-test-exception-disposition-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/control-test-exception-disposition-check.md

## Workflow chain: Control Test Exception Disposition Check

Check SOX 404 / ICFR control-test exceptions in three independent runs plus a session receipt: plan an attribute sample from caller-declared policy inputs and a caller-declared population hash (ART-458), reconcile a caller-declared sample and per-item test results into a test conclusion with an exception list (ART-461), then assemble a signed workpaper bundle that records a disposition for each exception, grouped by control (ART-465), closing with a session receipt aggregating the run execution hashes (CRY-05). Each run is an independent recompute from its own declared inputs. The bundle records that a disposition was declared. It does not judge whether a disposition was correct. Population hash is carried between runs as a declared field. It is not cross-verified by any kernel in this chain. This chain is a workpaper completeness check. It is not a severity verdict and not an audit opinion.

Domain: SOX 404 / ICFR

### Steps

1. art-458-attribute-sampling-plan
   Plans an attribute sample from caller-declared confidence level, tolerable deviation rate, expected deviation rate, population size and population hash, using deterministic interval sampling. The plan names sample size, interval, start offset and selected indices. It selects items only. It tests nothing.
2. art-461-control-test-evidence-composer
   Reconciles a caller-declared sample and per-item test results into a test conclusion, exception count and exception items for a declared control and reporting period. An exception count above zero flags a deficiency candidate only, with classification_pending true and reason_code null, because severity classification is a human reviewer approval record. The run records the tester under the preparer role and carries a fixed review_required gate.
3. art-465-workpaper-bundle-composer
   Assembles a workpaper bundle from a caller-declared procedure id, population hash, kernel artifacts and exception dispositions, with preparer, reviewer and partner sign-off roles. The bundle records that a disposition was declared for each exception, per item and per control group. It does not judge whether a disposition was correct. Acceptance basis, quoted from the art-465 node shard description: the bundle takes the prior substantive-recalculation kernels execution-hash artifacts (art-462 JE rule screen, art-463 recalc suite, art-464 confirmation matcher, or any other procedure kernel). Art-461 is used here as that other procedure kernel.
4. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run execution hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A management-review control was tested in 2026-Q3 and one item failed. Are all exceptions dispositioned in the signed bundle, and what does it record?
Run the AINumbers MCP tool `run_chain` with {"chain":"control-test-exception-disposition-check"} and read `art-465-workpaper-bundle-composer.disposed_exception_count`.
Re-run with `inputs` for `art-465-workpaper-bundle-composer`, reusing the values that result echoed, with `exceptions` changed so the failed item carries no disposition, so the bundle flags an undisposed exception. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/control-test-exception-disposition-check.html
