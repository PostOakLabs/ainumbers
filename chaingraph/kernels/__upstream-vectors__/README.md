# Upstream conformance vectors

Third-party test data vendored verbatim so shipped verifiers can be checked against their standards' own vectors, not only against fixtures built on the same assumptions as the verifier. Each subdirectory has a `PROVENANCE.json` (source repo, commit, licence file, retrieval date, SHA-256 of every file). The harness refuses to run if a vendored file no longer matches its digest.

Run it with `node scripts/check-upstream-vectors.mjs`. It prints one `PASS | FAIL | SKIP <set> <vector-id> <reason>` line per vector and exits 1 on a FAIL missing from `scripts/upstream-vectors-baseline.json`, or on a baseline entry that now passes, so the baseline only shrinks.

This check is advisory. It is not wired into `scripts/preflight.mjs` or any workflow; a later row promotes it to blocking once the v2 verifier nodes land. The W3C REC is stored as `index.html.txt` (byte-identical to upstream `index.html`, same SHA-256) so site copy gates do not scan third-party prose. The vectors are test data only: nothing here is imported as a code path (SPEC §REVOKE-1.1), and none of it belongs in `ocg-conformance/`, which is the estate's own public receipt-format corpus.
