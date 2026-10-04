'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { FTU_COORDINATES } from '@/lib/utils/distance';

interface MapPinPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  height?: string;
}

const pinIcon = L.divIcon({
  html: `
    <div style="
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #8A1538;
        border: 3px solid #ffffff;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 16px;
      ">
        📍
      </div>
    </div>
  `,
  className: 'pin-picker-marker',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function LocationMarker({ 
  lat, 
  lng, 
  onChange 
}: { 
  lat: number; 
  lng: number; 
  onChange: (lat: number, lng: number) => void 
}) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });

  return <Marker position={[lat, lng]} icon={pinIcon} />;
}

// Controller to smoothly pan/zoom map to selected location
function MapViewController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 17, { animate: true, duration: 0.8 });
    }
  }, [lat, lng, map]);
  return null;
}

export default function MapPinPicker({ 
  lat, 
  lng, 
  onChange, 
  height = '280px' 
}: MapPinPickerProps) {
  return (
    <div 
      className="w-full relative rounded-xl overflow-hidden border border-border shadow-inner" 
      style={{ height, minHeight: '260px' }}
    >
      <MapContainer
        center={[lat || FTU_COORDINATES.lat, lng || FTU_COORDINATES.lng]}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"}
          subdomains="abcd"
          maxZoom={19}
        />
        <MapViewController lat={lat} lng={lng} />
        <LocationMarker lat={lat} lng={lng} onChange={onChange} />
      </MapContainer>
      <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm text-[11px] text-gray-700 z-[1000] border border-gray-200 pointer-events-none flex justify-between">
        <span>Bấm vào bản đồ để ghim tọa độ</span>
        <span className="font-mono text-burgundy font-bold">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
      </div>
    </div>
  );
}
