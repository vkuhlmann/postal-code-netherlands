import { PdokDoc, PdokResponse } from "@/types/pdok";

// Utility function to sleep for a specified number of milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


export function getPdokRequestUrl(
  path: "/free" | "/lookup" | "/reverse" | "/suggest",
  parameters: [string, any][],
) {
  // Documented at https://api.pdok.nl/bzk/locatieserver/search/v3_1/ui/#/Locatieserver/free
  // See `example_for_postal_code.json` for an example output.

  return (`https://api.pdok.nl/bzk/locatieserver/search/v3_1${path}?`
    + parameters.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
  );
}

export async function getCachedRequests(
  path: "/free" | "/lookup" | "/reverse" | "/suggest",
) {
  const cache = 'caches' in window ? await caches.open(CACHE_NAME) : null;
  if (!cache) return [];

  let cachedKeys = await cache.keys(`https://api.pdok.nl/bzk/locatieserver/search/v3_1${path}`, {
    ignoreSearch: true,
  });

  return cachedKeys.map((request) => {
    const url = new URL(request.url);
    const params = new URLSearchParams(url.search);
    if (params.get('start') !== '0') {
      // We only want the first page of results, so skip any requests that are not for the first page.
      return null;
    }

    const parameters = params.entries().toArray().filter(
      ([key, _]) => key !== 'start' && key !== 'rows'
    );
    return parameters;
  }).filter((v) => v !== null);
}


const CACHE_NAME = 'pdok-api-cache';
const CACHE_EXPIRATION_TIME = 14 * 24 * 60 * 60 * 1000; // 2 weeks in milliseconds

export async function fetchPdokDocs<T extends PdokDoc>(
  path: "/free" | "/lookup" | "/reverse" | "/suggest",
  parameters: [string, any][],
  // options: { fetchCapacity?: number, needComplete?: boolean } = { fetchCapacity: 500, needComplete: true }
  options: { fetchCapacity: number, needComplete: boolean }
) {
  const { fetchCapacity, needComplete } = options;

  const minFetch = fetchCapacity;
  const abortIfAbove = needComplete && minFetch;

  const docs: T[] = [];
  const cache = 'caches' in window ? await caches.open(CACHE_NAME) : null;

  let numFound : number | undefined;

  let start = 0;
  const batchFetchAmount = Math.min(100, minFetch);
  while (true) {
    // const request = getPdokRequestUrl("/free", [
    //   ["start", start],
    //   ["rows", 100],
    //   //
    //   ["fq", "type:postcode"],
    //   ["lat", lat],
    //   ["lon", lon],
    // ]);

    const request =
      new Request(
        getPdokRequestUrl(path, [
          ...parameters,
          ["start", start],
          ["rows", batchFetchAmount],
        ]), {
          method: 'GET',
          headers: {
            // Header to indicate the requesting application. If there is a
            // problem with it, this will tell the API hosters who to contact.
            'X-Requested-With': 'github.com/vkuhlmann/postal-code-netherlands',
          },
        }
      );

    // Check if request exists in cache.
    let fetchResponse = await cache?.match(request);
    if (fetchResponse) {
      const fetchDate = new Date(fetchResponse.headers.get('date') ?? 0);
      console.log(`Expiry date ${fetchDate} for ${request}`);

      if (fetchDate.getTime() < Date.now() - CACHE_EXPIRATION_TIME) {
        await cache?.delete(request);
        fetchResponse = undefined;
      }
    }

    // If not in cache, fetch and store to cache.
    if (!fetchResponse) {
      if (abortIfAbove && (Math.max(numFound ?? 0, docs.length) > abortIfAbove)) {
        // If we need complete, either we find too many results, or we finish
        // by reaching a batch with less than 100 results. The numFound, even
        // when numFoundExact is true, is not accurate. For the reverse API,
        // it will just say 100 even if there are further pages to fetch.
        console.log(`Overload: max(${numFound}, ${docs.length}) > ${abortIfAbove}, aborting request`);
        return {
          exhaustive: false,
          docs: 'overload'
        } as const;
      }

      // If we don't need to have it complete, we may have enough results.
      if (docs.length >= minFetch && !abortIfAbove) {
        return {
          exhaustive: false,
          docs,
        } as const
      }
      
      if (start > 0) {
        // Sleep between requests.
        await sleep(100);
      }

      console.log(`Fetching ${request.url}`);
      fetchResponse = await fetch(request);
      if (!fetchResponse.ok) {
        throw new Error(`Response status: ${fetchResponse.status}`);
      }

      const headers = new Headers(fetchResponse.headers);
      headers.set("date", new Date().toISOString());

      // We need to clone the fetchResponse, because its body gets consumed.
      // Also, since we needed to create a new Headers object, construct a new
      // Response object with it.
      await cache?.put(request, new Response(
        fetchResponse.clone().body,
        {
          headers: headers,
          status: fetchResponse.status,
          statusText: fetchResponse.statusText
        }
      ));
    }

    const data: PdokResponse<T> = await fetchResponse.json();

    numFound ??= data.response.numFound;

    const newDocs = data.response.docs;
    docs.push(...newDocs);
    start += newDocs.length;
    if (newDocs.length < batchFetchAmount) {
      return {
        exhaustive: true,
        docs,
      } as const;
    }
    if (batchFetchAmount < 100) {
      return {
        exhaustive: false,
        docs,
      } as const;
    }
  }
}


