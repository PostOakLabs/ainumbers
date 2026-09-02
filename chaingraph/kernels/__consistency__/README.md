# `__consistency__` — cross-kernel consistency properties (PILOT)

Run it:

```
node chaingraph/kernels/__consistency__/run-consistency.mjs
node chaingraph/kernels/__consistency__/run-consistency.mjs --red
```

## What this is, and what it is not

Classical L3 property testing asserts over an end-to-end pipeline. OCG chains are not
pipelines. A chain is a provenance-linked bundle of independently parameterized kernels,
and every step's inputs come from the caller, never from the previous step's output.
There is no data flow to assert over, so the classical L3 shape does not apply here and
this directory does not pretend otherwise.

What does apply is **cross-kernel consistency**: where two or more kernels implement
facets of the same rule, feeding them the same policy inputs must not produce mutually
contradictory verdicts. That relationship is real, it is mechanically checkable, and
nothing in the build enforced it before this pilot.

Properties here assert **relationships, never golden values**. Golden values are what
each kernel's own fixture suite already covers — and covers in a way that is blind to
this defect class, because a kernel's fixtures are regenerated from that kernel's own
tables and therefore agree with a stale table just as readily as with a correct one.

A property failure here is **a finding to report, never a fix to apply**. This directory
edits no kernel and no fixture.

## Not wired into CI

Deliberately. This is a pilot over three families; whether any of it should become a
gate is a decision for the row that reads the report, not for this one.

## Engine decision: exhaustive enumeration, not fast-check

The row's amendment asked for fast-check, with an explicit escape hatch for
fixture-iteration-only where vendoring is disproportionate. This harness takes the escape
hatch, for three reasons, in order of weight:

1. **A standing spec forbids it.** `FV-PBT-FLOOR-BUILD-SPEC.md` §2 established the
   estate's property-testing floor as zero-dependency, and both `scripts/run-proptests.mjs`
   and the `Property-testing floor` step in `.github/workflows/land-verify.yml` carry the
   rule in their own comments as "no fast-check, no new npm dependency". Vendoring
   fast-check for a pilot would contradict a live spec and a live CI comment.
2. **The input domains here are small and finite, so enumeration is strictly stronger
   than generation.** Six published years times seven tier probes; three lien and jumbo
   combinations; a fifty-four-point reserve grid bracketing the 1:1 line from both sides;
   a single-element omission sweep over a five-element obligation. These domains are
   enumerated **exhaustively**. Random generation over the same space would cover less
   and would need shrinking to report what enumeration reports directly.
3. **No hand-rolled generator was written.** The amendment's actual concern — do not
   hand-roll generation and shrinking — is satisfied by having neither. There is no RNG
   in this directory.

Where a future family's domain is genuinely large or continuous, that reasoning inverts
and the vendoring question should be reopened on its own merits. It is recorded in the
row's report as an open question for editorial review rather than settled here.

## Layout

| File | Role |
| --- | --- |
| `_consistency-harness.mjs` | Property definition, the declared-expectation runner, report formatting |
| `regz-thresholds.consistency.mjs` | Family A — Reg Z thresholds: publisher art-220 vs appliers art-218 / art-234 / art-235 |
| `genius-reserve-coverage.consistency.mjs` | Family B — stablecoin reserve coverage: art-06 vs art-582 |
| `euaia-art12-logging.consistency.mjs` | Family C — EU AI Act Art 12(2): publisher art-238 vs builder art-236 |
| `red-control/` | A deliberately perturbed scratch copy, used to show the harness catching something |
| `run-consistency.mjs` | CLI entry, normal and `--red` modes |

## Declared expectations

Every property declares `HOLDS` or `VIOLATION` **before it runs**, and the runner exits
non-zero on any mismatch in either direction. A property expected to be violated that
starts holding is a surprise too: it means this directory has gone stale, not that the
estate quietly improved. This is SO #34c applied to the harness itself — a check only
ever observed green has not been observed at all.

## The RED control

`--red` substitutes `red-control/art-220-stale-2025-qm-row.perturbed.mjs` for the real
art-220 and requires that `P-A1` was green against the real kernels and goes red against
the copy. Either half missing makes the control worthless, so the runner checks both.

The perturbation is the estate's own historical defect shape: a yearly threshold table
in which one year silently kept the previous year's figures. No per-kernel fixture suite
can see that, because the fixtures are regenerated from the stale table. Only a
cross-kernel comparison can.

`red-control/` holds no `.kernel.mjs` file and is loaded by nothing but this harness.
