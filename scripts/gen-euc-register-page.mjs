#!/usr/bin/env node
// Renders euc-register.html from chaingraph/register/*.register.json (EUC-SITE-1).
// Single registry-page surface (builder judgment per the row's "download button on
// tool pages OR a single registry page" option) -- keeps the blast radius to one new
// page instead of a template edit across every tool page. The 6 BANKING-OCG kernels
// get their own section (BANKING-OCG-BUILD-SPEC.md §5.1-§5.7); a fixed cross-category
// sample demonstrates the generator covers every live node, not just banking.
// Re-run after `node scripts/gen-euc-register.mjs` any time chaingraph.json changes --
// this file is fully derived, never hand-edited.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const REGISTER_DIR = join(ROOT, "chaingraph", "register");
const CHECK = process.argv.includes("--check");

const BANKING_SET = [
  "art-439-y14-capital-worksheet-rollforward",
  "art-444-collateral-haircut-engine",
  "art-445-credit-concentration-topn-sector",
  "art-446-counterparty-internal-limit-check",
  "art-443-irrbb-basis-risk-nii-shock-calculator",
  "art-447-securitization-risk-retention-check",
];

// One node per wave-band, fixed set -- demonstrates cross-category coverage without
// embedding all 469 entries' full prose on one page.
const SAMPLE_SET = [
  "art-01-ap2-mandate-chain-validator",
  "art-14-psd3-psr-readiness-checker",
  "503-canton-tokenization-readiness-diagnostic",
  "art-52-digital-trade-fit-diagnostic",
  "art-68-carbon-compliance-fit-diagnostic",
  "art-98-mica-casp-fit-diagnostic",
  "art-129-webbotauth-signature-verifier",
  "art-153-emir-trade-report-field-validator",
  "art-177-ifrs17-measurement-model-classifier",
  "art-211-prediction-market-analyzer",
  "art-236-build-ai-decision-log-record",
  "art-258-parse-camt053-reconciliation",
  "art-275-genius-reserve-disclosure-checker",
  "art-287-revocation-status-verifier",
  "art-317-rhc-multiplier-reconciler",
  "art-335-compute-dti-ratios",
  "art-369-run-rate-shock-ladder",
  "art-408-evidence-bundle-tier-labeler",
  "art-438-eval-attestation-receipt-composer",
  "art-455-globe-sbie-topup",
];

