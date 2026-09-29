'use client';

import React from 'react';
import { Place } from '@/lib/types/database';
import { PlaceCard } from '@/components/place/PlaceCard';
import { Sparkles } from 'lucide-react';

interface SimilarPlacesProps {
  places: Place[];
}

export function SimilarPlaces({ places }: SimilarPlacesProps) {
  if (places.length === 0) return null;

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-burgundy" />
        <h3 className="font-bold text-lg text-gray-900">Địa điểm tương tự gần đây</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {places.map((place) => (
          <PlaceCard key={place.id} place={place} />
        ))}
      </div>
    </div>
  );
}
