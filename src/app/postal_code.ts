// src/app/postal_code.ts

import { ParametersType, PdokAddress, PdokDoc, PdokItem, PdokLocalized, PdokPostcode, PdokResponse } from "@/types/pdok";
import {
  _PointOfInterest,
  PointOfInterest,
  PostalcodePOI,
  FormattedAddress,
  PostalCodeInfo,
  ValidationResult,
  CoordinateCacheEntry,
  Circle
} from "@/types/postal_code";
import { fetchPdokDocs, getPdokRequestUrl } from "@/utils/pdok_api";
import {
  findCachedPostalCodesByCoordinates,
  addToCoordinateCache,
  loadCoordinateCacheFromPdokCache,
  getCoordinateCacheStats,
  clearCoordinateCache
} from "@/utils/coordinate_cache";
import { parseCoordinates } from "@/utils/locations";

// Re-export types for convenience
export type {
  _PointOfInterest,
  PointOfInterest,
  PostalcodePOI,
  FormattedAddress,
  PostalCodeInfo,
  ValidationResult,
  CoordinateCacheEntry
} from "@/types/postal_code";

export function formatHuisnummer(
  nummer: number,
  toevoeging: string | undefined,
  huisletter: string | undefined,
  huis_nlt: string
): string {
  if (toevoeging != null) {
    const match = toevoeging.match(/^(BS)?([A-Z]?)$/);

    if (match == null) {
      return huis_nlt;
    }

    let val = `${nummer}`;
    if (match[1] != null) {
      val += " bis";
    }

    if (match[2] != null && match[2].length > 0) {
      val += ` ${match[2]}`;
    }
    return val;
  }

  return huis_nlt;
}


export async function getForPostalCode(postcode: string): Promise<PostalCodeInfo> {
  postcode = postcode.replaceAll(" ", "");

  if (postcode.length !== 6) {
    return {
      plaatsnamen: [],
      straatnamen: [],
      adressen: [],
      postalCode: postcode,
    };
  }

  const { docs, exhaustive } = await fetchPdokDocs<PdokAddress | PdokPostcode>(
    "/free",
    [
      ["q", postcode],
      ["rows", 100],
      ["df", "postcode"],
      ["fq", "type:(adres OR postcode)"]
    ],
    {
      fetchCapacity: 1000,
      needComplete: true
    }
  );
  if (!exhaustive) {
    return {
      plaatsnamen: [],
      straatnamen: [],
      adressen: [],
      postalCode: postcode,
    };
  }

  console.log(`Fetched ${postcode}, got ${docs.length} items`);

  const postcode_infos = docs.filter((v) => v.type === "postcode");
  const plaatsnamen = [...new Set(postcode_infos.map((v) => v.woonplaatsnaam))].sort();
  const straatnamen = [...new Set(postcode_infos.map((v) => v.straatnaam))].sort();

  const adressen: FormattedAddress[] = docs
    .filter((v) => v.type === "adres")
    .map((v) => {
      const formattedNumber = formatHuisnummer(
        v.huisnummer,
        v.huisnummertoevoeging,
        v.huisletter,
        v.huis_nlt
      );

      return {
        type: "adres",
        nummer: formattedNumber,
        huis_nlt: v.huis_nlt,
        plaatsnaam: v.woonplaatsnaam,
        straatnaam: v.straatnaam,
        rdf: v.rdf_seealso,
        coordinates: parseCoordinates(v.centroide_ll),
        postcode: v.postcode,
        details: v,
        label: formattedNumber
      };
    });

  return {
    plaatsnamen,
    straatnamen,
    adressen,
    postalCode: postcode,
  };
}

