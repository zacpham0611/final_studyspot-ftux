export const FTU_COORDINATES = {
  lat: 21.02362291763909,
  lng: 105.80593781101808,
  name: 'Đại học Ngoại thương Hà Nội (FTU)',
  address: '91 Phố Chùa Láng, Láng Thượng, Đống Đa, Hà Nội',
};

/**
 * Calculates Haversine distance in meters between two lat/lng coordinates.
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number = FTU_COORDINATES.lat,
  lon2: number = FTU_COORDINATES.lng
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Formats distance meters into user friendly Vietnamese text.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km}km`;
}
