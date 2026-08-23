# AUTHORING STANDARD — Refusal-Carrying Exclusions

**Status:** convention, adopted 2026-08-23 (`AUTHORING-STANDARD-ADOPT-1`, on Tim's ruling of
2026-08-22). **This is not part of the OpenChainGraph standard.** It adds **zero** SPEC.md sections,
**zero** schema fields, and **zero** node-shard members. Nothing in this file is normative for a
`chaingraph_version: 0.4.0` artifact; `SPEC.md` and `openchain-graph-v0.4.schema.json` remain the
sole authorities on what an artifact is. This file governs how a **node author** works, and its
obligations are discharged in code the author already writes.

**Read this before authoring or amending any standards-implementing node.** `board/RIDER-KERNEL.md`
points here; `scripts/kernel-preflight.mjs` prints the pointer on every run.

**Evidence base:** `research/AUTHORING-STANDARD-RESEARCH-2026-08.md` (the retrieval and the argument,
including the case against every part of this), `0xAlpha/2026-08-21-time-decaying-constants-audit.md`,
`0xAlpha/2026-08-22-in-code-narrative-vs-record-audit.md`,
`0xAlpha/2026-08-23-flag-blind-consumers-audit.md`.

---

## 0. The one-sentence version

> Every branch of a cited provision that the kernel cannot represent is discharged **at runtime**,
> into a structured non-verdict that names the branch, reachable by a real input and proven by a
> fixture. The authoring-time branch inventory is the **checklist that produces those refusal
> paths** — it is not a parallel metadata array, and it is not a schema field.

### 0.1 Why it is a convention and not a field

A declaration is only honest if **something consumes it**. OpenVEX `not_affected` stays truthful
because it suppresses a scanner finding; a FHIR CapabilityStatement stays truthful because clients
break otherwise. An `excluded_branches[]` in a node shard that nothing reads has **no adversary**,
and a declaration with no adversary decays into the appearance of assurance.

So the declaration goes where a consumer already exists — the kernel's own **output**, which the
caller receives — and the inventory that produces it is checked by a gate that **executes** it
(§1.6). The estate does not buy a permanent schema field on a hope; it buys it, if ever, on a
measured fill rate (§1.7).

---

## 1. The convention

### 1.1 Inventory branches from the retrieved clause snapshot — never from `compute()`

For every paragraph the node cites, enumerate the provision's branches **by reading the pinned
clause snapshot** (SO #38: `research/clause-snapshots/`, registered in
`chaingraph/standard/clause-snapshot-registry.json`). Enumerate **head-of-provision exemption and
exclusion lists item by item** — that is where the estate's measured silent-green gaps concentrate.

⛔ **An inventory derived by reading the kernel is void.** It would be SO #34's
self-attested-provenance-validated-by-a-self-consistent-checker shape: the artifact under test
supplying the value that validates it. No coverage metric computed over the kernel can find a branch
the kernel never had — a missing exemption is not an *uncovered* branch, it is a branch that
contributes to no denominator.

⚠ **Known limit, stated so nobody mistakes this for completeness:** the inventory enumerates branches
of paragraphs you **cited**. A governing paragraph never cited produces no inventory row and no
refusal. Coverage *of the source text* is a strictly harder problem and this convention does not
solve it (§5.1).

### 1.2 A closed four-value disposition enum

Every branch gets exactly one. There is no free-text disposition; notes are welcome, notes are not a
disposition.

| Disposition | Meaning | Obligation it creates |
|---|---|---|
| `represented` | the branch is an input field or a real code path producing a verdict | name the `output_payload` member that carries it |
| `refused` | the kernel emits a structured non-verdict naming this branch | **a reachable runtime path + a fixture** (§1.3) — mechanically checked |
| `out_of_scope_by_input` | the branch is governed by a value the caller supplies | an **assumptions-of-use** line naming the value, its source, and **who owns supplying it correctly** |
| `unrepresented_known` | acknowledged gap, no runtime path exists | a **declared error direction** (§1.4). This is the only value that is a *finding* rather than a resolution |

