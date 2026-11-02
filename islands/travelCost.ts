/**
 * Anfahrtskosten: the route from Schwarzenbek to an address, priced per km.
 *
 * Unlike the rest of this pack it needs two outside services, because a browser
 * alone cannot find an address or a road: Nominatim (address to coordinates) and
 * OSRM (route). Both are contacted only when the visitor presses the button, and
 * the tool says so. If the route service fails, the straight line with a road
 * factor stands in, and the result is labelled as an estimate.
 */
export const ORIGIN = { name: "Schwarzenbek", lat: 53.5048, lon: 10.4792 } as const;
export const DEFAULT_RATE_EUR = 0.3;
/** Roads run about this much longer than the straight line in Germany. */
export const ROAD_FACTOR = 1.3;
/** Average speed behind the estimated driving time, km/h. */
const ESTIMATE_KMH = 70;

export interface Place {
  lat: number;
  lon: number;
  label: string;
}

export interface Route {
  km: number;
  minutes: number;
  estimated: boolean;
}

export interface TravelCost {
  chargedKm: number;
  cost: number;
}

export function straightLineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function estimateRoute(destination: Place): Route {
  const km = straightLineKm(ORIGIN, destination) * ROAD_FACTOR;
  return { km, minutes: (km / ESTIMATE_KMH) * 60, estimated: true };
}

export function travelCost(km: number, ratePerKm: number, roundTrip: boolean): TravelCost {
  const chargedKm = km * (roundTrip ? 2 : 1);
  return { chargedKm, cost: Math.round(chargedKm * ratePerKm * 100) / 100 };
}

type Fetch = typeof fetch;

export async function findPlace(address: string, lang: string, fetcher: Fetch = fetch): Promise<Place | null> {
  const params = new URLSearchParams({ q: address, format: "jsonv2", limit: "1", countrycodes: "de,at,ch", "accept-language": lang });
  const response = await fetcher(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!response.ok) throw new Error(`geocoder ${response.status}`);
  const rows = (await response.json()) as { lat: string; lon: string; display_name: string }[];
  const row = rows[0];
  return row ? { lat: Number(row.lat), lon: Number(row.lon), label: row.display_name } : null;
}

export async function findRoute(destination: Place, fetcher: Fetch = fetch): Promise<Route> {
  try {
    const path = `${ORIGIN.lon},${ORIGIN.lat};${destination.lon},${destination.lat}`;
    const response = await fetcher(`https://router.project-osrm.org/route/v1/driving/${path}?overview=false`);
    if (!response.ok) throw new Error(`router ${response.status}`);
    const data = (await response.json()) as { routes?: { distance: number; duration: number }[] };
    const route = data.routes?.[0];
    if (!route) throw new Error("no route");
    return { km: route.distance / 1000, minutes: route.duration / 60, estimated: false };
  } catch {
    return estimateRoute(destination);
  }
}
