import { parseCoordinates } from "@/app/postal_code";

export interface PdokResponse<DocType extends PdokDoc = PdokDoc> {
  response: {
    numFound?: number;
    start?: number;
    maxScore?: number;
    numFoundExact?: boolean;
    docs: DocType[];
  };
}

export interface PdokDoc {
  bron?: string;
  woonplaatscode?: string;
  type?: "adres" | "postcode" | "weg" | "woonplaats"
    | "gemeente" | "provincie" | string;
  woonplaatsnaam?: string;
  wijkcode?: string;
  huis_nlt?: string;
  openbareruimtetype?: "Weg" | string;
  buurtnaam?: string;
  gemeentecode?: string;
  rdf_seealso?: string;
  weergavenaam?: string;
  straatnaam_verkort?: string;
  id?: string;
  gekoppeld_perceel?: string[];
  gemeentenaam?: string;
  buurtcode?: string;
  wijknaam?: string;
  identificatie?: string;
  openbareruimte_id?: string;
  waterschapsnaam?: string;
  provinciecode?: string;
  postcode?: string; // Optional for addresses
  provincienaam?: string;
  centroide_ll?: string; // Optional for addresses
  nummeraanduiding_id?: string; // Optional for addresses
  waterschapscode?: string; // Optional for addresses
  adresseerbaarobject_id?: string; // Optional for addresses
  huisnummer?: number; // Optional for addresses
  provincieafkorting?: string; // Optional for addresses
  centroide_rd?: string; // Optional for addresses
  straatnaam?: string; // Optional for addresses

  score?: number;
  afstand?: number;
}

export interface PdokLocalized extends PdokDoc {
  centroide_ll: string;
  postcode: string;
}

export interface PdokPostcode extends PdokLocalized {
  type: "postcode";
  id: string;
  weergavenaam?: string;
  afstand?: number;
  woonplaatsnaam: string;
  straatnaam: string;
}

export interface PdokAddress extends PdokLocalized {
  type: "adres";
  woonplaatsnaam: string;
  straatnaam: string;
  huisnummer: number;
  huisnummertoevoeging?: string;
  huisletter?: string;
  huis_nlt: string;
  rdf_seealso: string;
  centroide_ll: string;
  centroide_rd: string;
  postcode: string
}

export type PdokItem = PdokAddress | PdokPostcode;

const example1: PdokDoc = {
  "bron": "BAG",
  "woonplaatscode": "3295",
  "type": "adres",
  "woonplaatsnaam": "Utrecht",
  "wijkcode": "WK034405",
  "huis_nlt": "101",
  "openbareruimtetype": "Weg",
  "buurtnaam": "Utrecht Science Park",
  "gemeentecode": "0344",
  "rdf_seealso": "http://bag.basisregistraties.overheid.nl/bag/id/nummeraanduiding/0344200000007827",
  "weergavenaam": "Bolognalaan 101, 3584CJ Utrecht",
  "straatnaam_verkort": "Bolognaln",
  "id": "adr-b68c0c21140e5370ff2834cefde4a17c",
  "gekoppeld_perceel": ["UTT00-N-1358"],
  "gemeentenaam": "Utrecht",
  "buurtcode": "BU03440533",
  "wijknaam": "Wijk 05 Oost",
  "identificatie": "0344010000007337-0344200000007827",
  "openbareruimte_id": "0344300000000227",
  "waterschapsnaam": "Hoogheemraadschap De Stichtse Rijnlanden",
  "provinciecode": "PV26",
  "postcode": "3584CJ",
  "provincienaam": "Utrecht",
  "centroide_ll": "POINT(5.17636456 52.08206803)",
  "nummeraanduiding_id": "0344200000007827",
  "waterschapscode": "14",
  "adresseerbaarobject_id": "0344010000007337",
  "huisnummer": 101,
  "provincieafkorting": "UT",
  "centroide_rd": "POINT(140547.812 454887.397)",
  "straatnaam": "Bolognalaan",
  "score": 5.8842072
};

const example2: PdokPostcode = {
  "bron": "BAG",
  "woonplaatscode": "3295",
  "type": "postcode",
  "woonplaatsnaam": "Utrecht",
  "openbareruimtetype": "Weg",
  "gemeentecode": "0344",
  "weergavenaam": "Bolognalaan, 3584CJ Utrecht",
  "straatnaam_verkort": "Bolognaln",
  "id": "pcd-186842457c8c74f2096cca4f6714ca6b",
  "gemeentenaam": "Utrecht",
  "identificatie": "0344300000000227_3584CJ_3295",
  "openbareruimte_id": "0344300000000227",
  "provinciecode": "PV26",
  "postcode": "3584CJ",
  "provincienaam": "Utrecht",
  "centroide_ll": "POINT(5.17713104 52.08439837)",
  "provincieafkorting": "UT",
  "centroide_rd": "POINT(140601.101 455146.516)",
  "straatnaam": "Bolognalaan",
  "score": 6.3986416
};

// https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?fq=type:postcode&rows=100&q=3584CC&df=postcode
const example3: PdokResponse<PdokPostcode> = {
  "response": {
    "numFound": 2,
    "start": 0,
    "maxScore": 6.8681936,
    "numFoundExact": true,
    "docs": [{
      "bron": "BAG",
      "woonplaatscode": "3295",
      "type": "postcode",
      "woonplaatsnaam": "Utrecht",
      "openbareruimtetype": "Weg",
      "gemeentecode": "0344",
      "weergavenaam": "Genèvelaan, 3584CC Utrecht",
      "straatnaam_verkort": "Genèveln",
      "id": "pcd-44f108233baa127dc62ff2e25fd39bd9",
      "gemeentenaam": "Utrecht",
      "identificatie": "0344300000003269_3584CC_3295",
      "openbareruimte_id": "0344300000003269",
      "provinciecode": "PV26",
      "postcode": "3584CC",
      "provincienaam": "Utrecht",
      "centroide_ll": "POINT(5.17196101 52.08517866)",
      "provincieafkorting": "UT",
      "centroide_rd": "POINT(140246.991 455234.367)",
      "straatnaam": "Genèvelaan",
      "score": 6.8681936
    }, {
      "bron": "BAG",
      "woonplaatscode": "3295",
      "type": "postcode",
      "woonplaatsnaam": "Utrecht",
      "openbareruimtetype": "Weg",
      "gemeentecode": "0344",
      "weergavenaam": "Princetonplein, 3584CC Utrecht",
      "straatnaam_verkort": "Princetonpln",
      "id": "pcd-bdf19304fed29d4bc4aaba4f36284d3f",
      "gemeentenaam": "Utrecht",
      "identificatie": "0344300000000570_3584CC_3295",
      "openbareruimte_id": "0344300000000570",
      "provinciecode": "PV26",
      "postcode": "3584CC",
      "provincienaam": "Utrecht",
      "centroide_ll": "POINT(5.1654642 52.08777191)",
      "provincieafkorting": "UT",
      "centroide_rd": "POINT(139802.572 455524.228)",
      "straatnaam": "Princetonplein",
      "score": 6.8681936
    }]
  }
}