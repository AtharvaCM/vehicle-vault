import { afterEach, describe, expect, it } from 'vitest';

import { initClarity } from './init-clarity';

const clarityScripts = () =>
  [...document.querySelectorAll('script')].filter((script) => script.src.includes('clarity.ms'));

describe('initClarity', () => {
  afterEach(() => {
    document.getElementById('microsoft-clarity')?.remove();
    delete (window as { clarity?: unknown }).clarity;
  });

  it('injects nothing and defines nothing without a project id', () => {
    initClarity('');

    expect(clarityScripts()).toHaveLength(0);
    expect((window as { clarity?: unknown }).clarity).toBeUndefined();
  });

  it('loads the tag for the configured project', () => {
    initClarity('abc123xyz');

    const scripts = clarityScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe('https://www.clarity.ms/tag/abc123xyz');
    expect(scripts[0]?.async).toBe(true);
  });

  it('queues calls made before the tag arrives, like the official snippet', () => {
    initClarity('abc123xyz');

    const clarity = (window as { clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] } })
      .clarity!;
    clarity('set', 'plan', 'free');

    expect(clarity.q).toEqual([['set', 'plan', 'free']]);
  });

  it('never loads the tag twice', () => {
    initClarity('abc123xyz');
    initClarity('abc123xyz');

    expect(clarityScripts()).toHaveLength(1);
  });

  it('keeps a project id from changing the address it loads from', () => {
    initClarity('abc/../../evil');

    expect(clarityScripts()[0]?.src).toBe('https://www.clarity.ms/tag/abc%2F..%2F..%2Fevil');
  });
});