function loadEntry(toolId) {
  return JSON.parse(readFileSync(join(REGISTER_DIR, `${toolId}.register.json`), "utf8"));
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// entry.purpose is node.description verbatim (chaingraph.json, out of this WU's
// fence) — scrub the CONTRACT §1.4 double-hyphen em-dash substitute before
// rendering as visible register-page text, same non-destructive precedent as
// gen-chaingraph-hub.mjs's sanitizeCopy (source chaingraph.json is untouched).
function sanitizeCopy(s) {
  return String(s ?? "").replace(/\s+--\s+/g, ", ").replace(/\s{2,}/g, " ").trim();
}

function shortDigest(d) {
  if (!d) return "n/a";
  const hex = d.replace(/^sha256:/, "");
  return `sha256:${hex.slice(0, 12)}...`;
}

function statusPill(entry) {
  const ready = entry.compute_proof_ready === "ready";
  return `<span class="status-pill ${ready ? "status-ready" : "status-deferred"}">${ready ? "proof ready" : "proof deferred"}</span>`;
}

function entryCard(entry) {
  const jsonHref = `chaingraph/register/${entry.tool_id}.register.json`;
  const toolHref = entry.source_url ? entry.source_url.replace(/^https:\/\/ainumbers\.co\//, "") : "#";
  return `
      <div class="reg-card">
        <div class="reg-head">
          <a class="reg-title" href="${esc(toolHref)}">${esc(entry.display_name)}</a>
          ${statusPill(entry)}
        </div>
        <p class="reg-meta">tool_id <code>${esc(entry.tool_id)}</code> &middot; v${esc(entry.tool_version)} &middot; data vintage ${esc(entry.data_vintage || "n/a")}</p>
        <p class="reg-purpose">${esc(sanitizeCopy(entry.purpose))}</p>
        <p class="reg-trust">${esc(entry.trust_label)}</p>
        <p class="reg-digest">kernel digest <code>${esc(shortDigest(entry.kernel_digest))}</code></p>
        <a class="reg-download" href="${jsonHref}" download>Download register entry (JSON)</a>
      </div>`;
}

function renderSection(title, note, toolIds) {
  const cards = toolIds.map((id) => entryCard(loadEntry(id))).join("\n");
  return `
    <section class="reg-section" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2>
      <p class="reg-section-note">${note}</p>
${cards}
    </section>`;
}

function render() {
  const index = JSON.parse(readFileSync(join(REGISTER_DIR, "index.json"), "utf8"));
  const bankingSection = renderSection(
    "Banking & capital reporting",
    "The BANKING-OCG program kernels: FR Y-14 roll-forward, IRRBB shock calculators, collateral haircut, credit concentration, counterparty limits, and securitization risk retention.",
    BANKING_SET
  );
  const sampleSection = renderSection(
    "Sample across other categories",
    "A fixed cross-category sample proving the generator is not banking-only. Every one of the " + index.count + " live nodes has its own entry under <code>chaingraph/register/&lt;tool_id&gt;.register.json</code>, listed in <a href=\"chaingraph/register/index.json\">index.json</a>.",
    SAMPLE_SET
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<title>EUC Register | AINumbers.co</title>
<meta name="description" content="Generated end-user-computing register entries for AINumbers.co tools: kernel version and hash, declared inputs and outputs, control description, trust label, data vintage, and last-validated date -- one entry per live tool, regenerated from source metadata.">
<meta name="robots" content="index, follow">
<meta name="author" content="AINumbers.co">
<link rel="canonical" href="https://ainumbers.co/euc-register.html">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="EUC Register | AINumbers.co">
<meta property="og:description" content="Generated end-user-computing register entries: kernel version and hash, declared inputs and outputs, control description, trust label, and last-validated date per tool.">
<meta property="og:url" content="https://ainumbers.co/euc-register.html">
<meta property="og:site_name" content="AINumbers.co">

<!-- Favicon -->
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23080E1A'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='Sora,sans-serif' font-weight='600' font-size='13' fill='%2314B8A6'>AI</text></svg>">

<!-- Schema.org -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://ainumbers.co/#org",
      "name": "AINumbers.co",
      "url": "https://ainumbers.co"
    },
    {
      "@type": "CollectionPage",
      "@id": "https://ainumbers.co/euc-register.html",
      "name": "EUC Register",
      "url": "https://ainumbers.co/euc-register.html",
      "isPartOf": { "@id": "https://ainumbers.co/#org" },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://ainumbers.co" },
          { "@type": "ListItem", "position": 2, "name": "EUC Register", "item": "https://ainumbers.co/euc-register.html" }
        ]
      }
    }
  ]
}
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">

<style>
:root {
  --bg: #080E1A; --bg-2: #0D1627; --bg-3: #111E35;
  --border: #1E2F4A; --muted: #3A5270; --body: #6888A8;
  --text: #A8C4DE; --bright: #D4E8F8; --white: #EEF6FD;
  --teal: #14B8A6; --teal-lt: #2DD4BF; --gold: #D4A847; --amber: #E0A83D;
  --radius: 6px; --radius-lg: 10px;
}
*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg); color:var(--text); font-family:'Sora',sans-serif; font-size:.9rem; line-height:1.7; min-height:100vh; }
h1,h2 { font-family:'DM Serif Display',serif; font-weight:400; line-height:1.2; }
a { color:inherit; text-decoration:none; }
code { font-family:'JetBrains Mono',monospace; font-size:.85em; color:var(--teal-lt); }
.container { max-width:960px; margin:0 auto; padding:0 2rem; }
nav{padding:0 1.5rem;height:52px;border-bottom:1px solid var(--border);background:rgba(8,14,26,.92);position:sticky;top:0;z-index:200;backdrop-filter:blur(8px)}
.nav-inner{max-width:1100px;margin:0 auto;height:100%;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:1rem}
.logo{display:flex;align-items:center;gap:10px}
.logo-name{font-family:'JetBrains Mono',monospace;font-size:.95rem;font-weight:500;color:var(--bright)}
.logo-ai{color:var(--teal)}
.logo-co{color:var(--muted);font-size:.8rem}
.nav-links{display:flex;align-items:center;gap:20px;justify-self:end}
.nav-links a{font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}
.nav-links a:hover{color:var(--teal-lt)}
.hero{padding:4rem 0 2.5rem;border-bottom:1px solid var(--border)}
.hero-eyebrow{display:flex;align-items:center;gap:.6rem;margin-bottom:1rem;font-family:'JetBrains Mono',monospace;font-size:.57rem;letter-spacing:.22em;text-transform:uppercase;color:var(--teal-lt)}
.hero-eyebrow::before{content:'';display:block;width:28px;height:1px;background:var(--teal)}
.hero h1{font-size:clamp(2rem,4vw,2.6rem);color:var(--white);margin-bottom:.85rem}
.hero-sub{font-size:.93rem;color:var(--body);max-width:680px;line-height:1.85}
.reg-section{padding:2.5rem 2rem;max-width:960px;margin:0 auto}
.reg-section + .reg-section{border-top:1px solid var(--border)}
.reg-section h2{font-size:1.5rem;color:var(--white);margin-bottom:.5rem}
.reg-section-note{font-size:.85rem;color:var(--body);margin-bottom:1.5rem;max-width:700px}
.reg-card{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.4rem 1.6rem;margin-bottom:1.1rem}
.reg-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:.4rem}
.reg-title{font-family:'DM Serif Display',serif;font-size:1.1rem;color:var(--bright)}
.reg-title:hover{color:var(--teal-lt)}
.status-pill{font-family:'JetBrains Mono',monospace;font-size:.55rem;letter-spacing:.08em;text-transform:uppercase;padding:.25rem .55rem;border-radius:999px;white-space:nowrap}
.status-ready{background:rgba(20,184,166,.12);color:var(--teal-lt);border:1px solid rgba(20,184,166,.35)}
.status-deferred{background:rgba(224,168,61,.12);color:var(--amber);border:1px solid rgba(224,168,61,.35)}
.reg-meta{font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:.03em;color:var(--muted);margin-bottom:.6rem}
.reg-purpose{font-size:.82rem;color:var(--body);line-height:1.7;margin-bottom:.5rem}
.reg-trust{font-size:.75rem;color:var(--teal-lt);margin-bottom:.5rem}
.reg-digest{font-size:.7rem;color:var(--muted);margin-bottom:.7rem}
.reg-download{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);border:1px solid var(--border);border-radius:var(--radius);padding:.4rem .7rem}
.reg-download:hover{border-color:var(--gold)}
.reg-footnote{font-family:'JetBrains Mono',monospace;font-size:.6rem;color:var(--muted);margin-top:1rem;padding-top:1.5rem;border-top:1px solid var(--border)}
footer{border-top:1px solid var(--border);padding:2rem 0}
.footer-inner{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:1rem}
.footer-links{display:flex;gap:1.5rem;flex-wrap:wrap}
.footer-links a{color:var(--body);font-size:.82rem}
.footer-links a:hover{color:var(--teal-lt)}
</style>
</head>
<body>

