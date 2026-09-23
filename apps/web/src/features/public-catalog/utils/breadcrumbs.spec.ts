import { describe, expect, it } from 'vitest';

import { publicCatalogBreadcrumbs } from './breadcrumbs';

const make = { name: 'Hyundai', slug: 'hyundai' };
const model = { name: 'i20', slug: 'i20' };

describe('publicCatalogBreadcrumbs', () => {
  it('runs from the browse page down to a variant, the page itself last', () => {
    expect(
      publicCatalogBreadcrumbs({
        segment: 'cars',
        make,
        model,
        generation: { slug: 'i20-lineup' },
        variant: { name: 'Asta (O)', slug: 'asta-o' },
      }),
    ).toEqual([
      { name: 'Cars', address: { segment: 'cars' } },
      { name: 'Hyundai', address: { segment: 'cars', make: 'hyundai' } },
      { name: 'i20', address: { segment: 'cars', make: 'hyundai', model: 'i20' } },
      {
        name: 'Asta (O)',
        address: {
          segment: 'cars',
          make: 'hyundai',
          model: 'i20',
          generation: 'i20-lineup',
          variant: 'asta-o',
        },
      },
    ]);
  });

  it('stops at the model on a model page and at the make on a make page', () => {
    expect(
      publicCatalogBreadcrumbs({ segment: 'bikes', make, model }).map((crumb) => crumb.name),
    ).toEqual(['Bikes', 'Hyundai', 'i20']);
    expect(publicCatalogBreadcrumbs({ segment: 'cars', make }).map((crumb) => crumb.name)).toEqual([
      'Cars',
      'Hyundai',
    ]);
  });

  it('is just the segment on a browse page', () => {
    expect(publicCatalogBreadcrumbs({ segment: 'bikes' })).toEqual([
      { name: 'Bikes', address: { segment: 'bikes' } },
    ]);
  });
});