**On `out_of_scope_by_input`.** Moving a regulatory constant out of the kernel and into caller input
**relocates the assertion; it does not retire it.** ISO 26262's Safety-Element-out-of-Context has the
same structure and takes it seriously: assumptions of use are documented, propagate to the
integrator, and the integrator must validate them. A relocated assertion with no named owner is not
an anti-circularity pattern — it is an assertion that has stopped being anybody's job. And the
transfer is only real if the fixture that supplies the value is not itself kernel-generated (§1.5);
otherwise the circularity has moved one file over rather than gone.

**On `unrepresented_known`.** It is honest and it is allowed. It is also a finding: the ORCH may
stage from it. ⛔ It may never be used to record a branch that in fact has a refusal path — that is
`refused` and it is checked.

### 1.3 THE LOAD-BEARING PART — every `refused` branch must be reachable

**A declared exclusion with no runtime path is prose, and prose is what failed.** For each `refused`
branch there must exist:

1. an **input shape** for which `compute()` returns a structured non-verdict naming the branch, and
2. a **fixture vector** exercising that shape.

This is Catala's design translated to hand-rolled kernels. When no definition's condition holds,
Catala refuses to produce a value rather than falling through to a default; the unrepresented case
becomes a refusal *by construction*. `art-615`, `art-507` and `art-637` are the estate's hand-rolled
version: `manual_review_required` naming the missing predicate **is** an `EmptyError` with a better
message. Those nodes did not succeed because someone wrote careful prose — they succeeded because
**the refusal is on the execution path and the caller receives it**.

It is also the only part of this convention that is mechanically checkable with no new schema, and
§1.6 checks it by **running the kernel**, not by reading a claim about it.

⚖ **`refused` is not the same as `unrepresented_known`, and the difference is the whole point.** The
inventory row records that you thought about the carve-out. The refusal path proves the carve-out
**changes the answer**.

### 1.4 Error direction is a declared value, not an adjective

Any node whose output is compared against a threshold, cap, floor or limit declares exactly one:

- `conservative_toward_finding` — may over-report; will not miss a true violation.
- `conservative_toward_no_finding` — may under-report; **can miss a true violation**.
- `undirected` — the approximation is not known to be one-sided.

Static analysis has spent forty years being precise about exactly this: over-approximation is sound
in the no-false-negatives sense at the cost of false alarms; under-approximation prioritises absence
of false positives and accepts missed cases. Nobody in that field calls an analysis "conservative"
without saying in which direction, because the word carries no information without one.

⚠ **Why this is a field and not a sentence.** A competent reviewer, holding the correct facts,
described understating a rate **against a cap** as "consumer-conservative". Understatement against a
cap is `conservative_toward_no_finding` — the harmful direction, the one that misses violations at
the boundary. A judgement a careful reader can invert is a judgement that must not be expressed in
prose adjectives.

⚠ **Unresolved, stated rather than hidden:** this assumes the author can determine the direction, and
the same evidence shows the determination is hard. A declared field with a *wrong* value is more
dangerous than an absent one, because consumers trust it. The mitigation available today is a second
read on cap-and-threshold nodes, which is a human step; `undirected` is the honest value when the
author cannot establish direction, and it is **not** a failing answer.

### 1.5 Fixture provenance changes what a fixture *counts as*

Each fixture vector carries its provenance, using the field `art-637` already ships — ⛔ do not invent
a second carrier:

- **`independent_oracle` present** — the expectation comes from a named external source (a
  regulator's or standard-setter's own worked example, or an independently derived computation),
  carrying `source`, `source_digest`, and `derivation`.
- **`independent_oracle` absent** — the vector is **`kernel_generated`**: its expectation is the
  kernel's own output.

✅ **THE RULE THAT GIVES IT FORCE: a `kernel_generated` fixture is a REGRESSION VECTOR ONLY, and may
never be cited as evidence that a node matches the standard.** This is not our invention; it is the
settled boundary in the testing literature. Characterization and golden-master tests exist to
document a system's actual behaviour, not the behaviour you wish it had. They are change detectors.
Change detectors are legitimate and useful, and they are not oracles. Where a vector's expectation
**is** the kernel's output, sealing it proves only that the kernel still agrees with itself.

⚖ **The one distinction that keeps this workable:** a **reachability** fixture under §1.3 and a
**conformance** fixture are different instruments. Reachability asks *does this input reach this
refusal path* — a property of the code, which the code may legitimately answer. Conformance asks
*does this answer match the law* — a property of the law, which the code may not answer about itself.
A `kernel_generated` vector is admissible for the first and inadmissible for the second.