export async function getPostalCodesByCoordinates(
  domain: Circle,
  { fetchCapacity }: { fetchCapacity: number }
) {
  // const center: [number, number] = [lat, lon];

  const [lat, lon] = domain.center;

  const parameters: ParametersType = [
    ["type", "postcode"],
    // Round up, since the API needs an integer.
    ["distance", (domain.radius + 0.5).toFixed()],
    ["lat", lat],
    ["lon", lon],
    ["fl", "id,postcode,afstand,weergavenaam,type,centroide_ll,woonplaatsnaam"]
  ]

  const { docs, exhaustive } = await fetchPdokDocs<PdokLocalized>(
    "/reverse",
    parameters,
    { fetchCapacity, needComplete: false }
  );

  if (docs == "overload") {
    console.log(`Overloaded response for coordinates [${lat}, ${lon}]`);
    return {
      exhaustive: false,
      results: []
    };
  }

  console.log(`Fetched postal codes around ${[lat, lon]}, got ${docs.length} items`);

  const results = docs.map((v): PostalcodePOI => ({
    type: "postcode",
    label: v.postcode,
    coordinates: parseCoordinates(v.centroide_ll),
    distance: v.afstand ?? 0,
    details: v
  })).filter((v) => v.coordinates != null);

  // Add results to cache for future queries
  addToCoordinateCache({
    domain, exhaustive, results,
    obtainUrl: getPdokRequestUrl("/reverse", parameters)
  });

  return {
    exhaustive,
    results
  };
}

export function validateAddress(
  postalCodeInfo: PostalCodeInfo | null,
  streetName: string,
  houseNumber: string,
  postalCode: string
): ValidationResult {
  if (!postalCodeInfo) {
    return {
      streetName: null,
      houseNumber: null,
      validHouseNumbers: [],
      addressValidityMessage: "",
      locations: [],
    };
  }

  const { straatnamen, adressen } = postalCodeInfo;

  const isStreetNameValid = streetName ? straatnamen.includes(streetName) : null;

  let validAddresses: FormattedAddress[] = [];
  if (isStreetNameValid) {
    validAddresses = adressen.filter((v) => v.straatnaam === streetName);
  } else if (!streetName) {
    validAddresses = adressen;
  }

  const houseNumbers = validAddresses.map((v) => v.nummer);

  const isHouseNumberValid = houseNumber ? houseNumbers.includes(houseNumber) : null;

  let addressValidityMessage = "";
  let locations: FormattedAddress[] = [];

  if (isStreetNameValid && isHouseNumberValid) {
    addressValidityMessage = "Valid address!";
    const selectedAddress = validAddresses.find((v) => v.nummer === houseNumber);
    if (selectedAddress) {
      locations = [selectedAddress];
    }
  } else if (isStreetNameValid && !houseNumber) {
    addressValidityMessage = `Found ${validAddresses.length} addresses on this street.`;
    locations = validAddresses;
  } else if (!streetName && !houseNumber && postalCode.length === 6) {
    addressValidityMessage = `Found ${adressen.length} addresses for this postal code.`;
    locations = adressen;
  }
  else if (!streetName || !houseNumber || !postalCode) {
    addressValidityMessage = "Please fill in all address fields";
  } else {
    addressValidityMessage = "Invalid address!";
    console.log("Invalid address:", {
      streetName, houseNumber, postalCode,
      isStreetNameValid, isHouseNumberValid, straatnamen, adressen
    });

  }

  return {
    streetName: isStreetNameValid,
    houseNumber: isHouseNumberValid,
    validHouseNumbers: houseNumbers,
    addressValidityMessage,
    locations,
  };
}


let addressLookup: PostalCodeInfo | null = null;

export async function getPostalCodeInfo(postalCode: string) {
  if (addressLookup?.postalCode !== postalCode) {
    addressLookup = await getForPostalCode(postalCode);
  }

  return addressLookup;
}

export async function getPostalCodeInfoSimple(postalCode: string) {
  if (addressLookup?.postalCode !== postalCode) {
    addressLookup = await getForPostalCode(postalCode);
  }

  if (!addressLookup) {
    return {};
  }

  const { adressen } = addressLookup;

  const ans: Record<string, Record<string, string[]>> = {};

  for (const address of adressen) {
    const plaats = (ans[address.plaatsnaam] ??= {});
    const straat = (plaats[address.straatnaam] ??= []);

    straat.push(address.nummer);
  }

  return ans;
}