import * as cheerio from 'cheerio';

/**
 * Fetches a URL with a delay to be respectful to the server.
 */
export async function fetchPage(url: string, delayMs = 1000): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export type ScrapedBrand = {
  name: string;
  slug: string;
  url: string;
};

export type ScrapedModel = {
  name: string;
  slug: string;
  url: string;
  isCurrent: boolean;
};

export type ScrapedVariant = {
  name: string;
  fuelType: string | null;
  transmission: string | null;
};

/**
 * Parses the CarWale /new-cars/ page to extract brand list.
 */
export function parseBrandList(html: string): ScrapedBrand[] {
  const $ = cheerio.load(html);
  const brands: ScrapedBrand[] = [];
  const seen = new Set<string>();

  // CarWale lists brands as links like /volkswagen-cars/
  $('a[href$="-cars/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/([a-z0-9-]+)-cars\//);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      const name = $(el).text().trim();
      if (name && name.length > 1) {
        brands.push({
          name,
          slug: match[1],
          url: `https://www.carwale.com${href}`,
        });
      }
    }
  });

  return brands;
}

/**
 * Parses a CarWale brand page to extract current and discontinued models.
 */
export function parseModelList(html: string, brandSlug: string): ScrapedModel[] {
  const $ = cheerio.load(html);
  const models: ScrapedModel[] = [];
  const seen = new Set<string>();

  // Non-model slugs to skip (navigation, editorial, filter pages)
  const skipSlugs = new Set([
    'price-in',
    'dealers',
    'images',
    'videos',
    'compare',
    'news',
    'reviews',
    'specifications',
    'features',
    'mileage',
    'colours',
    'on-road-price',
    'expert-reviews',
    'faqs',
    'service-centers',
    'car-loan',
  ]);

  // Non-model name patterns to skip
  const skipPatterns = [
    /expert\s*review/i,
    /\bnews\b/i,
    /\bfaq/i,
    /\bdealer/i,
    /\bprice\b/i,
    /\bcompare\b/i,
    /\bservice\b/i,
    /\bloan\b/i,
    /\bimage/i,
    /\bvideo/i,
    /\bcolour/i,
    /\bmileage/i,
    /^\[/,
    /facelift$/i,
    /\bsuv$/i,
    /^upcoming$/i,
    /\bupcoming\b/i,
  ];

  // Current models — links like /{brand}-cars/{model}/
  $(`a[href*="/${brandSlug}-cars/"]`).each((_, el) => {
    const href = $(el).attr('href') || '';
    const modelMatch = href.match(new RegExp(`/${brandSlug}-cars/([a-z0-9-]+)/?$`));
    if (modelMatch) {
      const slug = modelMatch[1];

      // Skip known non-model slugs
      if (skipSlugs.has(slug)) return;
      if (slug.includes('price-in') || slug.includes('dealer')) return;
      if (seen.has(slug)) return;

      const rawText = $(el).text().trim();
      // Remove the brand prefix (e.g., "Volkswagen Taigun" → "Taigun")
      const brandPattern = new RegExp(`^${brandSlug.replace(/-/g, '[ -]?')}\\s*`, 'i');
      const name = rawText.replace(brandPattern, '').trim();

      // Skip entries that don't look like model names
      if (!name || name.length <= 1) return;
      if (skipPatterns.some((p) => p.test(name))) return;
      // Names in brackets like [2021-2023] are generation ranges, not models
      if (name.startsWith('[') || name.startsWith('(')) return;
      // Very short slugs are often fragments
      if (slug.length <= 2) return;

      seen.add(slug);

      models.push({
        name,
        slug,
        url: `https://www.carwale.com/${brandSlug}-cars/${slug}/`,
        isCurrent: true, // Default, will update below
      });
    }
  });

  // Identify discontinued models from the "Discontinued" section
  let inDiscontinued = false;
  $('h2').each((_, el) => {
    if ($(el).text().toLowerCase().includes('discontinued')) {
      inDiscontinued = true;
      $(el)
        .parent()
        .find(`a[href*="/${brandSlug}-cars/"]`)
        .each((__, linkEl) => {
          const href = $(linkEl).attr('href') || '';
          const modelMatch = href.match(new RegExp(`/${brandSlug}-cars/([a-z0-9-]+)/?$`));
          if (modelMatch) {
            const slug = modelMatch[1];
            const existing = models.find((m) => m.slug === slug);
            if (existing) {
              existing.isCurrent = false;
            }
          }
        });
    }
  });

  return models;
}

/**
 * Parses a CarWale model page to extract variant names and basic info.
 */
export function parseVariantList(html: string): ScrapedVariant[] {
  const $ = cheerio.load(html);
  const variants: ScrapedVariant[] = [];
  const seen = new Set<string>();

  // Variants are listed as links like /brand-cars/model/variant/
  // Also look for variant names in text sections
  $('a[href*="/"]').each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href') || '';

    // Match variant links like /volkswagen-cars/taigun/comfortline/
    const parts = href.split('/').filter(Boolean);
    if (parts.length >= 3 && parts[0].endsWith('-cars')) {
      const variantSlug = parts[2];
      // Skip non-variant links
      if (
        [
          'price-in',
          'images',
          'videos',
          'compare',
          'on-road-price',
          'specifications',
          'features',
          'mileage',
          'reviews',
          'colours',
          'automatic',
        ].includes(variantSlug)
      )
        return;
      if (seen.has(variantSlug)) return;

      // Try to extract a clean variant name
      const variantName = text.replace(/^.*?\s+/, '').trim(); // Strip brand+model prefix
      if (
        variantName &&
        variantName.length > 1 &&
        !variantName.includes('Price') &&
        !variantName.includes('Rs.')
      ) {
        seen.add(variantSlug);
        variants.push({
          name: variantName,
          fuelType: null,
          transmission: null,
        });
      }
    }
  });

  // Also try to extract fuel info from spec tables
  const fuelTypes: string[] = [];
  $('*:contains("Fuel Type")').each((_, el) => {
    const next = $(el).next().text().trim().toLowerCase();
    if (['petrol', 'diesel', 'electric', 'hybrid', 'cng'].includes(next)) {
      fuelTypes.push(next);
    }
  });

  // If we found fuel types, apply to variants that don't have one
  if (fuelTypes.length > 0) {
    for (const variant of variants) {
      if (!variant.fuelType) {
        variant.fuelType = fuelTypes[0];
      }
    }
  }

  return variants;
}

