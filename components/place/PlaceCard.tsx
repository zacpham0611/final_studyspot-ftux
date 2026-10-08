'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Place } from '@/lib/types/database';
import { formatDistance } from '@/lib/utils/distance';
import { Star, MapPin, Heart, ArrowRight, Clock } from 'lucide-react';
import { store } from '@/lib/data/store';
import { useToast } from '@/components/common/Toast';
import { getOpeningStatus, getPlaceCountdownText } from '@/lib/utils/hours';

interface PlaceCardProps {
  place: Place;
  isSelected?: boolean;
  onSelect?: () => void;
  onFavoriteToggle?: (isFav: boolean) => void;
  currentTime?: Date;
}

export function PlaceCard({ place, isSelected, onSelect, onFavoriteToggle, currentTime }: PlaceCardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isFav, setIsFav] = React.useState(false);

  React.useEffect(() => {
    setIsFav(store.isFavorite(place.id));
  }, [place.id]);

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const nextState = store.toggleFavorite(place.id);
    setIsFav(nextState);
    onFavoriteToggle?.(nextState);
    showToast(
      nextState ? `Đã lưu "${place.name}" vào danh sách yêu thích!` : `Đã bỏ lưu "${place.name}"`,
      'info'
    );
  };

  // Card body click: selects place on map (flyTo + highlight)
  const handleCardBodyClick = () => {
    onSelect?.();
  };

  // Title / Image / Button click: navigates directly to detail page
  const handleNavigateDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/dia-diem/${place.id}`);
  };

  const priceSymbol = '$'.repeat(place.price_level || 2);
  const currentHoursStatus = place.opening_hours ? getOpeningStatus(place.opening_hours, currentTime) : null;
  const isPlaceOpen = currentHoursStatus ? currentHoursStatus.isOpen : (place.is_open ?? true);
  const countdownText = getPlaceCountdownText(place.opening_hours, currentTime);

  return (
    <div
      onClick={handleCardBodyClick}
      className={`group relative bg-white rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden hover:scale-[1.01] ${
        isSelected
          ? 'border-burgundy ring-2 ring-burgundy/30 shadow-elevated bg-burgundy-light/10'
          : 'border-border hover:border-burgundy/40 hover:shadow-soft'
      }`}
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail Image -> Click navigates to Detail */}
        <div
          onClick={handleNavigateDetail}
          className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 cursor-pointer"
          title="Xem chi tiết địa điểm"
        >
          <img
            src={place.images[0] || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=400&q=80'}
            alt={place.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Crowd Badge Overlay */}
          {isPlaceOpen && (
            <div className="absolute top-1.5 left-1.5">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow text-white ${
                  place.crowd_status === 'empty'
                    ? 'bg-emerald-500'
                    : place.crowd_status === 'medium'
                    ? 'bg-amber-500'
                    : place.crowd_status === 'full'
                    ? 'bg-rose-500'
                    : 'bg-gray-500'
                }`}
              >
                {place.crowd_label || 'Chưa có data'}
              </span>
            </div>
          )}

          {/* Favorite Heart Button */}
          <button
            onClick={handleHeartClick}
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-gray-400 hover:text-rose-500 transition-colors shadow-sm"
            title="Lưu yêu thích"
          >
            <Heart
              className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-gray-400'}`}
            />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mb-0.5">
              <span className="font-semibold text-burgundy">{place.category?.name || 'Quán Cà Phê'}</span>
              <span>•</span>
              <span className="text-gray-500 font-mono">{priceSymbol}</span>
            </div>

            {/* Title -> Click navigates to Detail */}
            <h3
              onClick={handleNavigateDetail}
              className="font-bold text-sm sm:text-base text-text-primary hover:text-burgundy transition-colors truncate cursor-pointer"
              title="Xem chi tiết địa điểm"
            >
              {place.name}
            </h3>

            {/* Countdown immediately below Place Name */}
            {countdownText && (
              <p className="text-[11px] font-semibold text-amber-600 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                <span>{countdownText}</span>
              </p>
            )}

            <p className="text-xs text-text-secondary truncate mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-burgundy flex-shrink-0" />
              <span>{place.address}</span>
            </p>
          </div>

          {/* Amenities snippet */}
          <div className="flex items-center gap-2 text-[11px] text-gray-500 my-1">
            {place.amenities?.slice(0, 2).map((am) => (
              <span key={am.id} className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600 font-medium truncate">
                {am.name}
              </span>
            ))}
          </div>

          {/* Bottom Footer Info */}
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100">
            <div className="flex items-center gap-1 text-amber-500 font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-500" />
              <span>{place.average_rating || 4.8}</span>
              <span className="text-[10px] text-gray-400 font-normal">({place.review_count || 1})</span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-medium ${
                  isPlaceOpen ? 'text-emerald-600' : 'text-rose-500'
                }`}
              >
                {isPlaceOpen ? 'Mở cửa' : 'Đóng cửa'}
              </span>
              <span className="text-gray-300">•</span>
              <button
                onClick={handleNavigateDetail}
                className="text-[11px] font-bold text-burgundy hover:underline flex items-center gap-0.5"
              >
                Chi tiết <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
