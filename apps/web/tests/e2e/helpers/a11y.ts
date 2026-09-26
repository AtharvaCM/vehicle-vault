import { appendFileSync } from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** WCAG 2.1 A and AA: what the design language commits to. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** What fails the gate; minor and moderate findings are reported, not failed. */
const BLOCKING = new Set(['serious', 'critical']);

/**
 * Runs axe over the page as it stands and fails on any serious or critical
 * WCAG 2.1 AA violation, naming each rule and the elements it hit (#353).
 * Wait for the page's content before calling it: axe checks what is there.
 */
export async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = results.violations.filter((violation) => BLOCKING.has(violation.impact ?? ''));
  const report = blocking.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes
        .slice(0, 5)
        .map(
          (node) =>
            `    ${node.target.join(' ')} — ${node.failureSummary?.split('\n')[1]?.trim() ?? ''}`,
        )
        .join('\n'),
  );
  // Set to a file to collect every page's findings instead of stopping at the first.
  const reportFile = process.env.A11Y_REPORT;
  if (reportFile) {
    if (report.length > 0) appendFileSync(reportFile, `## ${label}\n${report.join('\n')}\n\n`);
    return;
  }
  expect(blocking, `${label}\n${report.join('\n')}`).toEqual([]);
}

/** Light, then dark: the same page under each colour scheme. */
export const COLOUR_SCHEMES = ['light', 'dark'] as const;
