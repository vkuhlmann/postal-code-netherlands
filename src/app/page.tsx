'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import L, { map } from 'leaflet';
import { getPostalCodeInfo, getPostalCodesByCoordinates, PostalCodeInfo, validateAddress, ValidationResult, FormattedAddress, PointOfInterest } from './postal_code';
import { euclideanDistance } from '@/utils/locations';



export function setMapViewToLocations(map : L.Map, locations: FormattedAddress[]) {
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

export default function Home() {
  const [postalCode, setPostalCode] = useState('');
  const [streetName, setStreetName] = useState('');
  const [houseNumber, setHouseNumber] = useState('');

  const [postalCodeInfo, setPostalCodeInfo] = useState<PostalCodeInfo | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [locations, setLocations] = useState<(PointOfInterest | FormattedAddress)[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  
  // Debounce timer for map movement
  const mapMoveTimer = useRef<NodeJS.Timeout | null>(null);
  // Map reference for direct map control
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const checkPostalCode = async () => {
      const sanitizedPostalCode = postalCode.replace(/\s/g, '');
      if (sanitizedPostalCode.length === 6) {
        try {
          const info = await getPostalCodeInfo(sanitizedPostalCode);
          setPostalCodeInfo(info);

          if (info.straatnamen.length === 1) {
            setStreetName(info.straatnamen[0]);
          }
        } catch (error) {
          console.error('Failed to fetch postal code info:', error);
          setPostalCodeInfo(null);
        }
      } else {
        setPostalCodeInfo(null);
        setStreetName('');
        setHouseNumber('');
      }
    };
    checkPostalCode();
  }, [postalCode]);

  useEffect(() => {
    const result = validateAddress(postalCodeInfo, streetName, houseNumber, postalCode);
    setValidationResult(result);
    setLocations(result.locations);
    if (mapRef.current) {
      setMapViewToLocations(mapRef.current, result.locations);
    }
  }, [streetName, houseNumber, postalCodeInfo, postalCode]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (mapMoveTimer.current) {
        clearTimeout(mapMoveTimer.current);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = validateAddress(postalCodeInfo, streetName, houseNumber, postalCode);
    setValidationResult(result);
    setLocations(result.locations);
    if (mapRef.current) {
      setMapViewToLocations(mapRef.current, result.locations);
    }
  };

  const handleLocationSelect = (location: PointOfInterest) => {
    const postalCode = location.details.postcode;
    const streetName = location.details.straatnaam;
    const houseNumber = location.type == "adres" && location.nummer;

    if (postalCode) {
      setPostalCode(postalCode);
    }
    if (streetName) {
      setStreetName(streetName);
    }
    if (houseNumber) {
      setHouseNumber(houseNumber);
    }
    };

  const handleMapInit = (map: L.Map) => {
    mapRef.current = map;
    console.log('Map initialized:', map);
  };

  const handleMapMove = (center: [number, number]) => {
    setMapCenter(center);
  };

  useEffect(() => {
    const center = mapCenter;

    console.log('Map moved to:', center);
    if (postalCodeInfo != null || !center) {
      return;
    }

    // Clear previous timer
    if (mapMoveTimer.current) {
      clearTimeout(mapMoveTimer.current);
    }

    let map = mapRef.current;
    if (!map) {
      console.error('Map reference is not set');
      return;
    }

    let bounds = map.getBounds();
    let diameterDegrees = euclideanDistance(bounds.getNorthEast(), bounds.getSouthWest());
    
    // Approximate conversion from degrees to meters
    // Is approximately 10 km / 90 degrees = 111 km per degree
    let diameterMeters = diameterDegrees * 111320;

    console.log('Map bounds diameter in degrees:', diameterDegrees);
    console.log('Map bounds diameter in meters:', diameterMeters);

    // Set new timer for debounced fetch
    mapMoveTimer.current = setTimeout(async () => {
      try {
        console.log('Fetching postal codes for coordinates:', center);
        const postalCodes = await getPostalCodesByCoordinates(center, { radius: diameterMeters / 2, maxCount: 100 });
        setLocations(postalCodes.length < 100 ? postalCodes : []);
      } catch (error) {
        console.error('Failed to fetch postal codes for coordinates:', error);
      }
    }, 500); // 500ms debounce delay
  }, [postalCodeInfo, mapCenter]);

  const Map = useMemo(
    () =>
      dynamic(() => import('@/components/Map'), {
        loading: () => <p>A map is loading</p>,
        ssr: false,
      }),
    []
  );

  const getBorderColor = (status: boolean | null) => {
    if (status === null) return '';
    return status ? 'border-green-500' : 'border-red-500';
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md">
        <form
          className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4"
          onSubmit={handleSubmit}
        >
          <div className="mb-4">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="postalCode"
            >
              Postal Code
            </label>
            <input
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
              id="postalCode"
              type="text"
              placeholder="e.g. 1234 AB"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="streetName"
            >
              Street Name
            </label>
            <input
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${getBorderColor(
                validationResult?.streetName ?? null
              )}`}
              id="streetName"
              type="text"
              placeholder="e.g. Main Street"
              value={streetName}
              onChange={(e) => setStreetName(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="houseNumber"
            >
              House Number
            </label>
            <input
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${getBorderColor(
                validationResult?.houseNumber ?? null
              )}`}
              id="houseNumber"
              type="text"
              placeholder="e.g. 123"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
            />
          </div>

          {validationResult?.validHouseNumbers && validationResult.validHouseNumbers.length > 0 && (
            <div className="mb-4 text-sm text-gray-600">
              Valid house numbers: {validationResult.validHouseNumbers.join(', ')}
            </div>
          )}

          {validationResult?.addressValidityMessage && (
            <div
              className={`mb-4 text-sm ${ 
                validationResult.addressValidityMessage.startsWith('Valid') || validationResult.addressValidityMessage.startsWith('Found')
                  ? 'text-green-500'
                  : 'text-red-500'
              }`}
            >
              {validationResult.addressValidityMessage}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="submit"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
      <div className="w-full max-w-md mt-8">
        <Map 
          locations={locations} 
          onLocationSelect={handleLocationSelect} 
          onMove={handleMapMove}
          onMapInit={handleMapInit}
        />
      </div>
    </main>
  );
}