⛔ **THEREFORE THEY LIVE IN DIFFERENT FILES, and this is not tidiness.**

| File | Holds | Provenance |
|---|---|---|
| `chaingraph/kernels/fixtures/<tool_id>.fixtures.json` | conformance vectors | must carry `independent_oracle` where the node's property floor requires it |
| `chaingraph/kernels/fixtures/<tool_id>.reachability.json` | reachability vectors only | `kernel_generated` by construction; `provenance: "kernel_generated"` declared on each |

⭐ **Measured, while adopting this convention.** `art-637`'s property floor asserts that **every**
vector in its conformance file carries an `independent_oracle` — its own words: *"the fixture would
be its own oracle"*. Three reachability vectors added to that file turned the floor **red**. The
options were to weaken a node's conformance floor to accommodate a demonstration about the code, or
to keep the two instruments apart. ✅ Keep them apart. ⭐ A `refused` row may point at a vector in
either file: an oracle-backed conformance vector that happens to exercise the refusal is **stronger**
evidence, and three of the cohort's twelve refusals resolve that way. `check-branch-inventory.mjs`
additionally requires a `kernel_generated` vector's `policy_parameters` to equal the inventory's
`reachability_vector`, so the two cannot drift into pinning different inputs.

### 1.6 Where the inventory lives, and the gate that reads it

**One file per node:** `chaingraph/standard/branch-inventories/<tool_id>.inventory.json`.

⛔ Not in the node shard, not in `chaingraph.json`, not in the schema. It is an authoring artifact
with exactly one consumer, and that consumer executes it:

```
node scripts/check-branch-inventory.mjs            # all inventories
node scripts/check-branch-inventory.mjs <tool_id>  # one
```

