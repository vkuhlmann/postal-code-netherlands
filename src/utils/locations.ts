import L from 'leaflet';

export function latLngExpressionToTuple (latLngExpr: L.LatLngExpression) {
   const latLng = L.latLng(latLngExpr);

   return [latLng.lat, latLng.lng];
}

export function euclideanDistance (coord1: L.LatLngExpression, coord2: L.LatLngExpression) {
  const [lat1, lng1] = latLngExpressionToTuple(coord1);
  const [lat2, lng2] = latLngExpressionToTuple(coord2);
  return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2));
};
