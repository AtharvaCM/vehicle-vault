import { describe, expect, it } from 'vitest';

import { testAccountSignals } from './test-account-signals';

describe('testAccountSignals', () => {
  it('flags the addresses the e2e suite registers', () => {
    expect(testAccountSignals('e2e+17261234567@vehiclevault.dev')).toEqual(['e2e', 'plus-tagged']);
    expect(testAccountSignals('E2E.User@Example.com')).toEqual(['e2e', 'example-domain']);
  });

  it('flags Playwright and documentation-domain addresses', () => {
    expect(testAccountSignals('playwright-run@mail.test')).toEqual(['playwright']);
    expect(testAccountSignals('someone@example.org')).toEqual(['example-domain']);
    expect(testAccountSignals('someone@mail.example.net')).toEqual(['example-domain']);
  });

  it('flags a public throwaway inbox', () => {
    expect(testAccountSignals('vehicle-vault-test-1@mailinator.com')).toEqual([
      'disposable-domain',
    ]);
    expect(testAccountSignals('e2e+1@Mailinator.com')).toEqual([
      'e2e',
      'disposable-domain',
      'plus-tagged',
    ]);
  });

  it('flags a plus-tagged address for review, even though a person might use one', () => {
    expect(testAccountSignals('owner+vv@gmail.com')).toEqual(['plus-tagged']);
  });

  it('leaves an ordinary address alone', () => {
    expect(testAccountSignals('atharva@gmail.com')).toEqual([]);
    // Near misses: "example" elsewhere in the domain is somebody's real domain.
    expect(testAccountSignals('me@example-motors.in')).toEqual([]);
    expect(testAccountSignals('me@notexample.com')).toEqual([]);
    expect(testAccountSignals('me@notmailinator.com')).toEqual([]);
  });
});
