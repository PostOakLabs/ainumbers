// gen-guides-index.mjs — renders the category-hub card grid in guides/index.html from the
// guides/*-hub.html files on disk. Closes GUIDES-INDEX-GEN-1: 69 of 103 guides/*.html were
// orphaned from the hand-maintained guides/index.html (only 34 carded), including 32 real
// *-hub.html pages with zero card. Same class as HUB-GEN-1 (chaingraph-hub.html): reachability
// gates (sitemap, nav) passed while the human-facing directory silently drifted.
//
// SCOPE: this generator owns ONLY the "Category hubs" section (GEN:HUB-CARDS markers) and the
// hero hub-count badge. The "Evidence guides" and "Reference & demos" sections are hand-authored
// content outside this WU's fence (guides/*.html bodies are read-only inputs) and are carried
// through verbatim from EVIDENCE_CARDS / REFERENCE_CARDS below.
//
// REDIRECT SHIMS: guides/*-composer.html and guides/*-workflow.html are ALL meta-refresh
// redirect stubs to chaingraph/chains/*.html today (islands by design, never delete — see
// memory project-ainumbers-guide-redirect-shims). A shim is detected by a
// `<meta http-equiv="refresh" ...>` tag and EXCLUDED from the directory — do not card a
// redirect page. If a future composer/workflow page ships as real content (not a shim), it
// is picked up automatically into its own section.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const GUIDES_DIR = resolve(REPO, 'guides');
const INDEX = resolve(GUIDES_DIR, 'index.html');

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#8217;/g, '’');
}

function cleanTitle(raw) {
  let t = decodeEntities(raw).trim();
  t = t.replace(/\s*[·|]\s*AINumbers\.co\s*$/i, '');
  t = t.replace(/\s*[·|]\s*Cat-\d+\s*$/i, '');
  return t.trim();
}

function readFile(name) {
  return readFileSync(resolve(GUIDES_DIR, name), 'utf8');
}

