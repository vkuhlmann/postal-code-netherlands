'use client';

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import L, { divIcon } from "leaflet";
import { FormattedAddress } from "@/app/postal_code";

// const MAX_GROUPING_DISTANCE = 0.00002; // Euclidean distance in degrees

interface MapProps {
  locations: FormattedAddress[];
  onLocationSelect: (location: FormattedAddress) => void;
}

const MapUpdater = ({ locations }:  { locations: FormattedAddress[] }) => {
  const map = useMap();
  useEffect(() => {
    if (locations && locations.length > 0) {
      const coordinates = locations.map(l => l.coordinates).filter(c => c !== null) as [number, number][];
      if (coordinates.length > 0) {
        if (coordinates.length === 1) {
          // map.setView(coordinates[0], 13);
          map.setView(coordinates[0]);
        } else {
          const bounds = new L.LatLngBounds(coordinates);
          if (Math.abs(bounds.getNorth() - bounds.getSouth()) > 0.0001 && Math.abs(bounds.getEast() - bounds.getWest()) > 0.0001) {
            map.fitBounds(bounds.pad(0.2));
          } else {
            map.setView(bounds.getCenter(), 13);
          }
        }
      }
    }
  }, [locations, map]);
  return null;
};

const MapZoomHandler = ({ onZoomChange }: { onZoomChange: (zoom: number) => void }) => {
  const map = useMap();
  useEffect(() => {
    const handleZoomChange = () => {
      onZoomChange(map.getZoom());
    };
    map.on('zoomend', handleZoomChange);
    // Initial zoom level
    onZoomChange(map.getZoom());
    return () => {
      map.off('zoomend', handleZoomChange);
    };
  }, [map, onZoomChange]);
  return null;
};

const euclideanDistance = (coord1: [number, number], coord2: [number, number]): number => {
  return Math.sqrt(Math.pow(coord1[0] - coord2[0], 2) + Math.pow(coord1[1] - coord2[1], 2));
};

const Map = ({ locations, onLocationSelect }: MapProps) => {
  const [zoom, setZoom] = useState(7); // Initial zoom level

  const getGroupingDistance = (currentZoom: number): number => {
    console.log(`Current zoom level: ${currentZoom}`);
    // Adjust these values based on desired grouping behavior at different zoom levels
    if (currentZoom > 23) return 0.000001;
    if (currentZoom > 22) return 0.000003;
    if (currentZoom > 21) return 0.000005;
    if (currentZoom > 19) return 0.00001;
    if (currentZoom > 18) return 0.00002;
    if (currentZoom > 17) return 0.00015;
    if (currentZoom > 16) return 0.0002;
    if (currentZoom > 15) return 0.0004;
    if (currentZoom > 14) return 0.001;
    if (currentZoom > 13) return 0.005;
    return 0.01;
  };

  const currentGroupingDistance = getGroupingDistance(zoom);
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

  const groupedLocations: (FormattedAddress | FormattedAddress[])[] = [];
  const usedIndices = new Set<number>();

  locations.forEach((location, index) => {
    if (usedIndices.has(index)) {
      return;
    }

    const group: FormattedAddress[] = [location];
    usedIndices.add(index);

    if (location.coordinates) {
      for (let i = index + 1; i < locations.length; i++) {
        if (usedIndices.has(i)) {
          continue;
        }

        const otherLocation = locations[i];
        if (otherLocation.coordinates && euclideanDistance(location.coordinates, otherLocation.coordinates) < currentGroupingDistance) {
          group.push(otherLocation);
          usedIndices.add(i);
        }
      }
    }

    if (group.length > 1) {
      groupedLocations.push(group);
    } else {
      groupedLocations.push(location);
    }
  });

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
      {groupedLocations.map((item, index) => {
        if (Array.isArray(item)) {
          // This is a group of locations
          const firstHouseNumber = Math.min(...item.map(loc => parseInt(loc.huis_nlt.replace(/[^0-9]/g, ''))));
          const lastHouseNumber = Math.max(...item.map(loc => parseInt(loc.huis_nlt.replace(/[^0-9]/g, ''))));
          const label = `${firstHouseNumber}-${lastHouseNumber}`;
          const groupCenter = item[0].coordinates; // Use the first location's coordinates as the group center

          return groupCenter && (
            <Marker
              key={index}
              position={groupCenter}
              icon={createLabelIcon(label)}
              eventHandlers={{
                click: () => {
                  // When a grouped marker is clicked, select the first location in the group
                  onLocationSelect(item[0]);
                },
              }}
            />
          );
        } else {
          // This is a single location
          const location = item;
          return location.coordinates && (
            <Marker
              key={index}
              position={location.coordinates}
              icon={locations.length > 1 ? createLabelIcon(location.huis_nlt) : customIcon}
              eventHandlers={{
                click: () => onLocationSelect(location),
              }}
            />
          );
        }
      })}
      <MapUpdater locations={locations} />
      <MapZoomHandler onZoomChange={setZoom} />
    </MapContainer>
  );
};

export default Map;
