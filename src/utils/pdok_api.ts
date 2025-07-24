import { PdokDoc, PdokResponse } from "@/types/pdok";

// Utility function to sleep for a specified number of milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function getPdokRequestUrl(
  path: "/free" | "/lookup" | "/reverse" | "/suggest",
  parameters: [string, any][],
) {
  // Documented at https://api.pdok.nl/bzk/locatieserver/search/v3_1/ui/#/Locatieserver/free
  // See `example_for_postal_code.json` for an example output.

  return (`https://api.pdok.nl/bzk/locatieserver/search/v3_1${path}?`
    + parameters.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
  );
}


const CACHE_NAME = 'pdok-api-cache';
const CACHE_EXPIRATION_TIME = 14 * 24 * 60 * 60 * 1000; // 2 weeks in milliseconds

export async function fetchPdokDocs<T extends PdokDoc>(
    path: "/free" | "/lookup" | "/reverse" | "/suggest",
    parameters: [string, any][],
    { maxCount } = { maxCount: 5000 }
) {
  const docs: T[] = [];
  const cache = 'caches' in window ? await caches.open(CACHE_NAME) : null;

  let start = 0;
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
        ["rows", Math.min(100, maxCount - docs.length)],
      ]),
      {
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
      if (start > 0) {
        // Sleep between requests.
        await sleep(100);
      }

      console.log(`Fetching ${request}`);
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
    const newDocs = data.response.docs;
    docs.push(...newDocs);
    start += newDocs.length;
    if (newDocs.length < 100) {
      break;
    }
    if (docs.length >= maxCount) {
      break;
    }
  }

  return docs.slice(0, maxCount);
}


