# Beacon-Sampled Audit Testing

The audit-sampling ceremony as one hash-anchored composite: an item manifest is hashed and committed BEFORE a public randomness beacon pulse exists, the pulse then seeds a deterministic HMAC-DRBG selection (art-583), and the selected population is recomputed by the recompute node configured for the regime under test. The ordering is the whole point - a manifest committed before the pulse round cannot be reshaped to steer which items get drawn, and a pulse nobody controlled cannot be shopped for a friendlier sample. One generic chain, configured per regime: stage 2 is the prevailing-wage certified-payroll recompute (art-574) as the first instance, and stage 3 the multi-garnishment stacking recompute (art-572) as a second configuration of the identical ceremony. GATED (OCG Standard v0.8 §21.4): gate 1 on art-583's own /verdict, so a sample that did not derive stops the automated path rather than sending an unusable selection downstream; gate 2 on art-574's own /verdict, so a run whose declared population is not a certified payroll falls through to the garnishment configuration instead of ending on an empty prevailing-wage stage. Regime instances are configurations of these steps, not new nodes. The beacon pulse and its round are caller-declared throughout: no step fetches a pulse or checks a beacon signature.

- Page: https://ainumbers.co/chaingraph/chains/beacon-sampled-audit-testing.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/beacon-sampled-audit-testing.md

## Workflow chain: Beacon-Sampled Audit Testing

The audit-sampling ceremony as one hash-anchored composite: an item manifest is hashed and committed BEFORE a public randomness beacon pulse exists, the pulse then seeds a deterministic HMAC-DRBG selection (art-583), and the selected population is recomputed by the recompute node configured for the regime under test. The ordering is the whole point - a manifest committed before the pulse round cannot be reshaped to steer which items get drawn, and a pulse nobody controlled cannot be shopped for a friendlier sample. One generic chain, configured per regime: stage 2 is the prevailing-wage certified-payroll recompute (art-574) as the first instance, and stage 3 the multi-garnishment stacking recompute (art-572) as a second configuration of the identical ceremony. GATED (OCG Standard v0.8 §21.4): gate 1 on art-583's own /verdict, so a sample that did not derive stops the automated path rather than sending an unusable selection downstream; gate 2 on art-574's own /verdict, so a run whose declared population is not a certified payroll falls through to the garnishment configuration instead of ending on an empty prevailing-wage stage. Regime instances are configurations of these steps, not new nodes. The beacon pulse and its round are caller-declared throughout: no step fetches a pulse or checks a beacon signature.

Domain: Audit & Assurance

### Steps

1. art-583-beacon-seeded-fair-sampling-deriver
   Derives the selected item indices and the full per-draw HMAC-DRBG transcript from three caller-declared inputs: the item-manifest hash committed before the pulse round, the beacon pulse (drand quicknet or NISTIR-8213) and the algorithm id. Gate: a DERIVED sample continues to the configured recompute; any other verdict means there is no usable selection to test against, and the automated path ends rather than recomputing an arbitrary population.
2. art-574-certified-payroll-prevailing-wage-recompute
   Recomputes the sampled certified-payroll rows against the declared wage determination, with CWHSSA overtime and straight-time fringe, and compares the recomputed required gross against a submitted payroll where one is supplied. Gate: an INDETERMINATE verdict means this run declared no certified payroll to test, so the chain falls through to the garnishment configuration of the same ceremony; a MATCHES or DIVERGES verdict is the tested result and the automated path ends there.
3. art-572-multi-garnishment-stacking-recompute
   Second configuration of the identical ceremony: recomputes, for the sampled pay periods, how much each order in the declared garnishment stack may lawfully withhold from disposable earnings, and compares that against a garnishment notice where one is supplied. Terminal stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
