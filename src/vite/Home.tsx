'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import Map from '@/components/Map';
import {
  getPostalCodeInfo, getPostalCodesByCoordinates, PostalCodeInfo,
  validateAddress, ValidationResult, FormattedAddress, PointOfInterest,
} from '@/app/postal_code';
import { euclideanDistance } from '@/utils/locations';
import {setMapViewToLocations} from '@/utils/map_view';
import { findCachedPostalCodesByCoordinates, loadCoordinateCacheFromPdokCache } from '@/utils/coordinate_cache';


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

  // React Query: fetch postal code info when code is complete
  const sanitizedPostalCode = useMemo(() => postalCode.replace(/\s/g, ''), [postalCode]);

  const { data: fetchedInfo, isFetching: isPostalLoading, error: postalError } = useQuery<PostalCodeInfo, Error>({
    queryKey: ['postalCodeInfo', sanitizedPostalCode],
    queryFn: () => getPostalCodeInfo(sanitizedPostalCode),
    enabled: sanitizedPostalCode.length === 6,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // When fetched info arrives, update local state and default street if unique
  useEffect(() => {
    if (!fetchedInfo) return;
    setPostalCodeInfo(fetchedInfo);
    if (fetchedInfo.straatnamen.length === 1) {
      setStreetName(fetchedInfo.straatnamen[0]);
    }
  }, [fetchedInfo]);

  // Reset dependent fields when postal code is not complete
  useEffect(() => {
    if (sanitizedPostalCode.length !== 6) {
      setPostalCodeInfo(null);
      setStreetName('');
      setHouseNumber('');
    }
  }, [sanitizedPostalCode]);

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
    loadCoordinateCacheFromPdokCache();
  }, []);

  useEffect(() => {
    const center = mapCenter;

    console.log('Map moved to:', center);
    if (postalCodeInfo || !center) {
      return;
    }

    // Clear previous timer
    if (mapMoveTimer.current) {
      clearTimeout(mapMoveTimer.current);
    }

    const map = mapRef.current;
    if (!map) {
      console.error('Map reference is not set');
      return;
    }

    const bounds = map.getBounds();
    const diameterDegrees = euclideanDistance(bounds.getNorthEast(), bounds.getSouthWest());

    // Approximate conversion from degrees to meters
    // Is approximately 10 km / 90 degrees = 111 km per degree
    const diameterMeters = diameterDegrees * 111320;

    console.log('Map bounds diameter in degrees:', diameterDegrees);
    console.log('Map bounds diameter in meters:', diameterMeters);

    // Set new timer for debounced fetch
    mapMoveTimer.current = setTimeout(async () => {
      try {
        console.log('Fetching postal codes for coordinates:', center);
        let radius = diameterMeters / 2;
        const desired = 150;

        const cachedPostalCodes = findCachedPostalCodesByCoordinates({ center, radius }, desired);
        if (cachedPostalCodes == "overload") {
          console.warn('Not fetching postal codes, overload detected');
          setLocations([]);
          return;
        }

        if (cachedPostalCodes) {
          console.log(`Found ${cachedPostalCodes.length} results in cache`);
          console.log('Cached postal codes:', cachedPostalCodes.map(r => r.label).slice(0, 5));
          setLocations(cachedPostalCodes);
          return;
        }

        radius *= 1.2;

        if (radius > 5000) {
          console.warn('Radius is too large, skipping fetch:', radius);
          setLocations([]);
          return;
        }

        console.log(`Radius is ${radius}`);

        const { exhaustive, results: postalCodes } = await getPostalCodesByCoordinates(
          { center, radius }, { fetchCapacity: desired }
        );
        setLocations(exhaustive ? postalCodes : []);
        // setLocations(postalCodes.length < 100 ? postalCodes : []);
      } catch (error) {
        console.error('Failed to fetch postal codes for coordinates:', error);
      }
    }, 500); // 500ms debounce delay
  }, [postalCodeInfo, mapCenter]);


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
              className={`mb-4 text-sm ${validationResult.addressValidityMessage.startsWith('Valid') || validationResult.addressValidityMessage.startsWith('Found')
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