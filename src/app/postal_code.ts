// src/app/postal_code.ts

// Utility function to sleep for a specified number of milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface PdokResponse {
  response: {
    docs: PdokAddress[];
  };
}

export interface PdokAddress {
  type: "adres" | "postcode";
  woonplaatsnaam: string;
  straatnaam: string;
  huisnummer: number;
  huisnummertoevoeging?: string;
  huisletter?: string;
  huis_nlt: string;
  rdf_seealso: string;
  centroide_ll: string;
  centroide_rd: string;
  postcode?: string
}

export interface FormattedAddress {
  nummer: string;
  huis_nlt: string;
  plaatsnaam: string;
  straatnaam: string;
  postcode?: string;
  rdf: string;
  coordinates: [number, number] | null;
  details: PdokAddress;
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
    return null;
  }

  const match = centroide_ll.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (match) {
    return ([parseFloat(match[2]), parseFloat(match[1])] as [number, number]);
  }
  return null;
}

export async function getForPostalCode(postcode: string): Promise<PostalCodeInfo> {
  postcode = postcode.replaceAll(" ", "");
  let docs: PdokAddress[] = [];

  if (postcode.length == 6) {
    let start = 0;
    while (true) {
      const fetchResponse = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${postcode}&rows=100&df=postcode&start=${start}`
      );
      if (!fetchResponse.ok) {
        throw new Error(`Response status: ${fetchResponse.status}`);
      }

      const data: PdokResponse = await fetchResponse.json();
      let newDocs = data.response.docs;
      console.log(`Fetched ${postcode}, request with start ${start}: got ${newDocs.length} items`);

      docs.push(...newDocs);
      start += newDocs.length;
      if (newDocs.length < 100) {
        break;
      }
      // Sleep for 100 ms between requests
      await sleep(100);
    }
    console.log(`Fetched ${postcode}, got ${docs.length} items`);
  }

  const postcode_infos = docs.filter((v) => v.type === "postcode");
  const plaatsnamen = [...new Set(postcode_infos.map((v) => v.woonplaatsnaam))].sort();
  const straatnamen = [...new Set(postcode_infos.map((v) => v.straatnaam))].sort();

  let adressen: FormattedAddress[] = docs
    .filter((v) => v.type === "adres")
    .map((v) => {
      return {
        nummer: formatHuisnummer(
          v.huisnummer,
          v.huisnummertoevoeging,
          v.huisletter,
          v.huis_nlt
        ),
        huis_nlt: v.huis_nlt,
        plaatsnaam: v.woonplaatsnaam,
        straatnaam: v.straatnaam,
        rdf: v.rdf_seealso,
        coordinates: parseCoordinates(v.centroide_ll),
        postcode: v.postcode,
        details: v,
      };
    });

  return {
    plaatsnamen,
    straatnamen,
    adressen,
    postalCode: postcode,
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