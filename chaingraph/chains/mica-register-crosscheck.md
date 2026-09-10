# MiCA Register Cross-Check

A cross-check for the case of a MiCA-authorised issuer whose register presence, published reserve disclosure and stablecoin attestation recompute ought to line up. Stage 1 records whether the entity was present in a pasted ESMA register extract as of the date the reader captured it, pinned by a digest of the pasted bytes. Stage 2 checks that issuer's published reserve disclosure against the composition, concentration, segregation and cadence terms the reader declares. Stages 3 and 4 recompute the stablecoin side twice from the reader's own declared figures: a GENIUS Act reserve-attestation precheck, and a GENIUS-shaped conformance read over the published monthly disclosure. Every stage is computed independently from its own declared inputs; a chain composes computations in an analytical order and the execution model carries nothing between them. The evidence value is that four separate readings about one issuer, each dated and hash-anchored, can be laid beside each other by whoever is asking. HARD FENCE: presence in a register snapshot is a dated fact about pasted text, never authorisation, never a current status, and never a claim that the register is complete or current. Nothing in this chain fetches a register, an issuer disclosure or a market price, and no stage certifies compliance, solvency, or the truthfulness of the underlying data.

- Page: https://ainumbers.co/chaingraph/chains/mica-register-crosscheck.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mica-register-crosscheck.md

## Workflow chain: MiCA Register Cross-Check

A cross-check for the case of a MiCA-authorised issuer whose register presence, published reserve disclosure and stablecoin attestation recompute ought to line up. Stage 1 records whether the entity was present in a pasted ESMA register extract as of the date the reader captured it, pinned by a digest of the pasted bytes. Stage 2 checks that issuer's published reserve disclosure against the composition, concentration, segregation and cadence terms the reader declares. Stages 3 and 4 recompute the stablecoin side twice from the reader's own declared figures: a GENIUS Act reserve-attestation precheck, and a GENIUS-shaped conformance read over the published monthly disclosure. Every stage is computed independently from its own declared inputs; a chain composes computations in an analytical order and the execution model carries nothing between them. The evidence value is that four separate readings about one issuer, each dated and hash-anchored, can be laid beside each other by whoever is asking. HARD FENCE: presence in a register snapshot is a dated fact about pasted text, never authorisation, never a current status, and never a claim that the register is complete or current. Nothing in this chain fetches a register, an issuer disclosure or a market price, and no stage certifies compliance, solvency, or the truthfulness of the underlying data.

Domain: Digital-Asset Rails

### Steps

1. art-602-mica-register-presence-check
   Stage 1, root: whether a named entity was present in a pasted ESMA MiCA register extract (crypto-asset white papers, or authorised crypto-asset service providers) as of the reader's own capture date, with the pasted bytes pinned by register_snapshot_digest. The reading is a dated fact about that snapshot and never an authorisation or current-status determination.
2. art-512-check-mica-reserve-disclosure
   Stage 2: the same issuer's published reserve disclosure read against the composition, concentration, segregation and publication-cadence terms the reader declares, with coverage arithmetic in exact fixed point. Every rule tested here is the reader's own, transcribed from the terms the issuer is being held to, never a bundled template.
3. art-06-genius-act-reserve-attestation
   Stage 3: a GENIUS Act reserve-attestation precheck over the reader's declared reserve and attestation figures, computed independently of Stage 2 from its own declared inputs. A second reading of the same subject, reached by a different route, is what makes a divergence visible.
4. art-582-genius-reserve-disclosure-conformance-monitor
   Stage 4, terminal: GENIUS-shaped conformance over the published monthly reserve disclosure, covering coverage arithmetic and attestation presence and timeliness, each with its own verdict of MET, NOT_MET or INDETERMINATE. Permitted-asset composition stays out of scope while no final implementing rule text exists to check it against.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
