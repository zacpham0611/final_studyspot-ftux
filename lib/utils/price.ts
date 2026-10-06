/**
 * StudySpot FTU - Price Range Definitions and Helpers
 */

export const PRICE_RANGES = [
  'Miễn phí',
  'Dưới 30.000đ',
  '30.000đ – 50.000đ',
  '50.000đ – 80.000đ',
  '80.000đ – 120.000đ',
  '120.000đ – 200.000đ',
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
  { value: '50.000đ – 80.000đ', label: '50.000đ – 80.000đ', level: 3 },
  { value: '80.000đ – 120.000đ', label: '80.000đ – 120.000đ', level: 3 },
  { value: '120.000đ – 200.000đ', label: '120.000đ – 200.000đ', level: 4 },
  { value: 'Trên 200.000đ', label: 'Trên 200.000đ', level: 4 },
];

/**
 * Normalizes price ranges from a place.
 * Returns empty array if price_ranges is not present, keeping price_level strictly
 * for backward compatibility without fabricating exact price ranges.
 */
export function getPriceRangesFromPlace(place?: {
  price_ranges?: string[];
  opening_hours?: { price_ranges?: string[] };
  price_level?: number;
} | null): string[] {
  if (!place) return [];

  if (Array.isArray(place.price_ranges) && place.price_ranges.length > 0) {
    return place.price_ranges;
  }

  if (Array.isArray(place.opening_hours?.price_ranges) && place.opening_hours.price_ranges.length > 0) {
    return place.opening_hours.price_ranges;
  }

  return [];
}

/**
 * Calculates a valid integer between 1 and 4 for the public.places.price_level column
 * to maintain complete database constraint and legacy filter compatibility.
 */
export function calculatePriceLevel(priceRanges: string[]): number {
  if (!priceRanges || priceRanges.length === 0) return 2;
  if (priceRanges.some((r) => r.toLowerCase().includes('miễn phí') || r.includes('0đ') || r.includes('< 30') || r.includes('Dưới 30'))) return 1;
  if (priceRanges.some((r) => r.includes('30.000') || r.includes('30k'))) return 2;
  if (priceRanges.some((r) => r.includes('50.000') || r.includes('80.000') || r.includes('50k') || r.includes('80k'))) return 3;
  if (priceRanges.some((r) => r.includes('120') || r.includes('200') || r.includes('Trên'))) return 4;
  return 2;
}
