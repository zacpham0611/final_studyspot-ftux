'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { store } from '@/lib/data/store';
import { Place } from '@/lib/types/database';
import { PlaceCard } from '@/components/place/PlaceCard';
import { Heart, Compass, ArrowLeft } from 'lucide-react';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Place[]>([]);

  const loadFavorites = () => {
    setFavorites(store.getUserFavorites());
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 pb-24 md:pb-12">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
            Địa điểm yêu thích của bạn
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Danh sách các quán cà phê, thư viện đã lưu để học tập quanh FTU
          </p>
        </div>
        <Link
          href="/"
          className="text-xs font-semibold text-burgundy bg-burgundy-light px-3 py-2 rounded-xl flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại bản đồ
        </Link>
      </div>

      {favorites.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-border shadow-soft text-center space-y-3">
          <Heart className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="font-bold text-gray-800 text-base">Chưa có địa điểm yêu thích nào</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Khi xem danh sách quán quanh trường Ngoại thương, hãy nhấn vào biểu tượng Trái tim để lưu quán vào đây.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-burgundy text-white text-xs font-bold shadow-sm"
          >
            <Compass className="w-4 h-4" /> Khám phá bản đồ ngay
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              onFavoriteToggle={() => loadFavorites()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
