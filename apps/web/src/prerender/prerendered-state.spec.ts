import { describe, expect, it } from 'vitest';

import { PRERENDER_STATE_ELEMENT_ID, takePrerenderedState } from './prerendered-state';

function embed(text: string) {
  const element = document.createElement('script');
  element.type = 'application/json';
  element.id = PRERENDER_STATE_ELEMENT_ID;
  element.textContent = text;
  document.body.appendChild(element);
}

const BUILT_AT = Date.parse('2026-09-01T00:00:00Z');
const NOW = Date.parse('2026-09-23T10:00:00Z');

describe('takePrerenderedState', () => {
  it('is null on a page that was not prerendered', () => {
    expect(takePrerenderedState(document, NOW)).toBeNull();
  });

  it('reads the cache once, dated to now so it does not refetch on arrival', () => {
    embed(
      JSON.stringify({
        mutations: [],
        queries: [
          {
            queryKey: ['publicCatalog', 'variant'],
            queryHash: '["publicCatalog","variant"]',
            state: { data: { ok: true }, dataUpdatedAt: BUILT_AT, status: 'success' },
          },
        ],
      }),
    );

    const state = takePrerenderedState(document, NOW);

    expect(state?.queries[0]?.state).toMatchObject({ data: { ok: true }, dataUpdatedAt: NOW });
    expect(document.getElementById(PRERENDER_STATE_ELEMENT_ID)).toBeNull();
    expect(takePrerenderedState(document, NOW)).toBeNull();
  });

  it('ignores a cache it cannot read', () => {
    embed('{not json');
    expect(takePrerenderedState(document, NOW)).toBeNull();

    embed(JSON.stringify({ queries: 'nope' }));
    expect(takePrerenderedState(document, NOW)).toBeNull();
  });
});
