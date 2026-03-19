// Utility functions for Planez airline management game

export function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function greatCircleDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function flightTime(distanceKm: number, speedKmh: number): number {
  return distanceKm / speedKmh + 0.5;
}

export function formatMoney(millions: number): string {
  if (Math.abs(millions) >= 1000) {
    return `$${(millions / 1000).toFixed(1)}B`;
  }
  return `$${millions.toFixed(1)}M`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatPercent(decimal: number): string {
  return `${Math.round(decimal * 100)}%`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function seasonalMultiplier(quarter: 1 | 2 | 3 | 4): number {
  const multipliers: Record<1 | 2 | 3 | 4, number> = {
    1: 0.85,
    2: 0.95,
    3: 1.15,
    4: 1.05,
  };
  return multipliers[quarter];
}

interface RouteEntry {
  frequency: number;
  fare: number;
  serviceQuality: number;
}

export function calculateMarketShare(
  airlineRoutes: RouteEntry,
  allRoutesOnPair: RouteEntry[]
): number {
  if (allRoutesOnPair.length === 0) return 0;

  const score = (route: RouteEntry): number => {
    // Higher frequency and service quality increase share;
    // lower fare increases share (inverse relationship)
    return (route.frequency * route.serviceQuality) / route.fare;
  };

  const airlineScore = score(airlineRoutes);
  const totalScore = allRoutesOnPair.reduce((sum, r) => sum + score(r), 0);

  if (totalScore === 0) return 0;
  return airlineScore / totalScore;
}

export function latLngToSvg(
  lat: number,
  lng: number,
  width: number,
  height: number
): { x: number; y: number } {
  const LNG_MIN = -180;
  const LNG_MAX = 180;
  const LAT_MIN = -60;
  const LAT_MAX = 80;

  // Mercator projection: x is linear in longitude, y uses mercator transform
  const mercatorY = (latDeg: number): number => {
    const latRad = (latDeg * Math.PI) / 180;
    return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  };

  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * width;

  const yMin = mercatorY(LAT_MAX); // top of map (max lat -> smallest y in SVG)
  const yMax = mercatorY(LAT_MIN); // bottom of map
  const yMerc = mercatorY(lat);

  const y = ((yMin - yMerc) / (yMin - yMax)) * height;

  return { x, y };
}
