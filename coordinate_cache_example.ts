// Example usage of the coordinate cache loading functionality

import { 
  loadCoordinateCacheFromPdokCache, 
  getCoordinateCacheStats, 
  findCachedPostalCodesByCoordinates,
  clearCoordinateCache
} from '@/utils/coordinate_cache';
import { getPostalCodesByCoordinates } from '@/app/postal_code';
import type { PointOfInterest } from '@/types/postal_code';

async function demonstrateCoordinateCache() {
  console.log("=== Coordinate Cache Example ===");
  
  // 1. Load existing cache from PDOK API cache
  console.log("Loading coordinate cache from PDOK cache...");
  await loadCoordinateCacheFromPdokCache();
  
  // 2. Check cache stats
  const stats = getCoordinateCacheStats();
  console.log(`Cache loaded: ${stats.entryCount} entries, ${stats.totalResults} total results`);
  
  // 3. Test a coordinate query - first try cache
  const testCoordinates: [number, number] = [52.370216, 4.895168]; // Amsterdam center
  const testParams = { radius: 2, fetchCapacity: 10 };
  
  console.log(`\nTesting query for coordinates ${testCoordinates} with radius ${testParams.radius}km...`);
  
  // Try cache first
  const cachedResults = findCachedPostalCodesByCoordinates(testCoordinates, testParams);
  
  if (cachedResults) {
    console.log(`✅ Found ${cachedResults.length} results in cache!`);
    console.log("Cached postal codes:", cachedResults.map(r => r.label).slice(0, 5));
  } else {
    console.log("❌ No suitable cache found, would need to fetch from API");
    
    // If no cache hit, fetch from API (this will also add to cache)
    const apiResults = await getPostalCodesByCoordinates(testCoordinates, testParams);
    console.log(`📡 Fetched ${apiResults.length} results from API`);
  }
  
  // 4. Show final cache stats
  const finalStats = getCoordinateCacheStats();
  console.log(`\nFinal cache stats: ${finalStats.entryCount} entries`);
  finalStats.entries.forEach((entry, i) => {
    console.log(`  Entry ${i + 1}: center=[${entry.center[0].toFixed(6)}, ${entry.center[1].toFixed(6)}], radius=${entry.radius}km, results=${entry.resultCount}`);
  });
}

// Run the example
// demonstrateCoordinateCache().catch(console.error);
