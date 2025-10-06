import { PostalcodePOI } from '@/types/postal_code';
import type { LatLngExpression } from 'leaflet';

export function latLngExpressionToTuple(latLngExpr: LatLngExpression): [number, number] {
  // Tuple [lat, lng]
  if (Array.isArray(latLngExpr) && latLngExpr.length === 2) {
    const [lat, lng] = latLngExpr as [number, number];
    return [lat, lng];
  }
  // Leaflet LatLng object or plain literal
  if (typeof latLngExpr === 'object' && latLngExpr !== null) {
    const anyExpr = latLngExpr as any;
    const lat = anyExpr.lat;
    const lng = anyExpr.lng ?? anyExpr.lon;
    if (typeof lat === 'number' && typeof lng === 'number') {
      return [lat, lng];
    }
  }
  throw new Error('Invalid LatLng expression');
}

export function euclideanDistance(coord1: LatLngExpression, coord2: LatLngExpression) {
  const [lat1, lng1] = latLngExpressionToTuple(coord1);
  const [lat2, lng2] = latLngExpressionToTuple(coord2);
  return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2));
};


export function parseCoordinates(
  centroide_ll: string | null
) {
  if (centroide_ll == null) {
    return undefined;
  }

  const match = centroide_ll.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (match) {
    return ([parseFloat(match[2]), parseFloat(match[1])] as [number, number]);
  }
  return undefined;
}

export function getMaxDistance(positions : PostalcodePOI[]) {
  return positions.map((p) => p.distance).reduce((a, b) => Math.max(a, b), 0);
}

// Calculate distance between two coordinates using Haversine formula (in km)
export function calculateDistance([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000;
}

