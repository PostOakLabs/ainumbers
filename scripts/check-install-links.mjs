#!/usr/bin/env node
// scripts/check-install-links.mjs - MCP-INSTALL-LINKS-1 gate.
// Parses the one-click install anchors (data-install-link="cursor|vscode|goose")
// out of mcp.html AND start.html, decodes each (base64 / URL-decode), and
// asserts the embedded server URL equals the canonical endpoint recomputed by
// gen-install-links.mjs (SO #34: the gate never trusts the page's own text).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installLinks } from './gen-install-links.mjs';

const ROOT = resolveRoot();
function resolveRoot() { return join(dirname(fileURLToPath(import.meta.url)), '..'); }
const PAGES = ['mcp.html', 'start.html'];
const fail = (m) => { console.error('check-install-links: FAIL\n  X ' + m); process.exit(1); };

function anchors(page) {
  const html = readFileSync(join(ROOT, page), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const out = {};
  const re = /href\s*=\s*"([^"]*)"[^>]*data-install-link="(cursor|vscode|goose)"/gi;
  let m;
  while ((m = re.exec(html))) out[m[2]] = m[1].replace(/&amp;/g, '&');
  return out;
}

// Decode each scheme's payload and return the embedded server URL.
function embeddedUrl(scheme, href) {
  if (scheme === 'cursor') {
    const m = /[?&]config=([A-Za-z0-9+/=]+)/.exec(href);
    if (!m) fail('cursor link has no config param: ' + href);
    return JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')).url;
  }
  if (scheme === 'vscode') {
    const q = href.slice('vscode:mcp/install?'.length);
    return JSON.parse(decodeURIComponent(q)).url;
  }
  // goose
  return new URL(href).searchParams.get('url');
}

let checked = 0;
for (const page of PAGES) {
  const found = anchors(page);
  for (const scheme of ['cursor', 'vscode', 'goose']) {
    const href = found[scheme];
    if (!href) fail(page + ' is missing the data-install-link="' + scheme + '" anchor');
    if (!href.startsWith(scheme + ':')) fail(page + ' ' + scheme + ' anchor has wrong scheme: ' + href);
    const url = embeddedUrl(scheme, href);
    if (url !== installLinks.endpoint) {
      fail(page + ' ' + scheme + ' anchor embeds "' + url + '", expected "' + installLinks.endpoint + '"');
    }
    checked++;
  }
}
console.log('check-install-links: GREEN - ' + checked + ' anchor(s) across ' + PAGES.length
  + ' page(s) embed the canonical endpoint ' + installLinks.endpoint);
