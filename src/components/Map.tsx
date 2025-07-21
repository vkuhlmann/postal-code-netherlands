'use client';

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import L, { divIcon } from "leaflet";
import { FormattedAddress } from "@/app/postal_code";

interface MapProps {
  locations: FormattedAddress[];
}

const MapUpdater = ({ locations }: MapProps) => {
  const map = useMap();
  useEffect(() => {
    if (locations && locations.length > 0) {
      const coordinates = locations.map(l => l.coordinates).filter(c => c !== null) as [number, number][];
      if (coordinates.length > 0) {
        if (coordinates.length === 1) {
          map.setView(coordinates[0], 13);
        } else {
          const bounds = new L.LatLngBounds(coordinates);
          map.fitBounds(bounds.pad(0.2));
        }
      }
    }
  }, [locations, map]);
  return null;
};

const Map = ({ locations }: MapProps) => {
  const customIcon = new L.Icon({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

  const center: [number, number] = locations && locations.length > 0 && locations[0].coordinates ? locations[0].coordinates : [52.1326, 5.2913];

  const createLabelIcon = (label: string) => {
    return divIcon({
      html: `<span>${label}</span>`,
      className: 'custom-div-icon',
      iconAnchor: [0, 0]
    });
  };

  return (
    <MapContainer
        center={center}
      zoom={locations && locations.length > 0 ? 13 : 7}
      scrollWheelZoom={true}
      style={{ height: "400px", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={23}
      />
      {locations && locations.map((location, index) => (
        location.coordinates && <Marker key={index} position={location.coordinates} icon={locations.length > 1 ? createLabelIcon(location.huis_nlt) : customIcon} />
      ))}
      <MapUpdater locations={locations} />
    </MapContainer>
  );
};

export default Map;
