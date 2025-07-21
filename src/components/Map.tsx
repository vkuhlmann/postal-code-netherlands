'use client';

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

interface MapProps {
  coordinates: [number, number] | null;
}

const MapUpdater = ({ coordinates }: MapProps) => {
  const map = useMap();
  useEffect(() => {
    if (coordinates) {
      map.setView(coordinates, 13);
    }
  }, [coordinates, map]);
  return null;
};

const Map = ({ coordinates }: MapProps) => {
  const customIcon = new L.Icon({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

  console.info(`Leaflet marker iconUrl: ${markerIcon}`);
  console.info(`Leaflet marker iconUrl type: ${typeof markerIcon}`);
  console.info(`Leaflet marker iconUrl.src: ${markerIcon.src}`);
  console.info(`Leaflet marker iconUrl: ${JSON.stringify(markerIcon)}`);
  console.info(`customIcon options: ${JSON.stringify(customIcon.options)}`);
  console.info(`customIcon iconUrl: ${customIcon.options.iconUrl}`);

  return (
    <MapContainer
      center={coordinates || [52.1326, 5.2913]} // Coordinates for the Netherlands
      zoom={coordinates ? 13 : 7}
      scrollWheelZoom={true}
      style={{ height: "400px", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {coordinates && <Marker position={coordinates} icon={customIcon} />}
      <MapUpdater coordinates={coordinates} />
    </MapContainer>
  );
};

export default Map;
