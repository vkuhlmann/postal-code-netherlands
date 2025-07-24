// src/utils/coordinate_cache.ts

import { PdokLocalized } from "@/types/pdok";
import {
  PointOfInterest,
  PostalcodePOI,
  CoordinateCacheEntry,
  Circle
} from "@/types/postal_code";
import { fetchPdokDocs, getCachedRequests, getPdokRequestUrl } from "@/utils/pdok_api";
import { calculateDistance, getMaxDistance, parseCoordinates } from "./locations";

// Cache for coordinate-based postal code queries
const coordinateCache: CoordinateCacheEntry[] = [];

function isCircleContained(a: Circle, b: Circle) {
  const distance = calculateDistance(a.center, b.center);
  return distance + a.radius <= b.radius;
}

function extendCircle(a: Circle, amount: number) {
  return {
    center: a.center,
    radius: a.radius + amount
  };
}

// Find cached postal codes that satisfy the query requirements
export function findCachedPostalCodesByCoordinates(
  queryDomain: Circle,
  blockingAmount: number
) {
  // If we know there are more results in this region than we want, we can
  // notify of this overload.
  const blocker = coordinateCache.find(entry =>
    entry.results.length > blockingAmount
    &&
    isCircleContained(entry.domain, queryDomain)
  );
  if (blocker) {
    console.log("Overload blocker found in cache");
    return "overload";
  }

  // Find cache entries where the query sphere is contained within the cached sphere
  const suitableCache = coordinateCache.find(entry =>
    isCircleContained(queryDomain, entry.domain)
  );

  if (!suitableCache) {
    return undefined;
  }
  console.log("Found suitable cache", suitableCache);

  // Filter results to only include those within the requested radius
  const filteredResults = suitableCache.results.filter((poi: PointOfInterest) => {
    if (!poi.coordinates) return false;
    const distance = calculateDistance(queryDomain.center, poi.coordinates);
    return distance <= queryDomain.radius;
  });

  return filteredResults;
}

export function addToCoordinateCache(
  { domain, exhaustive, results, obtainUrl }: {
    domain: Circle,
    exhaustive: boolean,
    results: PostalcodePOI[],
    obtainUrl: string
  }
) {
  domain = {
    center: domain.center,
    radius: exhaustive ? domain.radius : getMaxDistance(results)
  };

  // Prevent duplicates
  const existingEntry = coordinateCache.find(entry =>
    isCircleContained(
      domain,
      extendCircle(entry.domain, 0.000001)
    )
  );
  if (existingEntry) {
    return;
  }

  coordinateCache.push({
    domain,
    exhaustive,
    results,
    obtainUrl,
    timestamp: Date.now()
  });

  if (coordinateCache.length > 400) {
    coordinateCache.shift(); // Remove oldest entry
  }
}

// https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?type=postcode&distance=9753&lat=52.32316995153697&lon=4.974746704101563&fl=id,postcode,afstand,weergavenaam,type,centroide_ll,woonplaatsnaam&start=0&rows=1

// Load coordinate cache from existing PDOK API cache
export async function loadCoordinateCacheFromPdokCache(): Promise<void> {
  try {
    // Get cached reverse geocoding requests (coordinate-based postal code queries)
    const cachedRequests = await getCachedRequests("/reverse");

    for (const parameters of cachedRequests) {
      if (!parameters) continue;

      // Convert parameters array to map for easier lookup
      const paramMap = new Map(parameters);

      // Only process postcode type requests
      if (paramMap.get("type") !== "postcode") continue;

      // Extract coordinate and search parameters
      const lat = parseFloat(paramMap.get("lat") || "0");
      const lon = parseFloat(paramMap.get("lon") || "0");
      const distance = parseFloat(paramMap.get("distance") || "0");

      if (lat === 0 || lon === 0 || distance === 0) continue;

      const radius = distance;

      try {
        // Reconstruct the cache entry by fetching from the existing cache
        // This will use the cached response if available
        let { docs, exhaustive } = await fetchPdokDocs<PdokLocalized>(
          "/reverse",
          parameters,
          { fetchCapacity: 100, needComplete: false }
        );
        console.log(`For ${radius}, ${lat}, ${lon}: `, exhaustive, docs);

        if (docs === "overload") {
          continue;
        }

        const domain: Circle = {
          center: [lat, lon],
          radius
        };

        const results = docs.map((v): PostalcodePOI => {
          const coordinates = parseCoordinates(v.centroide_ll);

          return {
            type: "postcode",
            label: v.postcode,
            coordinates: coordinates,
            distance: v.afstand ?? calculateDistance([lat, lon], coordinates ?? [lat, lon]),
            details: v
          }
        }).filter((v) => v.coordinates != null);

        if (results.length < docs.length) {
          exhaustive = false;
        }

        addToCoordinateCache({ domain, exhaustive, results,
          obtainUrl: getPdokRequestUrl("/reverse", parameters)
         })
        console.log(
          `Loaded coordinate cache entry: center=[${lat}, ${lon}], ` +
          `radius=${radius}, results=${results.length}`
        );

      } catch (error) {
        console.warn(`Failed to load cache entry for coordinates [${lat}, ${lon}]:`, error);
      }
    }

    console.log(`Loaded ${coordinateCache.length} coordinate cache entries from PDOK cache`);

  } catch (error) {
    console.error("Failed to load coordinate cache from PDOK cache:", error);
  }
}

// Get coordinate cache statistics
export function getCoordinateCacheStats(): {
  entryCount: number;
  totalResults: number;
  entries: Array<{
    domain: Circle;
    resultCount: number;
    timestamp: number;
  }>;
} {
  return {
    entryCount: coordinateCache.length,
    totalResults: coordinateCache.reduce((sum, entry) => sum + entry.results.length, 0),
    entries: coordinateCache.map(entry => ({
      domain: entry.domain,
      resultCount: entry.results.length,
      timestamp: entry.timestamp
    }))
  };
}

// Clear the coordinate cache
export function clearCoordinateCache(): void {
  coordinateCache.length = 0;
  console.log("Coordinate cache cleared");
}