/**
 * Maps scraped fuel type strings to Prisma FuelType enum values.
 */
export function mapFuelType(fuel: string | null): string {
  if (!fuel) return 'petrol'; // Default
  const lower = fuel.toLowerCase();
  if (lower.includes('diesel')) return 'diesel';
  if (lower.includes('electric')) return 'electric';
  if (lower.includes('hybrid')) return 'hybrid';
  if (lower.includes('cng')) return 'cng';
  if (lower.includes('lpg')) return 'lpg';
  return 'petrol';
}

/**
 * Determines vehicle type based on model category keywords.
 */
export function classifyVehicleType(modelName: string): 'car' | 'suv' {
  const suvKeywords = [
    'suv',
    'xuv',
    'thar',
    'bolero',
    'scorpio',
    'safari',
    'harrier',
    'nexon',
    'punch',
    'seltos',
    'sonet',
    'carens',
    'venue',
    'creta',
    'alcazar',
    'tucson',
    'taigun',
    'tiguan',
    'tayron',
    'kushaq',
    'kodiaq',
    'tera',
    'hyryder',
    'fortuner',
    'innova',
    'urban cruiser',
    'duster',
    'kiger',
    'triber',
    'brezza',
    'grand vitara',
    'jimny',
    'fronx',
    'invicto',
    'compass',
    'meridian',
    'wrangler',
    'grand cherokee',
    'hector',
    'astor',
    'gloster',
    'comet',
    'windsor',
    'c3 aircross',
    'basalt',
    'c5 aircross',
    'magnite',
    'x-trail',
    'kicks',
    'curvv',
    'tera',
  ];
  const lower = modelName.toLowerCase();
  return suvKeywords.some((kw) => lower.includes(kw)) ? 'suv' : 'car';
}
