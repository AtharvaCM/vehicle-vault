import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(__dirname, 'tokens.css'), 'utf8');

/** The `--name: #rrggbb;` declarations of one top-level block, e.g. `:root` or `.dark`. */
function tokenSet(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} block in tokens.css`).toBeGreaterThanOrEqual(0);
  const block = css.slice(start, css.indexOf('\n}', start));
  const values = new Map<string, string>();

  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)) {
    values.set(name!, value!);
  }

  return values;
}

const light = tokenSet(':root');
// The dark set only overrides colours that change; the plate's stay as they are.
const dark = new Map([...light, ...tokenSet('.dark')]);

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (hi! + 0.05) / (lo! + 0.05);
}

/** Every text colour on every background it is used on. */
const TEXT_PAIRS: Array<[text: string, background: string]> = [
  ['fg', 'surface-card'],
  ['fg', 'surface-page'],
  ['fg', 'brand-tint'],
  ['fg-2', 'surface-card'],
  ['fg-2', 'surface-page'],
  ['fg-2', 'brand-tint'],
  ['fg-3', 'surface-card'],
  ['fg-3', 'surface-page'],
  ['brand', 'surface-card'],
  ['brand', 'surface-page'],
  ['brand', 'brand-tint'],
  ['on-brand', 'brand'],
  ['late', 'surface-card'],
  ['late', 'late-tint'],
  ['soon', 'surface-card'],
  ['soon', 'soon-tint'],
  ['ok', 'surface-card'],
  ['ok', 'ok-tint'],
  ['ended', 'surface-card'],
  ['plate-ink', 'plate'],
  ['plate-ev-ink', 'plate-ev'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s tokens', (_, tokens) => {
  it.each(TEXT_PAIRS)('%s on %s meets WCAG AA (4.5:1)', (text, background) => {
    const fg = tokens.get(text);
    const bg = tokens.get(background);

    expect(fg, `--${text}`).toBeDefined();
    expect(bg, `--${background}`).toBeDefined();
    expect(contrast(fg!, bg!)).toBeGreaterThanOrEqual(4.5);
  });
});
