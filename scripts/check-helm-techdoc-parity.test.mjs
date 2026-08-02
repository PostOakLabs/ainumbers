#!/usr/bin/env node
/**
 * check-helm-techdoc-parity.test.mjs — tamper fixtures for the Helm technical
 * design page parity gate.
 *
 * A gate asserted to work but never observed failing is the most common
 * false-green there is. These drive the real checker and assert it goes RED
 * for each drift class it claims to catch, and GREEN on the shipped files.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectIssues } from './check-helm-techdoc-parity.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_DIR = resolve(REPO, 'helm', 'technical-design');
const manifest = JSON.parse(readFileSync(resolve(VENDOR_DIR, 'MANIFEST.json'), 'utf8'));
const vendoredBytes = readFileSync(resolve(VENDOR_DIR, manifest.sourcePath.split('/').pop()));
const markdown = vendoredBytes.toString('utf8');
const page = readFileSync(resolve(REPO, 'helm-technical-design.html'), 'utf8');

test('green on the shipped page and vendored markdown', () => {
  assert.deepEqual(collectIssues(markdown, page, manifest, vendoredBytes), []);
});

test('RED when the page adds a section the markdown does not define', () => {
  const invented =
    page.replace(
      '<footer>',
      '<div class="section" id="s99">\n  <div class="wrap">\n    <div class="sec-num">Section 99</div>\n    <h2>Invented</h2>\n  </div>\n</div>\n\n<footer>'
    );
  const issues = collectIssues(markdown, invented, manifest, vendoredBytes);
  assert.ok(issues.some((e) => /page section id="s99" is labelled Section 99, which the markdown does not define/.test(e)), issues.join('\n'));
  assert.ok(issues.some((e) => /section id="s99" has no TOC entry \(orphan section\)/.test(e)), issues.join('\n'));
});

test('RED when a markdown section is missing from the page', () => {
  const dropped = page.replace(/<div class="section" id="s9">[\s\S]*?(?=<footer>)/, '');
  const issues = collectIssues(markdown, dropped, manifest, vendoredBytes);
  assert.ok(issues.some((e) => /the markdown defines section 9 .* but the page has 0 section\(s\)/.test(e)), issues.join('\n'));
});

test('RED when a TOC entry points at no section', () => {
  const broken = page.replace('href="#s5"', 'href="#s5-typo"');
  const issues = collectIssues(markdown, broken, manifest, vendoredBytes);
  assert.ok(issues.some((e) => /TOC links #s5-typo but no section with that id exists/.test(e)), issues.join('\n'));
});

test('RED when the page invents a subheading', () => {
  const invented = page.replace('<h3>Anchoring</h3>', '<h3>Anchoring</h3>\n      <h3>Roadmap</h3>');
  const issues = collectIssues(markdown, invented, manifest, vendoredBytes);
  assert.ok(issues.some((e) => /the page shows subheading "Roadmap", which the markdown does not define/.test(e)), issues.join('\n'));
});

test('RED when the vendored markdown is edited in place without re-vendoring', () => {
  const tampered = Buffer.from(markdown + '\nedited in place\n', 'utf8');
  const issues = collectIssues(tampered.toString('utf8'), page, manifest, tampered);
  assert.ok(issues.some((e) => /does not match MANIFEST\.json/.test(e)), issues.join('\n'));
});

test('RED when the page pin meta disagrees with the manifest', () => {
  const stale = page.replace(manifest.pinnedSha, '0'.repeat(40));
  const issues = collectIssues(markdown, stale, manifest, vendoredBytes);
  assert.ok(issues.some((e) => /page pinned-sha meta .* does not match MANIFEST\.json pinnedSha/.test(e)), issues.join('\n'));
});
