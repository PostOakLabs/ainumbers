# Stablecoin Examiner Pack

Examiner-facing composition over four landed nodes: a GENIUS-shaped reserve disclosure conformance check (art-582), an independent Proof-of-Reserves recompute (art-584), a sanctions-screening decision pinned to the exact versioned dataset it ran against (art-585), and a granular three-source reserve recompute that reconciles the issuer's per-asset-class breakdown, an EDGAR N-MFP Part 1 series summary and a declared on-chain supply figure against one another (art-603). On-chain circulating supply enters as a DECLARED caller input throughout and involves no network read: art-582 compares it numerically against the issuer's reported outstanding-token count as an informational figure reaching no requirement verdict, and art-603 treats the same declared figure as a first-class reconcile leg with its own RECONCILED, DISCREPANT or INDETERMINATE verdict, gated on how far apart the three as-of dates sit. Reading that figure directly from a light client is a named follow-on, not part of this pack. Produces the evidence a stablecoin examination asks for; it is not a compliance certification and takes no position on solvency.

- Page: https://ainumbers.co/chaingraph/chains/stablecoin-examiner-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/stablecoin-examiner-pack.md

## Workflow chain: Stablecoin Examiner Pack

Examiner-facing composition over four landed nodes: a GENIUS-shaped reserve disclosure conformance check (art-582), an independent Proof-of-Reserves recompute (art-584), a sanctions-screening decision pinned to the exact versioned dataset it ran against (art-585), and a granular three-source reserve recompute that reconciles the issuer's per-asset-class breakdown, an EDGAR N-MFP Part 1 series summary and a declared on-chain supply figure against one another (art-603). On-chain circulating supply enters as a DECLARED caller input throughout and involves no network read: art-582 compares it numerically against the issuer's reported outstanding-token count as an informational figure reaching no requirement verdict, and art-603 treats the same declared figure as a first-class reconcile leg with its own RECONCILED, DISCREPANT or INDETERMINATE verdict, gated on how far apart the three as-of dates sit. Reading that figure directly from a light client is a named follow-on, not part of this pack. Produces the evidence a stablecoin examination asks for; it is not a compliance certification and takes no position on solvency.

Domain: Digital-Asset Rails

### Steps

1. art-582-genius-reserve-disclosure-conformance-monitor
   Stage 1: GENIUS-shaped conformance over an issuer's published monthly reserve disclosure, covering 1:1 coverage arithmetic and attestation presence/timeliness, each with its own verdict of MET, NOT_MET or INDETERMINATE. Permitted-asset composition stays out of scope while no final rule text exists. The on-chain supply figure is a caller-declared number compared against the reported outstanding-token count, informational only, never a requirement verdict.
2. art-584-proof-of-reserves-verifier
   Stage 2: independent recompute of the issuer's published Proof-of-Reserves data, covering a bounded Merkle-sum inclusion path, a liability-side branch aggregation, and the coverage ratio between the two recomputed sums, with an optional cross-check against a caller-declared published reserve figure. Consistency here concerns the internal arithmetic of what was published, never solvency and never the truthfulness of the underlying data.
3. art-585-sanctions-screening-evidence-pack
   Stage 3: binds a caller-declared sanctions-screening decision to the exact versioned dataset it ran against, by comparing a caller-computed digest of the artifact actually screened with the caller-declared published digest for that dataset version. Evidence of process reproducibility, never of screening adequacy.
4. art-603-stablecoin-reserve-3source-recompute
   Stage 4, terminal: granular recompute across three independently sourced, caller-declared legs. Recomputes the reserve ratio from the issuer's per-asset-class breakdown rather than the stated top-line figure, recomputes weighted-average maturity from that same breakdown and compares it against the maturity figure reported in the EDGAR N-MFP Part 1 series summary, flags each holding against the statutory GENIUS eligible-asset enumeration as a criteria match only, and runs three cross-source reconcile checks each gated on the largest gap between the three declared as-of dates. Recompute of disclosed arithmetic, never a solvency claim and never a statement that the disclosed figures are true.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
