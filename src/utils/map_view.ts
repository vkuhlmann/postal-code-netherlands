'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import L, { map } from 'leaflet';
import { euclideanDistance } from '@/utils/locations';
import { FormattedAddress } from '@/types/postal_code';

export function setMapViewToLocations(map: L.Map, locations: FormattedAddress[]) {
  if (locations && locations.length > 0) {
    const coordinates = locations.map(l => l.coordinates).filter(c => c !== null) as [number, number][];
    if (coordinates.length > 0) {
      if (coordinates.length === 1) {
        // map.setView(coordinates[0], 13);
        map.setView(coordinates[0]);
      } else {
        const bounds = new L.LatLngBounds(coordinates);
        if (Math.abs(bounds.getNorth() - bounds.getSouth()) > 0.0001 && Math.abs(bounds.getEast() - bounds.getWest()) > 0.0001) {
          map.fitBounds(bounds.pad(0.2));
        } else {
          map.setView(bounds.getCenter(), 13);
        }
      }
    }
  }
}