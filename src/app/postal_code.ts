// src/app/postal_code.ts

import { PdokAddress, PdokDoc, PdokItem, PdokLocalized, PdokPostcode, PdokResponse } from "@/types/pdok";
import { fetchPdokDocs } from "@/utils/pdok_api";


export interface _PointOfInterest {
  type : "adres" | "postcode";

  coordinates?: [number, number];
  label: string;
  details: PdokDoc;
}

export type PointOfInterest = FormattedAddress | PostalcodePOI;

export interface PostalcodePOI extends _PointOfInterest {
  type: "postcode";
}

export interface FormattedAddress extends _PointOfInterest {
  type: "adres";

  nummer: string;
  huis_nlt: string;
  plaatsnaam: string;
  straatnaam: string;
  postcode?: string;
  rdf: string;
  coordinates?: [number, number];
  details: PdokAddress;
  label: string;
}

export interface PostalCodeInfo {
  plaatsnamen: string[];
  straatnamen: string[];
  adressen: FormattedAddress[];
  postalCode: string;
}


export interface ValidationResult {
  streetName: boolean | null;
  houseNumber: boolean | null;
  validHouseNumbers: string[];
  addressValidityMessage: string;
  locations: FormattedAddress[];
}

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

export function parseCoordinates(
  centroide_ll: string | null
) {
  if (centroide_ll == null) {
    return undefined;
  }

  const match = centroide_ll.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (match) {
    return ([parseFloat(match[2]), parseFloat(match[1])] as [number, number]);
  }
  return undefined;
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

  const docs = await fetchPdokDocs<PdokAddress | PdokPostcode>(
    "/free",
    [
      ["q", postcode],
      ["rows", 100],
      ["df", "postcode"],
      ["fq", "type:(adres OR postcode)"]
    ]
  );
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

export async function getPostalCodesByCoordinates([lat, lon]: [number, number], { radius, maxCount }: { radius: number, maxCount: number }) {
  const docs = await fetchPdokDocs<PdokLocalized>(
    "/reverse",
    [
      ["type", "postcode"],
      ["distance", (radius + 0.5).toFixed()],
      ["lat", lat],
      ["lon", lon],
      ["fl", "id,postcode,afstand,weergavenaam,type,centroide_ll,woonplaatsnaam"]
    ],
    { maxCount }
  );
  console.log(`Fetched postal codes around ${[lat, lon]}, got ${docs.length} items`);

  const result: PointOfInterest[] = docs.map((v) : PostalcodePOI => ({
    "type": "postcode",
    "label": v.postcode,
    "coordinates": parseCoordinates(v.centroide_ll),
    "details": v
  })).filter((v) => v.coordinates != null);

  return result;
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
    console.log("Invalid address:", { streetName, houseNumber, postalCode, 
      isStreetNameValid, isHouseNumberValid, straatnamen, adressen });

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