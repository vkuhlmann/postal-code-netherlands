
// function checkUpToDate() {
//     isUpToDate();
// }


let addressAutoComplete = {
    // rdfUrl: null,
    // huis_nlt: null
};

let postcodeEl = null;
let plaatsnaamEl = null;
let straatEl = null;
let huisnrEl = null;

let addressLookup = {};

function getElements() {
    postcodeEl = document.querySelector('input[name="postcode"]');
    plaatsnaamEl = document.querySelector('input[name="plaatsnaam"]');
    straatEl = document.querySelector('input[name="straat"]');
    huisnrEl = document.querySelector('input[name="huisnr"]');
}

function formatHuisnummer(nummer, toevoeging, huisletter, huis_nlt) {
    if (toevoeging != null) {
        let match = toevoeging.match(/^(BS)?([A-Z]?)$/);

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

// Returns something like:
// {
//    "Utrecht": {
//         "Bolognalaan": {
//             "101", "101 bis", "103", "105"
//         }
//     }
// }
// This is an example where for this postal code, there is only place name, and
// only one street within that place name.
async function getPostalCodeInfo(postalCode) {
    if (postalCode != addressLookup.postalCode) {
        addressLookup = await getForPostalCode(postalCode);
    }

    const {
        plaatsnamen,
        straatnamen,
        adressen
    } = addressLookup;

    let ans = {};

    for (let address of adressen) {
        let plaats = (ans[address.plaatsnaam] ??= {});
        let straat = (plaats[address.straatnaam] ??= []);

        straat.push(address.nummer);
    }

    return ans;
}

async function checkAddress() {
    const postalCode = postcodeEl.value;
    if (postalCode != addressLookup.postalCode) {
        addressLookup = await getForPostalCode(postalCode);
    }

    const {
        plaatsnamen,
        straatnamen,
        adressen
    } = addressLookup;

    if (adressen == null || adressen.length == 0) {
        console.log("Postal code not found");

        let validityMessageEl = document.querySelector("#address-validity-message");;
        if (validityMessageEl != null) {
            validityMessageEl.innerText = "Invalid postal code!";
            validityMessageEl.style.color = "red";
        }
        return;
    }

    console.log(`Current plaatsnaam: ${plaatsnaamEl.value}`);
    console.log(`Valid plaatsnamen: ${plaatsnamen}`);

    let plaatsnaamValid = plaatsnamen.includes(plaatsnaamEl.value);
    if (plaatsnaamValid) {
        plaatsnaamEl.classList.remove("address-validation-invalid");
        plaatsnaamEl.classList.add("address-validation-valid");
    } else if (plaatsnaamEl.value.length == 0) {
        plaatsnaamEl.classList.remove("address-validation-invalid");
        plaatsnaamEl.classList.remove("address-validation-valid");
    } else {
        plaatsnaamEl.classList.add("address-validation-invalid");
        plaatsnaamEl.classList.remove("address-validation-valid");
    }

    // if (!plaatsnaamValid) {
    //     console.log("Invalid plaatsnaam");
    // }


    console.log(`Current straatnaam: ${straatEl.value}`);
    console.log(`Valid straatnamen: ${straatnamen}`);

    let straatValid = straatnamen.includes(straatEl.value);
    if (straatValid) {
        straatEl.classList.remove("address-validation-invalid");
        straatEl.classList.add("address-validation-valid");
    } else if (straatEl.value.length == 0) {
        straatEl.classList.remove("address-validation-invalid");
        straatEl.classList.remove("address-validation-valid");
    } else {
        straatEl.classList.add("address-validation-invalid");
        straatEl.classList.remove("address-validation-valid");
    }

    // if (!straatnamen.includes(straatEl.value)) {
    //     console.log("Invalid straatnaam");
    // }

    let validAddresses = [];
    if (plaatsnaamValid && straatValid) {
        validAddresses = adressen.filter(
            (v) => v.plaatsnaam == plaatsnaamEl.value
            && v.straatnaam == straatEl.value
        );
    }

    let huisnummers = validAddresses.map((v) => v.nummer);
    
    console.log(`Huisnummers: ${huisnummers.join(', ')}`);

    let huisnummerValid = huisnummers.includes(huisnrEl.value);
    if (huisnummerValid) {
        huisnrEl.classList.remove("address-validation-invalid");
        huisnrEl.classList.add("address-validation-valid");
    } else if (huisnrEl.value.length == 0) {
        huisnrEl.classList.remove("address-validation-invalid");
        huisnrEl.classList.remove("address-validation-valid");
    } else {
        huisnrEl.classList.add("address-validation-invalid");
        huisnrEl.classList.remove("address-validation-valid");
    }

    // let validityMessage = "";
    let validityMessageEl = document.querySelector("#address-validity-message");
    if (validityMessageEl != null) {
        validityMessageEl.style.color = null;

        if (plaatsnaamValid && straatValid && huisnummerValid) {
            validityMessageEl.innerText = "Valid address!";
            validityMessageEl.style.color = "green";
        }
        else if (huisnrEl.value.length == 0 || straatEl.value.length == 0 || plaatsnaamEl.value.length == 0) 
        {
            validityMessageEl.innerText = "Please fill in all address fields";
            validityMessageEl.style.color = "orange";
        } else {
            validityMessageEl.innerText = "Invalid address!";
            validityMessageEl.style.color = "red";
        }
    }
    


    let huisnummersEl = document.querySelector("#valid-huisnummers");
    if (huisnummersEl != null) {
        if (huisnummers.length > 0)
        huisnummersEl.innerText = `Geldige huisnummers: ${huisnummers.join(', ')}`;
    else 
    huisnummersEl.innerText = "";
    }
}

function listenForAddressAutofill() {
    let el = document.querySelector('input[name="postcode"]');
    if (el == null) {
        return;
    }

    el.addEventListener("input", async () => {
        await fillAddress();
        await checkAddress();
    });

    el.addEventListener("change", async () => {
        await fillAddress();
        await checkAddress();
    });

    let plaatsnaamEl = document.querySelector('input[name="plaatsnaam"]');
    let straatEl = document.querySelector('input[name="straat"]');
    let huisnrEl = document.querySelector('input[name="huisnr"]');

    if (plaatsnaamEl != null) {
        plaatsnaamEl.addEventListener("input", checkAddress);
    }

    if (straatEl != null) {
        straatEl.addEventListener("input", checkAddress);
    }

    if (huisnrEl != null) {
        huisnrEl.addEventListener("input", checkAddress);
    }
}

async function getForPostalCode(postcode) {
    postcode = postcode.replaceAll(" ", "");
    let docs = [];

    if (postcode.length == 6) {
        let fetchResponse = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${postcode}&rows=100&df=postcode`);
        // Using code from https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
        if (!fetchResponse.ok) {
            throw new Error(`Response status: ${fetchResponse.status}`);
        }

        const data = await fetchResponse.json();

        docs = Array.from(data.response.docs);
    }

    let postcode_infos = docs.filter((v, _) => v.type == "postcode");
    let plaatsnamen = [...new Set(postcode_infos.map((v) => v.woonplaatsnaam))].sort();
    let straatnamen = [...new Set(postcode_infos.map((v) => v.straatnaam))].sort();

    let addresses = docs.filter((v, _) => v.type == "adres");

    addresses = addresses.map((v, _) => {
        return {
            "nummer": formatHuisnummer(
                v['huisnummer'],
                v['huisnummertoevoeging'],
                v['huisletter'],
                v['huis_nlt']
            ),
            "huis_nlt": v["huis_nlt"],
            "plaatsnaam": v.woonplaatsnaam,
            "straatnaam": v.straatnaam,
            "rdf": v["rdf_seealso"],
            "details": v
        };
    });

    return {
        "plaatsnamen": plaatsnamen,
        "straatnamen": straatnamen,
        "adressen": addresses,
        "postalCode": postcode
    };
}


async function fillAddress() {
    console.log("Doing fill address")
    let el = document.querySelector('input[name="postcode"]');
    let plaatsnaamEl = document.querySelector('input[name="plaatsnaam"]');
    let straatEl = document.querySelector('input[name="straat"]');
    let huisnr = document.querySelector('input[name="huisnr"]');

    if (el == null) {
        return;
    }

    let postcode = el.value.replaceAll(' ', '');
    if (postcode.length != 6) {
        return;
    }

    console.log(`Postcode is ${postcode}`);

    try{
        let res = await getForPostalCode(postcode);

        let plaatsnamen = res.plaatsnamen;
        let straatnamen = res.straatnamen;
        let addresses = res.adressen;

        // console.log("postcode_infos:");
        // console.log(postcode_infos);
        // let postcode_info = {};
        // if (postcode_infos.length == 1) {
        //     postcode_info = postcode_infos[0];
        // }

        // let plaatsnaam = postcode_info.woonplaatsnaam;
        // let straatnaam = postcode_info.straatnaam;
        console.log(`Plaatsnamen: ${plaatsnamen}`);
        console.log(`Straatnamen: ${straatnamen}`);

        if (plaatsnamen.length == 1 && plaatsnaamEl != null) {
            plaatsnaamEl.value = plaatsnamen[0];

            var event = new Event('change', {'bubbles': true});
            plaatsnaamEl.dispatchEvent(event);
        }

        if (straatEl != null && !straatnamen.includes(straatEl.value)) {
            straatEl.value = "";

            var event = new Event('change', {'bubbles': true});
            straatEl.dispatchEvent(event);
        }

        if (straatnamen.length == 1 && straatEl != null) {
            straatEl.value = straatnamen[0];

            var event = new Event('change', {'bubbles': true});
            straatEl.dispatchEvent(event);
        }

        // console.log(`Plaatsnaam: ${plaatsnaam}`);
        // console.log(`Straatnaam: ${straatnaam}`);
        console.log(addresses);

    } catch (e) {
        console.error(e.message);
    }
}

