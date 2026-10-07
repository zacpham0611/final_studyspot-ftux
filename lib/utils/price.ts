/**
 * StudySpot FTU - Price Range Definitions and Helpers
 */

export const PRICE_RANGES = [
  'Miễn phí',
  'Dưới 30.000đ',
  '30.000đ – 50.000đ',
  '50.000đ – 100.000đ',
  '100.000đ – 200.000đ',
  'Trên 200.000đ',
] as const;

export type PriceRange = (typeof PRICE_RANGES)[number];

export interface PriceRangeOption {
  value: PriceRange;
  label: string;
  subLabel?: string;
  level: number;
}

export const PRICE_RANGE_OPTIONS: PriceRangeOption[] = [
  { value: 'Miễn phí', label: 'Miễn phí', subLabel: '0đ / Không mất phí', level: 1 },
  { value: 'Dưới 30.000đ', label: 'Dưới 30.000đ', subLabel: 'Giá sinh viên', level: 1 },
  { value: '30.000đ – 50.000đ', label: '30.000đ – 50.000đ', level: 2 },
  { value: '50.000đ – 100.000đ', label: '50.000đ – 100.000đ', level: 3 },
  { value: '100.000đ – 200.000đ', label: '100.000đ – 200.000đ', level: 4 },
  { value: 'Trên 200.000đ', label: 'Trên 200.000đ', level: 4 },
];

/**
 * Normalizes any legacy or variant price range string into one of the 6 standard options.
 */
export function normalizePriceRange(val: string): PriceRange {
  if (!val || typeof val !== 'string') return '30.000đ – 50.000đ';
  const clean = val.replace(/\s+/g, ' ').trim().toLowerCase();

  // 1. Exact match against standard list FIRST
  const exactMatch = PRICE_RANGES.find((p) => p.toLowerCase() === clean);
  if (exactMatch) return exactMatch;

  // 2. Free / Miễn phí (strict check: DO NOT use clean.includes('0đ') because all VN prices have .000đ)
  if (
    clean.includes('miễn phí') ||
    clean.includes('mien phi') ||
    clean === '0đ' ||
    clean === '0 đ' ||
    clean === '0' ||
    clean === 'free'
  ) {
    return 'Miễn phí';
  }

  // 3. Under 30k
  if (
    clean.includes('dưới 30') ||
    clean.includes('duoi 30') ||
    clean.includes('< 30') ||
    clean.includes('<30') ||
    clean === '< 30.000đ'
  ) {
    return 'Dưới 30.000đ';
  }

  // 4. 30k - 50k
  if (clean.includes('30') && clean.includes('50')) {
    return '30.000đ – 50.000đ';
  }

  // 5. 50k - 100k
  if (clean.includes('50') && (clean.includes('80') || clean.includes('100'))) {
    return '50.000đ – 100.000đ';
  }

  // 6. 100k - 200k
  if (
    (clean.includes('80') && clean.includes('120')) ||
    (clean.includes('100') && clean.includes('200')) ||
    (clean.includes('120') && clean.includes('200'))
  ) {
    return '100.000đ – 200.000đ';
  }

  // 7. Above 200k
  if (
    clean.includes('trên 200') ||
    clean.includes('tren 200') ||
    clean.includes('> 200') ||
    clean.includes('>200')
  ) {
    return 'Trên 200.000đ';
  }

  return '30.000đ – 50.000đ';
}

/**
 * Normalizes price ranges from a place into the 6 standard options.
 * If price_ranges is missing or empty, safely falls back to place.price_level mapping.
 */
export function getPriceRangesFromPlace(place?: {
  price_ranges?: string[];
  opening_hours?: { price_ranges?: string[] };
  price_level?: number;
} | null): PriceRange[] {
  if (!place) return [];

  let rawList: string[] = [];
  if (Array.isArray(place.price_ranges) && place.price_ranges.length > 0) {
    rawList = place.price_ranges;
  } else if (Array.isArray(place.opening_hours?.price_ranges) && place.opening_hours.price_ranges.length > 0) {
    rawList = place.opening_hours.price_ranges;
  }

  if (rawList.length > 0) {
    const deduped = new Set<PriceRange>();
    rawList.forEach((r) => {
      if (r && typeof r === 'string') {
        deduped.add(normalizePriceRange(r));
      }
    });
    if (deduped.size > 0) {
      return Array.from(deduped);
    }
  }

  // Safe fallback based on price_level for legacy places
  if (place.price_level != null) {
    switch (Number(place.price_level)) {
      case 1:
        return ['Dưới 30.000đ'];
      case 2:
        return ['30.000đ – 50.000đ'];
      case 3:
        return ['50.000đ – 100.000đ'];
      case 4:
        return ['100.000đ – 200.000đ'];
    }
  }

  return [];
}

/**
 * Calculates a valid integer between 1 and 4 for the public.places.price_level column
 * to maintain complete database constraint and legacy filter compatibility:
 * 1: Miễn phí, Dưới 30.000đ
 * 2: 30.000đ – 50.000đ
 * 3: 50.000đ – 100.000đ
 * 4: 100.000đ – 200.000đ, Trên 200.000đ
 */
export function calculatePriceLevel(priceRanges: string[]): number {
  if (!priceRanges || priceRanges.length === 0) return 2;
  const normalized = priceRanges.map((r) => normalizePriceRange(r));

  if (normalized.some((r) => r === 'Miễn phí' || r === 'Dưới 30.000đ')) {
    if (!normalized.some((r) => r !== 'Miễn phí' && r !== 'Dưới 30.000đ')) {
      return 1;
    }
  }

  if (normalized.some((r) => r === 'Trên 200.000đ' || r === '100.000đ – 200.000đ')) return 4;
  if (normalized.some((r) => r === '50.000đ – 100.000đ')) return 3;
  if (normalized.some((r) => r === '30.000đ – 50.000đ')) return 2;
  return 1;
}
