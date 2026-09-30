'use client';

import React, { useEffect, useRef } from 'react';
import { MapContainer as LeafletMap, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Place } from '@/lib/types/database';
import { FTU_COORDINATES, formatDistance } from '@/lib/utils/distance';
import { createFtuMarkerIcon, createPlaceMarkerIcon } from './MarkerIcons';
import Link from 'next/link';
import { Star, MapPin, ArrowRight } from 'lucide-react';

interface MapContainerProps {
  places: Place[];
  selectedPlaceId?: string | null;
  targetCoords?: { lat: number; lng: number } | null;
  onSelectPlace?: (place: Place) => void;
  height?: string;
  minHeight?: string;
}

// Controller to fly to place and open popup or reset to FTU center
function MapFlyController({ 
  selectedPlace, 
  targetCoords,
  markerRefs 
}: { 
  selectedPlace?: Place; 
  targetCoords?: { lat: number; lng: number } | null;
  markerRefs: React.MutableRefObject<Record<string, L.Marker | null>> 
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedPlace) {
      map.flyTo([selectedPlace.lat, selectedPlace.lng], 16, {
        animate: true,
        duration: 1.0,
      });

      const targetMarker = markerRefs.current[selectedPlace.id];
      if (targetMarker) {
        targetMarker.openPopup();
      }
    } else if (targetCoords) {
      map.flyTo([targetCoords.lat, targetCoords.lng], 16, {
        animate: true,
        duration: 1.0,
      });
    } else {
      map.flyTo([FTU_COORDINATES.lat, FTU_COORDINATES.lng], 16, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [selectedPlace, targetCoords, map, markerRefs]);

  return null;
}

export default function MapContainer({
  places,
  selectedPlaceId,
  targetCoords,
  onSelectPlace,
}: MapContainerProps) {
  const selectedPlace = places.find((p) => p.id === selectedPlaceId);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  return (
    <div style={{ height: '100%', width: '100%' }} className="relative w-full h-full">
      <LeafletMap
        center={targetCoords ? [targetCoords.lat, targetCoords.lng] : [FTU_COORDINATES.lat, FTU_COORDINATES.lng]}
        zoom={16}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        {/* OpenStreetMap Standard Free Tiles (Never requires API key) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapFlyController selectedPlace={selectedPlace} targetCoords={targetCoords} markerRefs={markerRefs} />

        {/* Foreign Trade University Central Marker - Burgundy #8A1538 */}
        <Marker
          position={[FTU_COORDINATES.lat, FTU_COORDINATES.lng]}
          icon={createFtuMarkerIcon()}
        >
          <Popup className="custom-leaflet-popup">
            <div className="p-2 text-center max-w-[200px]">
              <div className="text-xs font-bold text-burgundy">{FTU_COORDINATES.name}</div>
              <div className="text-[11px] text-gray-500 mt-1">{FTU_COORDINATES.address}</div>
              <div className="mt-2 text-[10px] bg-burgundy-light text-burgundy font-semibold px-2 py-0.5 rounded-full inline-block">
                Điểm mốc gốc 0m
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Place Markers with crowd-colored droplet icons */}
        {places.map((place) => {
          const isSelected = place.id === selectedPlaceId;
          const markerIcon = createPlaceMarkerIcon(
            place.crowd_status,
            isSelected,
            place.price_level
          );

          return (
            <Marker
              key={place.id}
              position={[place.lat, place.lng]}
              icon={markerIcon}
              ref={(ref) => {
                if (ref) markerRefs.current[place.id] = ref;
              }}
              eventHandlers={{
                click: () => {
                  if (onSelectPlace) {
                    onSelectPlace(place);
                  }
                },
              }}
            >
              <Popup className="custom-leaflet-popup">
                <div className="p-2 min-w-[220px] max-w-[260px] space-y-2">
                  <div className="relative rounded-lg overflow-hidden h-24 bg-slate-100">
                    <img
                      src={
                        place.images[0] ||
                        'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80'
                      }
                      alt={place.name}
                      className="w-full h-full object-cover"
                    />
                    {place.average_rating && (
                      <div className="absolute bottom-1.5 left-1.5 bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>{place.average_rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-gray-900 leading-tight">
                      {place.name}
                    </h4>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-1 truncate">
                      <MapPin className="w-3 h-3 text-burgundy flex-shrink-0" />
                      <span>{place.address}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border">
                    <span className="font-semibold text-burgundy">
                      {formatDistance(place.distance_meters || 0)} từ FTU
                    </span>
                    <Link
                      href={`/dia-diem/${place.id}`}
                      className="font-bold text-burgundy hover:text-burgundy-hover flex items-center gap-0.5"
                    >
                      Chi tiết <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </LeafletMap>
    </div>
  );
}
