// src/types/postal_code.ts

import { PdokDoc, PdokAddress } from "@/types/pdok";

export interface _PointOfInterest {
  type : "adres" | "postcode";
  coordinates?: [number, number];
  label: string;
  details: PdokDoc;
}

export interface PostalcodePOI extends _PointOfInterest {
  type: "postcode";
  distance: number;
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

export type PointOfInterest = FormattedAddress | PostalcodePOI;

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

export interface Circle {
    /** Center point, in latitude and longitude */
    center: [number, number]; // latlon
    
    /** Radius in meters */
    radius: number;
}

export interface CoordinateCacheEntry {
  //   center: [number, number];
  //   radius: number;
  domain: Circle;
  exhaustive: boolean;
  results: PointOfInterest[];
  timestamp: number;
  obtainUrl: string;
}