<nav aria-label="Site navigation">
  <div class="nav-inner">
    <a href="index.html" class="logo" aria-label="AINumbers.co home">
      <div class="logo-name"><span class="logo-ai">AI</span>Numbers<span class="logo-co">.co</span></div>
    </a>
    <div class="nav-links">
      <a href="about.html">About</a>
      <a href="index.html">All Tools</a>
    </div>
  </div>
</nav>

<main>
  <header class="hero" role="banner">
    <div class="container">
      <p class="hero-eyebrow">Model risk / EUC inventory</p>
      <h1>EUC register.</h1>
      <p class="hero-sub">Every live tool on AINumbers.co is a spreadsheet a compliance officer would otherwise have to inventory by hand: name, kernel version and hash, declared inputs and outputs, a control description, a trust label, a data vintage, and a last-validated date. This page generates that register entry from the tool's own published metadata, not from a separately maintained log, so it can never drift from what is actually deployed.</p>
    </div>
  </header>

${bankingSection}
${sampleSection}

  <div class="container">
    <p class="reg-footnote">Trust labels and last-validated dates are derived from each node's <code>compute_proof_ready</code> status and pinned compute-image dates at generation time: they are never hand-set. A node moving from a deferred proof to a ready one is picked up automatically the next time <code>node scripts/gen-euc-register.mjs</code> runs; nothing here is hardcoded against a future proving pass.</p>
  </div>
</main>

<footer>
  <div class="container">
    <div class="footer-inner">
      <a href="index.html" class="logo">
        <span class="logo-name"><span class="logo-ai">AI</span>Numbers<span class="logo-co">.co</span></span>
      </a>
      <div class="footer-links">
        <a href="index.html">All Tools</a>
        <a href="about.html">About</a>
        <a href="disclosures/index.html">Disclosures</a>
        <a href="contact.html">Contact</a>
      </div>
    </div>
  </div>
</footer>

</body>
</html>
`;
}

function main() {
  const html = render();
  const outPath = join(ROOT, "euc-register.html");
  if (CHECK) {
    const current = readFileSync(outPath, "utf8");
    if (current !== html) {
      console.error("gen-euc-register-page --check: euc-register.html is stale, run `node scripts/gen-euc-register-page.mjs`");
      process.exit(1);
    }
    console.log("gen-euc-register-page --check: OK, euc-register.html is fresh.");
    return;
  }
  writeFileSync(outPath, html);
  console.log("gen-euc-register-page: wrote euc-register.html");
}

main();
