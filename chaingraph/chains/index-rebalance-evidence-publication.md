# Index Rebalance Evidence Publication Check

Prove an index rebalance in five independent runs plus a session receipt: record a caller-declared constituent set as of a stated date (ART-557), compute a weight per constituent under a stated methodology from caller-supplied input rows (ART-645), compile one rebalance event into a pack diffing current against prior constituent and weight rows and citing the step 1 and step 2 receipts (ART-646), publish the pack as one sequence-numbered head-commit event for the index stream (ART-658), closing with a session receipt aggregating the run execution hashes (CRY-05). Every constituent row, input row, methodology, and verification claim is caller-supplied and asserted, never fetched; each run is an independent recompute from its own declared inputs. This chain attests declared inputs in sequence, it does not verify them against market data, and it is not a live index feed.

- Page: https://ainumbers.co/chaingraph/chains/index-rebalance-evidence-publication.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/index-rebalance-evidence-publication.md

## Workflow chain: Index Rebalance Evidence Publication Check

Prove an index rebalance in five independent runs plus a session receipt: record a caller-declared constituent set as of a stated date (ART-557), compute a weight per constituent under a stated methodology from caller-supplied input rows (ART-645), compile one rebalance event into a pack diffing current against prior constituent and weight rows and citing the step 1 and step 2 receipts (ART-646), publish the pack as one sequence-numbered head-commit event for the index stream (ART-658), closing with a session receipt aggregating the run execution hashes (CRY-05). Every constituent row, input row, methodology, and verification claim is caller-supplied and asserted, never fetched; each run is an independent recompute from its own declared inputs. This chain attests declared inputs in sequence, it does not verify them against market data, and it is not a live index feed.

Domain: Securities Compliance & Corporate Governance

### Steps

1. art-557-record-index-constituents
   Records a caller-declared constituent set as of a stated date, with its own execution_hash. Every constituent row, the eligibility-criteria description, and the selection universe size are caller-supplied and asserted, never fetched. This step attests that a declared set exists exactly as stated, never whether the criteria were applied correctly against market data.
2. art-645-compute-index-weights
   Computes a weight per constituent under a stated methodology from caller-supplied input rows, with weight_sum_check within 1e-9 of 1.0, and its own execution_hash. The step 2 run cites the step 1 receipt by execution_hash plus tool_id as a receipt citation; it does not re-derive the step 1 constituent set, and it does not verify that its input list matches any particular constituent-set attestation.
3. art-646-compile-rebalance-evidence-pack
   Compiles one rebalance event into a pack: current and prior constituent and weight rows, diffed into additions, removals and weight deltas, citing the step 1 and step 2 receipts by execution_hash plus tool_id. The step 1 to step 2 to step 3 links are receipt citations, not declared graph edges. The pack does not re-run or independently re-derive the cited arithmetic, and a reviewer must check the cited hashes against the step 1 and step 2 receipts as a manual check.
4. art-658-publish-index-head
   Publishes one sequence-numbered head-commit event for the index stream, with head_hash independently recomputed by SHA-256 and seq and prev_head_hash checked. signature_valid and chain_valid are the caller's own verification claim, asserted and digested into this receipt; this node never handles private key material and never itself runs an Ed25519 verify, and head_hash is not proof of signing. A head-file tip proves the signer's claimed stream tip at that seq; it does not detect a signer publishing conflicting levels elsewhere.
5. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run execution hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: For the example index, what weights follow from the declared market caps, and what does the rebalance pack record?
Run the AINumbers MCP tool `run_chain` with {"chain":"index-rebalance-evidence-publication"} and read `art-646-compile-rebalance-evidence-pack.weight_deltas`.
Re-run with `inputs` for `art-646-compile-rebalance-evidence-pack`, reusing the values that result echoed, with `current` changed so a different current constituent set and weight set are declared. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/index-rebalance-evidence-publication.html
