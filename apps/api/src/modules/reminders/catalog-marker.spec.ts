import { describe, expect, it } from 'vitest';

import { composeCatalogNotes, extractSlugFromNotes, TYRE_INSPECTION_SLUG } from './catalog-marker';

describe('catalog marker', () => {
  it('round-trips a slug through the notes field', () => {
    const notes = composeCatalogNotes('engine_oil_change', 'Every 10 000 km.');

    expect(notes).toContain('Every 10 000 km.');
    expect(extractSlugFromNotes(notes)).toBe('engine_oil_change');
  });

  it('marks a reminder that has no notes of its own', () => {
    expect(extractSlugFromNotes(composeCatalogNotes(TYRE_INSPECTION_SLUG))).toBe(
      TYRE_INSPECTION_SLUG,
    );
  });

  it('reads nothing from a hand-written reminder', () => {
    // The distinction the roll-forward depends on: no marker, no interval, so
    // nothing to repeat.
    expect(extractSlugFromNotes('Ask the workshop about the rattle')).toBeNull();
    expect(extractSlugFromNotes(null)).toBeNull();
    expect(extractSlugFromNotes('')).toBeNull();
  });

  it('survives a user editing text around the marker', () => {
    expect(extractSlugFromNotes('[catalog:tyre_rotation]\nBooked for Tuesday')).toBe(
      'tyre_rotation',
    );
    expect(extractSlugFromNotes('Notes\n[catalog:puc_renewal]\nmore notes')).toBe('puc_renewal');
  });

  it('reads nothing from a marker the user broke', () => {
    // Better to stop recurring than to recur on a slug guessed from a fragment.
    expect(extractSlugFromNotes('[catalog:engine_oil_change')).toBeNull();
  });
});
