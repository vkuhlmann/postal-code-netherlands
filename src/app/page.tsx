'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getForPostalCode, PostalCodeInfo, FormattedAddress } from './postal_code';

export default function Home() {
  const [postalCode, setPostalCode] = useState('');
  const [streetName, setStreetName] = useState('');
  const [houseNumber, setHouseNumber] = useState('');

  const [postalCodeInfo, setPostalCodeInfo] = useState<PostalCodeInfo | null>(null);
  const [validHouseNumbers, setValidHouseNumbers] = useState<string[]>([]);
  const [addressValidityMessage, setAddressValidityMessage] = useState('');
  const [validationStatus, setValidationStatus] = useState({
    streetName: null as boolean | null,
    houseNumber: null as boolean | null,
  });

  useEffect(() => {
    const checkPostalCode = async () => {
      const sanitizedPostalCode = postalCode.replace(/\s/g, '');
      if (sanitizedPostalCode.length === 6) {
        try {
          const info = await getForPostalCode(sanitizedPostalCode);
          setPostalCodeInfo(info);

          if (info.straatnamen.length === 1) {
            setStreetName(info.straatnamen[0]);
          }
        } catch (error) {
          console.error('Failed to fetch postal code info:', error);
          setPostalCodeInfo(null);
        }
      } else {
        setPostalCodeInfo(null);
        setStreetName('');
        setHouseNumber('');
      }
    };
    checkPostalCode();
  }, [postalCode]);

  useEffect(() => {
    if (!postalCodeInfo) {
      setValidHouseNumbers([]);
      setValidationStatus({ streetName: null, houseNumber: null });
      setAddressValidityMessage('');
      return;
    }

    const { straatnamen, adressen } = postalCodeInfo;

    const isStreetNameValid = streetName ? straatnamen.includes(streetName) : null;
    setValidationStatus((prev) => ({ ...prev, streetName: isStreetNameValid }));

    let validAddresses: FormattedAddress[] = [];
    if (isStreetNameValid) {
      validAddresses = adressen.filter((v) => v.straatnaam === streetName);
    }

    const houseNumbers = validAddresses.map((v) => v.nummer);
    setValidHouseNumbers(houseNumbers);

    const isHouseNumberValid = houseNumber ? houseNumbers.includes(houseNumber) : null;
    setValidationStatus((prev) => ({ ...prev, houseNumber: isHouseNumberValid }));

    if (isStreetNameValid && isHouseNumberValid) {
      setAddressValidityMessage('Valid address!');
    } else if (!streetName || !houseNumber || !postalCode) {
      setAddressValidityMessage('Please fill in all address fields');
    } else {
      setAddressValidityMessage('Invalid address!');
    }
  }, [streetName, houseNumber, postalCodeInfo, postalCode]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Handle form submission here
    console.log({ postalCode, streetName, houseNumber });
  };

  const Map = useMemo(
    () =>
      dynamic(() => import('@/components/Map'), {
        loading: () => <p>A map is loading</p>,
        ssr: false,
      }),
    []
  );

  const getBorderColor = (status: boolean | null) => {
    if (status === null) return '';
    return status ? 'border-green-500' : 'border-red-500';
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md">
        <form
          className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4"
          onSubmit={handleSubmit}
        >
          <div className="mb-4">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="postalCode"
            >
              Postal Code
            </label>
            <input
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
              id="postalCode"
              type="text"
              placeholder="e.g. 1234 AB"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="streetName"
            >
              Street Name
            </label>
            <input
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${getBorderColor(
                validationStatus.streetName
              )}`}
              id="streetName"
              type="text"
              placeholder="e.g. Main Street"
              value={streetName}
              onChange={(e) => setStreetName(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="houseNumber"
            >
              House Number
            </label>
            <input
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${getBorderColor(
                validationStatus.houseNumber
              )}`}
              id="houseNumber"
              type="text"
              placeholder="e.g. 123"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
            />
          </div>

          {validHouseNumbers.length > 0 && (
            <div className="mb-4 text-sm text-gray-600">
              Geldige huisnummers: {validHouseNumbers.join(', ')}
            </div>
          )}

          {addressValidityMessage && (
            <div
              className={`mb-4 text-sm ${addressValidityMessage === 'Valid address!'
                  ? 'text-green-500'
                  : 'text-red-500'
                }`}
            >
              {addressValidityMessage}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="submit"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
      <div className="w-full max-w-md mt-8">
        <Map />
      </div>
    </main>
  );
}