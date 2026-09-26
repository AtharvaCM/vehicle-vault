import { describe, expect, it } from 'vitest';

import { engineOilLine } from './engine-oil';

describe('engineOilLine', () => {
  it('reads the grade and the quantity together, or either alone', () => {
    expect(engineOilLine({ engineOilGrade: '5W-30', engineOilLitres: 3.8 })).toBe('5W-30 · 3.8 L');
    expect(engineOilLine({ engineOilGrade: '10W-40', engineOilLitres: null })).toBe('10W-40');
    expect(engineOilLine({ engineOilGrade: null, engineOilLitres: 1 })).toBe('1 L');
  });

  it('has nothing to say when neither is on file', () => {
    expect(engineOilLine({})).toBeNull();
    expect(engineOilLine({ engineOilGrade: '  ', engineOilLitres: null })).toBeNull();
  });
});
