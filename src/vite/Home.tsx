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
import { setMapViewToLocations } from '@/utils/map_view';
import { findCachedPostalCodesByCoordinates, loadCoordinateCacheFromPdokCache } from '@/utils/coordinate_cache';

type SelectionFeatures = 'postal_code' | 'street' | 'house_number';

export default function Home() {
  const [postalCode, setPostalCode] = useState('');
  const [streetName, setStreetName] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  const [postalCodeInfo, setPostalCodeInfo] = useState<PostalCodeInfo | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [locations, setLocations] = useState<(PointOfInterest | FormattedAddress)[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  // Bottom tray search state
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const trayRef = useRef<HTMLDivElement | null>(null);
  const inputAnchorRef = useRef<HTMLDivElement | null>(null);
  const [dropdownLeft, setDropdownLeft] = useState(0);
  const [dropdownWidth, setDropdownWidth] = useState(220);
  const [selectionFeature, setSelectionFeature] = useState<SelectionFeatures>('postal_code');

  const availableSelectionFeatures: SelectionFeatures[] =
    postalCode ? (
      streetName ? ['house_number'] :
        ['street']) : ['postal_code'];

  useEffect(() => {
    console.log('Available selection features:', availableSelectionFeatures);
    if (!availableSelectionFeatures.includes(selectionFeature)) {
      setSelectionFeature(availableSelectionFeatures[0]);
    }
  }, [availableSelectionFeatures.join(','), selectionFeature]);


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

  // Display helpers for breadcrumb tray
  const postalChipLabel = useMemo(() => {
    if (!sanitizedPostalCode) return '';
    const s = sanitizedPostalCode.toUpperCase();
    if (s.length >= 5) return `${s.slice(0, 4)} ${s.slice(4, 6)}`;
    return s;
  }, [sanitizedPostalCode]);

  const nextSearchPlaceholder = useMemo(() => {
    switch (selectionFeature) {
      case 'postal_code':
        return 'Search postal code…';
      case 'street':
        return 'Search street…';
      case 'house_number':
        return 'Search house number…';
    }
  }, [selectionFeature]);

  const availableOptions: string[] = useMemo(() => {
    if (selectionFeature === 'postal_code') {
      // Use visible postal codes from the map as suggestions
      const codes = locations
        .filter((l): l is any => (l as any).type === 'postcode')
        .map((l: any) => String(l.label || l.details?.postcode || ''))
        .filter(Boolean)
        .map((s: string) => s.replace(/\s/g, '').toUpperCase());
      return Array.from(new Set(codes)).sort();
    }
    if (selectionFeature === 'street') {
      return postalCodeInfo?.straatnamen ?? [];
    }
    if (selectionFeature === 'house_number') {
      if (!postalCodeInfo || !streetName) return [];
      const numbers = postalCodeInfo.adressen
        .filter((a) => a.straatnaam === streetName)
        .map((a) => a.nummer);
      return Array.from(new Set(numbers));
    }
    return [];
  }, [selectionFeature, locations, postalCodeInfo, streetName]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableOptions;
    return availableOptions.filter((opt) => opt.toLowerCase().includes(q));
  }, [availableOptions, searchQuery]);

  const commitSearch = useCallback(() => {
    if (selectionFeature === 'postal_code') {
      let s = searchQuery.replace(/\s/g, '').toUpperCase();
      const valid = /^\d{4}[A-Z]{2}$/.test(s);
      if (!valid) {
        if (filteredOptions.length === 0) return;
        s = String(filteredOptions[0]).replace(/\s/g, '').toUpperCase();
      }
      setPostalCode(s);
      setSearchQuery('');
      setPickerOpen(false);
      return;
    }

    if (selectionFeature === 'street') {
      let s = searchQuery.trim();
      if (!s) {
        if (filteredOptions.length === 0) return;
        s = filteredOptions[0];
      }
      setStreetName(s);
      setSearchQuery('');
      setPickerOpen(false);
      return;
    }

    if (selectionFeature === 'house_number') {
      let s = searchQuery.trim();
      if (!s) {
        if (filteredOptions.length === 0) return;
        s = filteredOptions[0];
      }
      setHouseNumber(s);
      setSearchQuery('');
      setPickerOpen(false);
      return;
    }
  }, [selectionFeature, searchQuery, filteredOptions]);

  const handleOptionSelect = useCallback((opt: string) => {
    if (selectionFeature === 'postal_code') {
      const s = String(opt).replace(/\s/g, '').toUpperCase();
      setPostalCode(s);
      setSearchQuery('');
      setPickerOpen(true);
      requestAnimationFrame(() => updateDropdownPosition());
      return;
    }

    if (selectionFeature === 'street') {
      setStreetName(opt);
      setSearchQuery('');
      setPickerOpen(true);
      requestAnimationFrame(() => updateDropdownPosition());
      return;
    }

    if (selectionFeature === 'house_number') {
      setHouseNumber(opt);
      setSearchQuery('');
      setPickerOpen(false);
      return;
    }
  }, [selectionFeature]);

  // If typing a full postal code in the tray and feature is postal_code, apply it automatically
  useEffect(() => {
    if (selectionFeature !== 'postal_code') return;
    const s = searchQuery.replace(/\s/g, '').toUpperCase();
    const valid = /^\d{4}[A-Z]{2}$/.test(s);
    if (valid) {
      setPostalCode(s);
      setSearchQuery('');
      setPickerOpen(true);
      requestAnimationFrame(() => updateDropdownPosition());
    }
  }, [searchQuery, selectionFeature]);

  // Clear query when switching feature to avoid confusing filters
  useEffect(() => {
    setSearchQuery('');
  }, [selectionFeature]);

  const updateDropdownPosition = useCallback(() => {
    const wrapper = trayRef.current;
    const anchor = inputAnchorRef.current;
    if (!wrapper || !anchor) return;
    const wRect = wrapper.getBoundingClientRect();
    const aRect = anchor.getBoundingClientRect();
    setDropdownLeft(aRect.left - wRect.left);
    setDropdownWidth(aRect.width);
  }, []);

  useEffect(() => {
    if (!isPickerOpen) return;
    updateDropdownPosition();
    const onResize = () => updateDropdownPosition();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isPickerOpen, updateDropdownPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!trayRef.current) return;
      if (!trayRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  return (
    <main className="relative h-[100svh] w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Map fills the screen */}
      <div className="absolute inset-0 z-10">
        <Map
          locations={locations}
          onLocationSelect={handleLocationSelect}
          onMove={handleMapMove}
          onMapInit={handleMapInit}
          className="h-full w-full"
        />
      </div>

      {/* Floating action button to toggle panel */}
      <button
        aria-label={panelOpen ? 'Hide search panel' : 'Show search panel'}
        onClick={() => setPanelOpen(!panelOpen)}
        className="fixed z-30 bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg grid place-items-center hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        {panelOpen ? (
          <span className="text-xl">×</span>
        ) : (
          <span className="text-xl">⌕</span>
        )}
      </button>

      {/* Collapsible side panel */}
      <section
        className={`fixed z-20 top-0 bottom-0 left-0 w-[min(92vw,420px)] max-w-full bg-white/95 dark:bg-black/80 backdrop-blur border-r border-black/10 dark:border-white/10 shadow-xl transition-transform duration-300 ease-in-out ${panelOpen ? 'translate-x-0' : '-translate-x-[calc(100%_-_3.5rem)] md:-translate-x-full'
          }`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag/peek handle for mobile when closed */}
        <div className="absolute -right-4 top-16 hidden md:block">
          {/* spacer for desktop only */}
        </div>
        <div className="h-full overflow-y-auto px-4 sm:px-6">
          <header className="sticky top-0 py-3 mb-2 pr-10">
            <h1 className="text-lg font-semibold">Find address</h1>
            {validationResult?.addressValidityMessage && (
              <p className={`mt-1 text-sm ${validationResult.addressValidityMessage.startsWith('Valid') || validationResult.addressValidityMessage.startsWith('Found') ? 'text-green-600' : 'text-red-600'}`}>
                {validationResult.addressValidityMessage}
              </p>
            )}
          </header>

          <form className="space-y-4 pb-24" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="postalCode">Postal Code</label>
              <input
                id="postalCode"
                type="text"
                inputMode="text"
                autoComplete="postal-code"
                placeholder="e.g. 1234 AB"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full rounded-md border border-black/20 dark:border-white/20 bg-white/90 dark:bg-zinc-900 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="streetName">Street Name</label>
              <input
                id="streetName"
                type="text"
                autoComplete="address-line1"
                placeholder="e.g. Main Street"
                value={streetName}
                onChange={(e) => setStreetName(e.target.value)}
                className={`w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black dark:text-white ${getBorderColor(validationResult?.streetName ?? null)} border-black/20 dark:border-white/20 bg-white/90 dark:bg-zinc-900`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="houseNumber">House Number</label>
              <input
                id="houseNumber"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="address-line2"
                placeholder="e.g. 123"
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
                className={`w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black dark:text-white ${getBorderColor(validationResult?.houseNumber ?? null)} border-black/20 dark:border-white/20 bg-white/90 dark:bg-zinc-900`}
              />
            </div>

            {validationResult?.validHouseNumbers && validationResult.validHouseNumbers.length > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Valid house numbers: {validationResult.validHouseNumbers.join(', ')}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Floating breadcrumb tray at bottom */}
      <div className="fixed z-20 bottom-0 left-0 right-0 flex justify-center px-3 sm:px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none">
        <div className="relative pointer-events-auto" ref={trayRef}>
          <div className="max-w-[min(92vw,900px)] w-fit flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/90 dark:bg-black/70 backdrop-blur shadow-lg px-2 py-1 overflow-x-auto">
            {postalChipLabel && (
              <button
                type="button"
                aria-label="Clear postal code"
                onClick={() => setPostalCode('')}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-blue-200/60 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 text-sm hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
              >
                <span className="font-medium tracking-wide">{postalChipLabel}</span>
                <span aria-hidden className="text-base leading-none">×</span>
              </button>
            )}

            {postalChipLabel && streetName && (
              <span className="shrink-0 text-sm text-gray-300">&gt;</span>
            )}

            {streetName && (
              <button
                type="button"
                aria-label="Clear street name"
                onClick={() => setStreetName('')}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-3 py-1 text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
              >
                <span className="font-medium">{streetName}</span>
                <span aria-hidden className="text-base leading-none">×</span>
              </button>
            )}

            {streetName && houseNumber && (
              <span className="shrink-0 text-sm text-gray-300">&gt;</span>
            )}

            {houseNumber && (
              <button
                type="button"
                aria-label="Clear house number"
                onClick={() => setHouseNumber('')}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-amber-200/60 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-3 py-1 text-sm hover:bg-amber-100 dark:hover:bg-amber-900/50 transition"
              >
                <span className="font-medium">{houseNumber}</span>
                <span aria-hidden className="text-base leading-none">×</span>
              </button>
            )}

            {/* Next component search input (always available) */}
            <>
              {(postalChipLabel || streetName) && (
                <span className="shrink-0 text-sm text-gray-300 dark:text-gray-300">|</span>
              )}
              <div className="relative inline-block" ref={inputAnchorRef}>
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => { setPickerOpen(true); requestAnimationFrame(() => updateDropdownPosition()); }}
                  onChange={(e) => { setSearchQuery(e.target.value); setPickerOpen(true); requestAnimationFrame(() => updateDropdownPosition()); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitSearch();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setPickerOpen(false);
                    }
                  }}
                  placeholder={nextSearchPlaceholder}
                  className="w-[min(60vw,220px)] md:w-64 rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 px-3 py-1 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          </div>

          {isPickerOpen && filteredOptions.length > 0 && (
            <ul
              className="absolute bottom-[calc(100%+0.5rem)] z-30 max-h-64 overflow-auto rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 text-black dark:text-white shadow-xl"
              style={{ left: dropdownLeft, width: dropdownWidth }}
            >
              {filteredOptions.map((opt) => {
                const display = selectionFeature === 'postal_code'
                  ? (() => { const s = String(opt).replace(/\s/g, '').toUpperCase(); return s.length >= 5 ? `${s.slice(0, 4)} ${s.slice(4, 6)}` : s; })()
                  : opt;
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      onClick={() => handleOptionSelect(opt)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-zinc-800"
                    >
                      {display}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </div>
    </main>
  );
}