function isShim(html) {
  return /<meta\s+http-equiv=["']refresh["']/i.test(html);
}

function extractCard(name, kind) {
  const html = readFile(name);
  if (isShim(html)) return null;
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const descMatch =
    html.match(/<meta\s+name=["']description["']\s+content="([^"]*)"/i) ||
    html.match(/<meta\s+name=["']description["']\s+content='([^']*)'/i);
  const title = titleMatch ? cleanTitle(titleMatch[1]) : name;
  let desc = descMatch ? decodeEntities(descMatch[1]).trim() : '';
  // First full sentence only, keeps cards scannable (mirrors gen-chaingraph-hub's card-desc
  // truncation). Split on ". " (sentence boundary) only -- NOT ":" or other punctuation, which
  // would cut a description mid-clause (e.g. "OTLP/JSON tooling for agent traces: a composer...").
  const firstSentence = desc.split(/(?<=\.)\s+(?=[A-Z0-9])/)[0];
  if (firstSentence && firstSentence.length >= 40 && firstSentence.length <= 220) desc = firstSentence;
  else if (desc.length > 200) desc = desc.slice(0, 200) + '…';
  return { name, kind, title, desc };
}

function collect(suffix, kind) {
  const files = readdirSync(GUIDES_DIR).filter((f) => f.endsWith(suffix));
  const cards = [];
  for (const f of files) {
    const card = extractCard(f, kind);
    if (card) cards.push(card);
  }
  cards.sort((a, b) => a.title.localeCompare(b.title));
  return cards;
}

const hubCards = collect('-hub.html', 'Hub');
const composerCards = collect('-composer.html', 'Composer');
const workflowCards = collect('-workflow.html', 'Workflow');
const extraCards = [...composerCards, ...workflowCards];

// Hand-authored sections outside this WU's fence: existing evidence/reference guide bodies.
// Kept as a static list here (not derived from disk) — see script header.
const EVIDENCE_CARDS = [
  ['nav-verification-pack.html', 'Guide', 'NAV Verification Pack', 'What a NAV recompute receipt proves for fund administrators and auditors.'],
  ['vop-liability-evidence.html', 'Guide', 'VoP Liability Evidence', 'What a Verification of Payee session receipt proves for PSPs and reimbursement reviewers.'],
  ['idv-session-evidence-guide.html', 'Guide', 'IDV / KYC Session Evidence', 'How camera-provenance checks and session receipt hash-chaining fit together.'],
  ['collections-compliance-pack.html', 'Guide', 'Collections Compliance Pack', 'What a collections compliance receipt proves for debt collectors and compliance teams.'],
  ['data-room-disclosure-manifest-guide.html', 'Guide', 'Data Room Disclosure Manifests', 'Prove exactly what was in a data room for M&A and R&W insurance.'],
  ['ebl-control-evidence-guide.html', 'Guide', 'eBL Exclusive Control', 'Verifiable singularity and exclusive-control evidence for electronic bills of lading.'],
  ['aiuc-insurance-evidence.html', 'Guide', 'Insurable Agent Evidence', 'The AIUC-1 readiness checkrun and quarterly test-evidence tooling.'],
  ['audit-ai-evidence-review.html', 'Guide', 'AI Evidence Auditors Can Review', 'How signed compute receipts map to AI-tool-usage documentation elements.'],
  ['ai-act-evidence-cron.html', 'Guide', 'AI Act Art-12 Evidence Cron', 'Weekly receipted compliance bundles mapped to OSCAL assessment results.'],
  ['pqc-migration-evidence.html', 'Guide', 'PQC Migration Evidence', 'What a post-quantum cryptography migration evidence receipt proves.'],
  ['reserve-watch-continuous-verification.html', 'Guide', 'Continuous Reserve Watch', 'A weekly cron that replays a stablecoin issuer’s reserve report through the live check.'],
  ['recomputation-evidence-pack-guide.html', 'Guide', 'Recomputation Evidence Pack: CPA-in-Loop Specialist Input', 'How a recompute evidence pack fits into a CPA’s AU-C 500/620 specialist workflow, and what it deliberately does not claim to be.'],
  ['benchmark-series-methodology.html', 'Guide', 'Benchmark Series Methodology', 'Source corpus, derivation formula, and receipt format for the CCP Margin Monitor and Stablecoin Reserve Scorecard.'],
  ['benchmark-series-reserve-scorecard-issue-2026-06.html', 'Issue', 'Reserve Scorecard, Issue #1: EURC, June 2026', 'EURC’s June 2026 reserve disclosure, recomputed and receipted against declared MiCA coverage, composition, segregation and cadence terms.'],
];

const REFERENCE_CARDS = [
  ['mcp-agent-demo.html', 'Demo', 'MCP Agent Demo', 'A live MCP agent session replay discovering and using AINumbers.co.'],
  ['mcp-clone-guide.html', 'Guide', 'Clone This MCP Server', 'Standing up an equivalent MCP server on Cloudflare Workers, with the gates and workarounds that keep it up.'],
  ['regression-replayer.html', 'Tool', 'Mandate Regression Replayer', 'Re-run an exported Policy Mandate through its originating tool and compare results.'],
  ['evidence-profile-catalog.html', 'Reference', 'Evidence Profile Catalog', 'Named evidence profiles for OpenChainGraph input attestations.'],
  ['accept-api-court-checkable-agreements.html', 'Walkthrough', 'Accept-API Agreements', 'The agent-native agreement flow: assemble and bind a court-checkable acceptance.'],
  ['authzen-pdp-provable-decisions.html', 'Walkthrough', 'AuthZEN Provable Decisions', 'An AuthZEN 1.0 Policy Decision Point that returns a decision with a provable receipt.'],
  ['quantized-credit-model.html', 'Guide', 'Quantized Credit Model', 'What a groth16 proof over a quantized credit-scoring kernel attests.'],
  ['basel-take2-impact-assessment-guide.html', 'Guide', 'Basel Endgame 2026 Reproposal', 'Reproducing the headline capital-relief number and why it understates the picture.'],
  ['lei-kyb-worksheet-guide.html', 'Guide', 'LEI Data-Quality Grading', 'How LEI grading fits into a KYB onboarding workflow.'],
  ['fedwire-chips-address-migration-guide.html', 'Guide', 'Fedwire / CHIPS Address Migration', 'Structured-address lint, batch sweep, and remediation diff for the 2026 migration.'],
  ['fr2052a-liquidity-report-reference.html', 'Reference', 'FR 2052a Report Reference', 'The FR 2052a appendix inventory, table structure, field list, and confidentiality position, linking to the Fed’s own index.'],
];

function cardHtml({ name, kind, title, desc }) {
  return `      <a class="card" href="${escHtml(name)}"><span class="kind">${escHtml(kind)}</span><h3>${escHtml(title)}</h3><p>${escHtml(desc)}</p></a>`;
}

const hubCardsHtml = hubCards.map(cardHtml).join('\n');
const extraSectionHtml = extraCards.length
  ? `\n\n<section class="section" id="composers">
  <div class="container">
    <div class="sec-label">Composers &amp; workflows</div>
    <h2 class="sec-heading">Guided assembly flows</h2>
    <p class="sec-sub">Step-by-step composers that assemble a workflow chain end to end.</p>
    <div class="cards">
${extraCards.map(cardHtml).join('\n')}
    </div>
  </div>
</section>`
  : '';

const evidenceCardsHtml = EVIDENCE_CARDS.map(([name, kind, title, desc]) => cardHtml({ name, kind, title, desc })).join('\n');
const referenceCardsHtml = REFERENCE_CARDS.map(([name, kind, title, desc]) => cardHtml({ name, kind, title, desc })).join('\n');

const hubCount = hubCards.length;
const evidenceCount = EVIDENCE_CARDS.length;
const referenceCount = REFERENCE_CARDS.length;

const HUB_BLOCK_RE = /<!-- GEN:HUB-CARDS:START[\s\S]*?GEN:HUB-CARDS:END -->/;
const EVIDENCE_BLOCK_RE = /<!-- GEN:EVIDENCE-CARDS:START[\s\S]*?GEN:EVIDENCE-CARDS:END -->/;
const REFERENCE_BLOCK_RE = /<!-- GEN:REFERENCE-CARDS:START[\s\S]*?GEN:REFERENCE-CARDS:END -->/;
const EXTRA_BLOCK_RE = /<!-- GEN:EXTRA-SECTION:START[\s\S]*?GEN:EXTRA-SECTION:END -->/;
const HUB_BADGE_RE = /<span class="hero-badge badge-gold">\d+ category hubs<\/span>/;
const EVIDENCE_BADGE_RE = /<span class="hero-badge badge-teal">\d+ evidence guides<\/span>/;
const REFERENCE_BADGE_RE = /<span class="hero-badge badge-green">\d+ reference &amp; demos<\/span>/;

const current = readFileSync(INDEX, 'utf8');

const hubBlock = `<!-- GEN:HUB-CARDS:START (generator-owned -- do not hand-edit; regenerate via node scripts/gen-guides-index.mjs) -->
${hubCardsHtml}
    <!-- GEN:HUB-CARDS:END -->`;
const evidenceBlock = `<!-- GEN:EVIDENCE-CARDS:START (hand-authored content, out of GUIDES-INDEX-GEN-1 fence -- edit EVIDENCE_CARDS in scripts/gen-guides-index.mjs) -->
${evidenceCardsHtml}
    <!-- GEN:EVIDENCE-CARDS:END -->`;
const referenceBlock = `<!-- GEN:REFERENCE-CARDS:START (hand-authored content, out of GUIDES-INDEX-GEN-1 fence -- edit REFERENCE_CARDS in scripts/gen-guides-index.mjs) -->
${referenceCardsHtml}
    <!-- GEN:REFERENCE-CARDS:END -->`;
const extraBlock = `<!-- GEN:EXTRA-SECTION:START (generator-owned -- do not hand-edit) -->${extraSectionHtml}
<!-- GEN:EXTRA-SECTION:END -->`;

if (process.argv.includes('--check')) {
  const problems = [];
  if (!HUB_BLOCK_RE.test(current)) problems.push('GEN:HUB-CARDS markers missing');
  else {
    const embeddedHrefs = new Set(
      Array.from(current.match(HUB_BLOCK_RE)[0].matchAll(/href="([^"]+)"/g)).map((m) => m[1])
    );
    for (const c of hubCards) {
      if (!embeddedHrefs.has(c.name)) problems.push(`missing hub card: ${c.name}`);
    }
    if (embeddedHrefs.size !== hubCards.length) {
      problems.push(`hub card count mismatch: index has ${embeddedHrefs.size}, expected ${hubCards.length}`);
    }
  }
  if (!EXTRA_BLOCK_RE.test(current) && extraCards.length) problems.push('GEN:EXTRA-SECTION markers missing but composer/workflow content exists');
  if (!new RegExp(`${hubCount} category hubs`).test(current)) problems.push(`hero hub-count badge stale (expected ${hubCount})`);
  if (problems.length) {
    console.error(`gen-guides-index --check FAIL:\n${problems.map((p) => `  - ${p}`).join('\n')}\nRun: node scripts/gen-guides-index.mjs`);
    process.exit(1);
  }
  console.log(`gen-guides-index --check: index fresh (${hubCards.length} hub cards, ${extraCards.length} composer/workflow cards, ${evidenceCount} evidence, ${referenceCount} reference; all non-shim hub/composer/workflow guides carded).`);
  process.exit(0);
}

let out = current;
if (HUB_BLOCK_RE.test(out)) out = out.replace(HUB_BLOCK_RE, hubBlock);
else throw new Error('GEN:HUB-CARDS markers not found in guides/index.html (bootstrap required).');
if (EVIDENCE_BLOCK_RE.test(out)) out = out.replace(EVIDENCE_BLOCK_RE, evidenceBlock);
else throw new Error('GEN:EVIDENCE-CARDS markers not found in guides/index.html (bootstrap required).');
if (REFERENCE_BLOCK_RE.test(out)) out = out.replace(REFERENCE_BLOCK_RE, referenceBlock);
else throw new Error('GEN:REFERENCE-CARDS markers not found in guides/index.html (bootstrap required).');
if (EXTRA_BLOCK_RE.test(out)) out = out.replace(EXTRA_BLOCK_RE, extraBlock);
else throw new Error('GEN:EXTRA-SECTION markers not found in guides/index.html (bootstrap required).');
out = out.replace(HUB_BADGE_RE, `<span class="hero-badge badge-gold">${hubCount} category hubs</span>`);
out = out.replace(EVIDENCE_BADGE_RE, `<span class="hero-badge badge-teal">${evidenceCount} evidence guides</span>`);
out = out.replace(REFERENCE_BADGE_RE, `<span class="hero-badge badge-green">${referenceCount} reference &amp; demos</span>`);

writeFileSync(INDEX, out);
console.log(`gen-guides-index: rendered ${hubCards.length} hub cards, ${extraCards.length} composer/workflow cards, ${evidenceCount} evidence, ${referenceCount} reference cards into guides/index.html.`);