For every `refused` branch the gate **imports the kernel and runs `compute()` on the declared
`reachability_vector`**, then asserts the declared `flag` appears in `compliance_flags` and the
declared `payload_marker` is truthy in `output_payload`. A `refused` row whose path does not fire is
a **FAIL** — the `excluded_branches[]` failure mode wearing different clothes, caught by execution.
It also asserts that every cited `derived_from.digest` resolves in the clause-snapshot registry
(§1.1's independent-derivation rule, enforced rather than asserted) and that every named fixture
vector exists.

Schema of an inventory file, with a `refused` row shown in full:

```jsonc
{
  "tool_id": "art-637-globe-de-minimis-exclusion",
  "inventory_version": "1.0.0",
  "authored_at": "2026-08-23",
  "error_direction": "conservative_toward_finding",
  "error_direction_rationale": "...why, in one or two sentences...",
  "derived_from": [
    { "digest": "sha256:6bc1e...", "clause_path": "Article 5.5.1 through 5.5.4" }
  ],
  "branches": [
    {
      "id": "art-5.5.2-current-year-cannot-be-excluded",
      "clause": "Art 5.5.2",
      "branch": "A preceding Fiscal Year with no Constituent Entities is excluded from the average.",
      "disposition": "refused",
      "refusal": {
        "flag": "CURRENT_YEAR_DECLARED_EXCLUDED",
        "payload_marker": "manual_review_required",
        "reachability_vector": { "...": "policy_parameters that reach the refusal" },
        "fixture": "art-637-globe-de-minimis-exclusion.fixtures.json#missing-year-data-is-held-not-defaulted"
      }
    }
  ]
}
```

### 1.7 The promotion criterion — what would make this a schema field

⛔ **No SPEC field, no schema change, no shard member — now.** Additive-only means every schema field
is forever, and permanence should be bought with evidence the convention itself produces.

✅ **Promote only when:** the convention has run on 5–8 nodes **and** the fill quality has been
measured (§4 records the first cohort and its metric). If it holds up, a field then formalises a
working practice with a known fill rate — a completely different proposition from schematising a
hope. If it does not, a field would not have saved it, and the estate learned that cheaply.

---

## 2. FLAG-MIRROR DOCTRINE — a kernel that raises a conditional flag must mirror it into the payload

⚖ **Tim ruling, 2026-08-23.** Formalises the `art-01` `warning_checks` precedent. **No evaluator
change. No SPEC §21.4 change. No schema change.**

### 2.1 Why the convention above depends on it

Refusal-carrying exclusions put the non-verdict in `compliance_flags`. Measured across the estate on
2026-08-23:

| | |
|---|---|
| Kernels that can emit `compliance_flags` | **545 of 634** |
| Consumer instances where a flag-bearing artifact is present-or-absent at a boundary | **~1,843** |
| …that **carry** the flags | 497 (27%) |
| …whose **behaviour changes** when a flag is present | **≈2** |
| §21.4 chain-gate pointers targeting any flag field | **0 of 80** |
| Gate steps sitting on a *conditionally*-flag-raising kernel (live swallow risk) | **12** |

The channel the convention writes into is one almost nothing reads. SPEC.md §21.4 resolves a gate's
RFC 6901 pointer against **this step's `output_payload` only** (`_gateval.mjs:134`), and top-level
`compliance_flags` is outside that document — so **no gate can ever condition on a flag**, by design,
forever. The measured instance is live: `art-223` pushes `LOAN_AMOUNT_MISSING` and still returns
`classification: 'conforming'`, and the chain gate reads `/loan_program` and routes regardless.

There are two ways out. Grow the standard a flag-aware construct — a new pointer leg or a closed
`flags_empty` op, which is a normative envelope change. Or **require the kernel to mirror**, after
which every existing gate can route on the mirrored member with no evaluator change at all. The
second is cheaper, additive, and reversible. It is the one adopted.

### 2.2 The rule

✅ **If `compute()` can raise a flag CONDITIONALLY — the flag set differs between two inputs — then
`output_payload` must carry at least one member from the closed mirror list below, and that member
must be truthy exactly when the conditional flags are present.**

**Closed mirror list** (⛔ closed; extending it is a deliberate amendment to this file, not an
author's choice). **Selection rule**, applied to a census of every kernel's observed
`output_payload` keys: a member is admissible **iff its presence-and-truthiness means "the kernel is
carrying a caveat"**, never "here is the answer". Counts are the 2026-08-23 census.

| Member | Type | Census | Precedent |
|---|---|---:|---|
| `manual_review_required` | boolean | 3 | `art-637`, `art-615`, `art-507` — the refusal-carrying counter-pattern |
| `warning_checks` | array/object | 1 | `art-01` — the precedent this rule formalises |
| `warnings` | array | 12 | |
| `warn_count` | number | 11 | |
| `caveats` | array | 1 | |
| `domain_errors` | array | 2 | `art-617`'s declared-domain refusal |
| `errors` | array | 10 | |
| `issues` | array | 9 | |

⛔ **Deliberately excluded, with the reason, so it is not re-litigated per node:** `decision` (20),
`reason` (11), `reasons` (13) and `breach_reasons` (1) **explain a verdict the kernel did produce** —
a gate routing on them routes on the answer, not on the refusal; `execution_state` (2) is a lifecycle
marker truthy on clean runs; `notes` (1) is prose emitted on clean runs too; `valid_input` (2) has
**inverted sense** — truthy means fine, so every gate written against it would route backwards.

⚖ **A constant marker is not a conditional flag.** A kernel that always emits the same
`*_ASSESSED` / `*_COMPLETE` set carries no non-verdict and owes no mirror — 444 of the 545 emitters
are in this class. The rule binds the ~101 that vary.

### 2.3 The gate, and how it decides "conditional"

```
node scripts/check-flag-mirror.mjs            # FLAG-MIRROR-DOCTRINE gate
node scripts/check-flag-mirror.mjs --report   # full per-kernel classification
```

⛔ **It does not read the kernel and guess.** It **runs** each kernel over `compute({})` plus every
fixture vector's `policy_parameters`, and classifies the flag channel as CONDITIONAL only when the
observed flag sets **differ between two executions**. That is a behavioural derivation, per SO #34 —
a heuristic over source text would be the checker deciding for itself what the artifact claims.

- **CONDITIONAL + no mirrored member** ⇒ violation.
- **CONDITIONAL + a mirrored member** ⇒ pass.
- **Flags identical across every observed input** ⇒ not conditional; not gated.
- **Kernel could not be executed** ⇒ `UNCLASSIFIED`, reported as its own category and counted —
  ⛔ never folded into the green set (SO #34c: absence is not a pass).

**Baseline-shielded, counts only go down.** `scripts/flag-mirror-baseline.json` records the
violations that existed when the gate landed. A shielded kernel is not green — it is *known*. The
gate fails on any violation not in the baseline, and fails when a baselined entry has been fixed but
not removed, so the number is a ratchet and cannot silently grow.

⛔ **Do not retrofit existing kernels to satisfy this gate.** A mirror added to a sealed kernel moves
its digest and demands a re-prove in the same row (SO #36). The baseline exists precisely so that the
doctrine binds **new and amended** work without opening 100 sealed nodes.

---

## 3. Two authoring obligations the audits paid for

### 3.1 (A) CITATION-TRIO DOCUMENTARY VALIDATION

The existing citation-hygiene discipline validates **paragraph** locators — is the clause path
well-formed and does it resolve. It does not validate **documentary** locators: *does the cited
document exist, and does it carry the values quoted from it?*

**The worked example, and it is not hypothetical.** Three kernels — `art-218`, `art-220`, `art-234` —
carried a 2025 Regulation Z threshold row citing **"FR Doc 2024-28929 (Dec 10, 2024), 89 FR 99882"**.
That trio — document number, date, Federal Register page — matches **no retrieved document**. The
real December-2024 annual-adjustment rule is **FR Doc 2024-27553, published 2 December 2024, at 89 FR
95080**. The phantom citation was attached to values that were also wrong: the kernels carried
`$134,500 / $4,035 / $26,900 / $1,345` where the actual rule sets `$134,841 / $4,045 / $26,968 /
$1,348`. One mistranscribed row propagated to three kernels, and it survived every gate because
**nothing verifies that a cited artifact exists or contains the numbers attributed to it.** This is
the wrong-locator class escalated into executable values.

**What the author owes, per cited documentary locator:**

1. **Retrieve the document at the cited locator.** Not a summary, not a search-result snippet, not a
   secondary tracker — the publisher's own text at the publisher's own URL.
2. **Confirm the trio is internally consistent** — document number, publication date, and page/ELI
   reference all belong to the *same* document. The phantom trio failed exactly here: a real-looking
   document number paired with a date and page belonging to nothing.
3. **Confirm the document carries the quoted values, verbatim.** Every threshold, rate, date and enum
   value the kernel takes from it must appear in the retrieved text. A value present in the kernel
   but absent from the document is a STOP, not a rounding difference.
4. **Pin it** under SO #38 — `research/clause-snapshots/`, registered with `pin-clause-snapshot.mjs`,
   so the digest resolves and later readers verify the same bytes rather than re-retrieving into a
   moved target.
5. **On failure — publisher unreachable, trio inconsistent, or values absent — STOP and report.**
   ⛔ Never build from a summary, and ⛔ never write a locator you have not opened. An unverified
   locator is recorded as `LOCATOR-UNVERIFIED` and the value it would have justified does not ship.

**Cost per author:** ~10–20 minutes per *distinct* document, not per citation — a node citing eight
paragraphs of one Federal Register rule pays once. Steps 1–3 are a fetch and two reads; step 4 is the
`pin-clause-snapshot.mjs` invocation SO #38 already requires, so for any node already complying with
SO #38 the marginal cost is **steps 2 and 3 only** — a few minutes. The phantom trio would have
failed step 2 on the first attempt to open it.

⛔ **What is deliberately NOT built here: the retrieval infrastructure.** A gate that resolves a
locator to a live document needs network access from CI, a publisher-specific resolver per
citation family (Federal Register, EUR-Lex/ELI, eCFR, FASB, OECD), and an answer for the day a
publisher rate-limits or moves — and a network-dependent gate that soft-fails is a gate that reports
green when it learned nothing. The estate's local, deterministic, offline-verifiable substitute
already exists and is the correct place to spend: **the pinned snapshot registry.** Documentary
validation is therefore an **author obligation with a STOP condition**, discharged at retrieval time
and evidenced by the pin — ⛔ not a scraper.

### 3.2 (B) EXPIRY-DATED RE-RETRIEVAL FOR AMENDMENT-CHANNEL INSTRUMENTS

**The worked example — why a build-time read is structurally insufficient.** `art-71` carries
`QUARTERLY_HOLDING_THRESHOLD = 0.80`, authored against `CBAM-IR-v1.0-2024-Q4`. Regulation (EU)
2025/2083 (the CBAM Omnibus, in force 20 October 2025) cut that quarterly minimum holding from 80% to
**50%**. The kernel is wrong today.

⚠ **And SIDEBYSIDE — the estate's verification instrument for exactly this — cannot see it.** SO #39
reconciles the kernel against the **pinned snapshot**. If the snapshot predates the amendment, the
kernel and the snapshot agree, SIDEBYSIDE returns MATCHES, and **both are wrong**. The verification
self-confirms. No amount of re-running it helps: the drift is between the snapshot and the world, and
the snapshot is the thing being trusted.

✅ **THE CONVENTION — end to end:**

1. **Who sets the expiry: the author, at pin time.** Any instrument with an **amendment channel** —
   EU Official Journal, US Federal Register, agency annual adjustments, standard-setter ASUs, OECD
   administrative guidance — gets an `expires_at` when it is pinned. ⛔ It is not optional and ⛔ it
   is not the ORCH's to guess later; the author holding the primary text is the only party who knows
   the instrument's revision cadence.
2. **What the date is: the next scheduled revision opportunity, never a fixed interval.** An annual
   inflation adjustment expires the day its next annual rule is due. A regulation under active
   omnibus revision expires at the next known trilogue/OJ milestone. Where the cadence is genuinely
   unknown, **12 months** is the default and the reason is recorded — ⛔ "no known cadence" is
   recorded, never left blank.
3. **Where it lives: beside the snapshot, in `clause-snapshot-registry.json`.** ⛔ Not in the node
   shard (it would move node hashes on every re-pin), ⛔ not in a board row (rows are consumed and
   archived), ⛔ not in a calendar (SO #0: it must survive the maintainer). The registry is already
   the single writer for snapshot provenance and is already read by `check-clause-digest.mjs`.
4. **What fires: an ADVISORY report, never a hard red.** An expired snapshot must not red a PR that
   did not touch it — that is the fix-cascade shape the estate has paid for repeatedly, and a
   maintainer who cannot merge an unrelated change will delete the date rather than re-retrieve.
   The expiry surfaces as a **dated observation**: a report line naming the instrument, the nodes
   consuming it, and how long it has been expired. It becomes a **hard red only for a PR that touches
   a node consuming an expired snapshot** — at that moment the author is already holding the file and
   the re-retrieval is cheap.
5. ⛔ **What happens when nobody acts on it — stated plainly, because this is where such conventions
   die.** Nothing automatic. The report grows a line, the line persists, and no node is withdrawn.
   That is a deliberate choice over the alternatives: auto-withdrawal would let a publisher's URL
   change take live nodes offline, and a hard red would be routed around. The design bet is that a
   **standing, dated, visible** count is honest — the estate can see exactly how stale it is at any
   moment — where a silent build-time read is not. ⚠ An expiry list nobody reads is a weaker control
   than a gate, and this file does not pretend otherwise. It is strictly stronger than the status quo,
   which is a snapshot that self-confirms forever.

⚖ **Not staged here.** The ORCH stages expiry rows from this convention; this row specifies it and
stages nothing.

---

## 4. ONE WRITER PER LEGAL EVENT

⚖ **Tim ruling, 2026-08-22** (folded into this package rather than staged standalone).

**The defect.** Kernels restate legal history in prose — in comments, and worse, in *runtime payload
strings* (`rule_note`, `table_source`, `compliance_date_note`, `fr_citation`). Those strings ride
every MCP response, stamped `mandate_type: 'compliance_mandate'`. Measured: **13 kernels carry legal-
event narratives, 14 carry regulatory-stability certifications, 63 embed citations — every one
ungated.** Two kernels published **contradictory vacatur histories for the same rule**; the record is
a consent judgment, N.D. Tex., **2025-04-15**, No. 4:24-cv-00213-P — not the "May 2025" or "Fifth
Circuit" or "Jan 2025" variants that shipped. And `art-234`'s own header declares "consume art-220,
do not duplicate" — and then duplicates.

**The convention.** One legal event has **one writer**.

1. **The record lives once**, in a workspace-held event registry — rule or docket key → adjudicated
   history — **sha256-pinned exactly like a clause snapshot**, with the retrieved primary text behind
   it. A legal event is: an amendment, a vacatur, a consent judgment, a stay, an effective-date
   change, a supersession.
2. **Kernels reference the key, never the story.** A kernel that needs to say *why* a value is what
   it is carries the **key**, not a sentence. ⛔ No kernel restates an event another kernel already
   records.
3. **Contradiction becomes retrieval-free.** Two different histories under one key is a **red** that
   needs no network and no re-reading of the law: it is a pure consistency check over the registry.
   That is the whole return on centralising — the `art-220`/`art-233` split would have been a diff,
   not an audit finding.
4. **Where a narrative must stay in prose, it takes the dated-observation form** — the `art-572`
   shape: an as-of date and a source pointer on the same line. ⛔ Never "unchanged since 2013",
   ⛔ never "structural", ⛔ never a bare "upheld"/"vacated". Undated stability language is a promise
   about the future wearing the clothes of a fact (SO #0).

⚖ **What this row does and does not ship.** It ships the convention above and binds new and amended
work. It ⛔ does **not** build the registry file, ⛔ does not sweep the 13+14+63 existing kernels, and
⛔ does not touch a sealed kernel to remove a narrative — each of those is a hash move and a re-prove
(SO #36), and the fence forbids it. The narrative-vocabulary lint that mechanises point 4 is staged
separately (`NARRATIVE-VOCAB-LINT-1`), baseline-shielded on the same counts-only-go-down posture as
§2.3.

---

## 5. What this does not solve

Stated plainly, including where it undercuts itself.

1. **Omission of an entire paragraph.** §1.1's inventory enumerates branches of paragraphs you
   cited. An uncited governing paragraph fires nothing. This is the deepest limit and the convention
   has no answer to it; the safety-critical world's answer is a human requirements review, which is
   not mechanisable.
2. **The inventory is only as complete as its enumerator.** The assurance-case literature says this
   about itself — humans miss defeaters, which is why automated defeater discovery is an active
   research area. Our version is a person reading a statute and listing carve-outs.
3. **It detects a missing branch, not a wrong constant.** §1.2's `out_of_scope_by_input` relocates
   ownership of a constant; if the parameter record is wrong, every node reading it is wrong
   coherently and confidently, and the inventory shows full coverage. §3.1 and §3.2 attack that half.
4. **`out_of_scope_by_input` has no integrator.** ISO 26262's assumptions of use land on a party with
   a safety obligation and an assessor. Our caller is an unnamed API consumer. The line documents the
   transfer; nothing completes it.
5. **It is forward-only.** Retrofitting a refusal path into a sealed kernel is a hash move and a
   re-prove in the same row (SO #36). Already-gapped sealed nodes are a separate, named decision —
   they are not fixed by adopting this.
6. ⛔ **`represented` remains cheap to assert falsely, and it is the disposition a rushed author
   reaches for.** §1.3 makes `refused` expensive to fake — it costs a real code path and a real
   fixture, and the gate executes both. It gives `represented` no consumer at all. **The discipline
   is therefore asymmetric: strong exactly where the author already did the work, weak exactly where
   the author skipped it.** That asymmetry is inherent to every declaration-based approach and this
   file does not claim to have argued it away. §4's cohort measurement is the instrument that will
   show whether it bites in practice.

---

## 6. Cohort — the first run of this convention, and the measured fill quality

⭐ **The promotion criterion of §1.7, discharged.** Six nodes, inventoried 2026-08-23. Every number
below is **re-derivable** — ⛔ do not trust this table, run the gate:

```
node scripts/check-branch-inventory.mjs --metrics
```

### 6.1 Who is in it, and why

| Node | Role | Why this one |
|---|---|---|
| `art-637-globe-de-minimis-exclusion` | calibration | a counter-pattern node the audits recorded as producing zero findings — establishes what a well-filled inventory looks like |
| `art-615-mla-charge-inclusion-classifier` | calibration | second counter-pattern; the MLA carve-out is a textbook multi-predicate refusal |
| `art-617-m3p-monthly-cap-calculator` | calibration | the third counter-pattern, and the one that refuses via a **declared domain** rather than a review flag |
| `art-396-compute-15c3-3-reserve` | gapped | its **only** pinned snapshot is a head-of-provision exemption list — the cleanest test of the dominant silent-green vector |
| `art-536-reg-w-affiliate-transaction-tester` | gapped | six pinned snapshots, **four of them exemption lists**, against a node that already refuses well on one other axis |
| `art-447-securitization-risk-retention-check` | gapped | **nine** pinned snapshots against one rate and one boolean — the over-citation case (SO #39(iii)) |

### 6.2 The metric, and what it does and does not measure

> **Fill quality = the share of inventory rows whose declared disposition is CONFIRMED BY EXECUTING
> THE KERNEL.** `unrepresented_known` rows are findings: counted, never scored — a row is not "done"
> because the author admitted the gap.

| | |
|---|---:|
| Nodes inventoried | 6 |
| Branches enumerated from primary text | **71** |
| Refusal reachability (declared path actually fires) | **12 / 12 · 100%** |
| Representation evidence (named payload member appears) | **30 / 30 · 100%** |
| Assumptions of use (value + source + owner all named) | **11 / 11 · 100%** |
| **FILL QUALITY** | **53 / 53 · 100%** |
| `unrepresented_known` findings, unscored | **18 · 25.4% of all branches** |

⚠ **READ THE 100% CORRECTLY, BECAUSE IT IS THE EASIEST NUMBER HERE TO OVERCLAIM.** These six
inventories were authored by one session **holding the gate**, so what is measured is *"can the
convention be filled correctly and cheaply"* — ✅ yes — and ⛔ **not** *"will a rushed author fill it
correctly"*, which is §5.6's open question and which no single cohort can answer. The number is not
vacuous, because `scripts/check-branch-inventory.test.mjs` proves by mutation that an unreachable
refusal, a fabricated representation, an unregistered clause digest and a missing fixture each turn
the gate red. It is the *right* number for the promotion criterion — the criterion asked whether
declared refusals survive someone looking, and all twelve did.

### 6.3 What the run actually found — the number that carries the argument

⭐ **18 of 71 branches (25.4%) are `unrepresented_known`, and they are not evenly spread.** The three
calibration nodes produced **one** between them; the three gapped nodes produced **seventeen**. Every
one of the seventeen is a branch of a paragraph the node **already pins as a clause snapshot** —
these are not uncited provisions, they are cited-and-unexercised ones, invisible to every gate the
estate runs today.

Four findings worth naming, all first surfaced by this run:

1. **`art-396` — `compute({})` returns `deposit_sufficient: true`.** An empty input yields an
   affirmative "no deposit required". Its sole pinned snapshot is 17 CFR 240.15c3-3(k), which is
   entirely about when the rule **does not apply**, and none of (k)(1), (k)(1)(iv), (k)(2)(i),
   (k)(2)(ii) or (k)(3) is reachable. Declared direction: `conservative_toward_no_finding` — the
   harmful one.
2. **`art-615` — a charge type outside the closed set falls through every branch** and returns
   `included_in_mapr: null` with `MLA_CHARGE_CLASSIFIED` raised: a flag asserting classification
   happened when no branch matched. Found on a node believed clean, which is exactly why calibration
   nodes were included.
3. **`art-447` — the QRM exemption is labelled `Sec_.19` in a runtime payload string.** QRM is
   12 CFR 244.13; 244.19 is the general-exemptions section. A wrong documentary locator shipping on
   every MCP call — §3.1's class, live.
4. **`art-536` / `art-447` — head-of-provision exemption lists at scale.** 12 CFR 223.42 alone
   carries eleven exempt classes, several multi-condition; 12 CFR 244.19 carries roughly fourteen.
   Pinned, cited, exercised by nothing.

⛔ **None of the four is fixed here.** Each needs a kernel edit, which moves the digest and demands a
re-prove in the same row (SO #36) — outside this row's fence. They are recorded in the inventories,
in the branch rows named above, for the ORCH to stage.

⚖ **What this says about the §1.7 promotion criterion.** The convention is fillable, the refusals it
declares are real, and it surfaced four defects that every existing gate is green on. What it has not
yet shown is durability under authors who did not write it. ⇒ ✅ **Keep it a convention. Re-measure
after the next cohort of nodes runs it unassisted; ⛔ do not buy a permanent schema field on one
session's fill rate.**
