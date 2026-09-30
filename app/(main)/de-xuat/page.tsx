'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { store } from '@/lib/data/store';
import { FTU_COORDINATES } from '@/lib/utils/distance';
import { useToast } from '@/components/common/Toast';
import { PlusCircle, MapPin, Search, Loader2, X, Sparkles, Clock, Tag } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';

const MapPinPicker = dynamic(() => import('@/components/map/MapPinPicker'), {
  ssr: false,
  loading: () => <div className="h-64 bg-slate-100 rounded-xl animate-pulse"></div>,
});

function SuggestPlaceContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(1);
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(FTU_COORDINATES.lat);
  const [lng, setLng] = useState(FTU_COORDINATES.lng);
  const [description, setDescription] = useState('');
  const [openTime, setOpenTime] = useState('07:30');
  const [closeTime, setCloseTime] = useState('22:30');
  const [priceLevel, setPriceLevel] = useState(2);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<number[]>([1, 2, 5]);
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Google Places Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; name: string; address: string; lat: number; lng: number }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const categories = store.getCategories();
  const amenities = store.getAmenities();

  // Debounced Google Places Search (400ms)
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?query=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.places)) {
            setSearchResults(json.places);
            setIsDropdownOpen(true);
          }
        }
      } catch (err) {
        console.warn('Google Places search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectGooglePlace = (place: { name: string; address: string; lat: number; lng: number }) => {
    // 1. Auto-fill Place Name
    if (place.name) {
      setName(place.name);
    }
    // 2. Auto-fill Place Address
    if (place.address) {
      setAddress(place.address);
    }
    // 3. Update Coordinates (centers & zooms MapPinPicker)
    if (place.lat && place.lng) {
      setLat(place.lat);
      setLng(place.lng);
    }
    // 4. Close dropdown
    setIsDropdownOpen(false);
    setSearchQuery(place.name || '');
    showToast(`Đã tự động điền "${place.name}" và ghim vị trí từ Google Places!`, 'success');
  };

  const handleAmenityToggle = (id: number) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      showToast('Vui lòng điền đầy đủ tên và địa chỉ quán', 'error');
      return;
    }

    setSubmitting(true);

    const chosenAmenities = amenities.filter((a) => selectedAmenityIds.includes(a.id));

    const placePayload = {
      name: name.trim(),
      category_id: categoryId,
      address: address.trim(),
      lat,
      lng,
      description: description.trim(),
      opening_hours: {
        monday: { open: openTime, close: closeTime },
        tuesday: { open: openTime, close: closeTime },
        wednesday: { open: openTime, close: closeTime },
        thursday: { open: openTime, close: closeTime },
        friday: { open: openTime, close: closeTime },
        saturday: { open: openTime, close: closeTime },
        sunday: { open: openTime, close: closeTime },
      },
      price_level: priceLevel,
      images: imageUrl.trim()
        ? [imageUrl.trim()]
        : ['https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1000&q=80'],
      amenities: chosenAmenities,
      created_by: user?.id || null,
    };

    let targetPlaceId = '';
    let targetLat = lat;
    let targetLng = lng;

    try {
      // 1. Submit to API endpoint (inserts into Supabase public.places and returns created record with UUID)
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(placePayload),
      });

      const resJson = await res.json();

      if (res.ok && resJson.success && resJson.place) {
        targetPlaceId = resJson.place.id;
        targetLat = resJson.place.lat;
        targetLng = resJson.place.lng;
      } else {
        const fallbackPlace = store.proposePlace(placePayload, user || undefined);
        targetPlaceId = fallbackPlace.id;
        targetLat = fallbackPlace.lat;
        targetLng = fallbackPlace.lng;
      }
    } catch (err: any) {
      console.warn('Proposal submission notice:', err.message);
      const fallbackPlace = store.proposePlace(placePayload, user || undefined);
      targetPlaceId = fallbackPlace.id;
      targetLat = fallbackPlace.lat;
      targetLng = fallbackPlace.lng;
    }

    setSubmitting(false);
    showToast(
      'Gửi đề xuất địa điểm thành công! Quán đang ở trạng thái Chờ duyệt bởi Ban Quản Trị FTU.',
      'success'
    );

    // 2. Auto navigate to home map, prioritizing place.id, then lat/lng
    router.push(`/?placeId=${targetPlaceId}&lat=${targetLat}&lng=${targetLng}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 pb-24 md:pb-12">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <PlusCircle className="w-6 h-6 text-burgundy" />
          Đề xuất địa điểm học tập mới
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Biết quán cà phê hay góc học tập lý tưởng nào quanh Ngoại thương? Hãy chia sẻ cùng cộng đồng FTUer!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-soft space-y-6">
        {/* Name & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Tên địa điểm *</label>
            <input
              type="text"
              required
              placeholder="VD: Cà Phê Mùa Thu Chùa Láng"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Loại hình</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Địa chỉ chính xác *</label>
          <input
            type="text"
            required
            placeholder="VD: Số 12 Ngõ 84 Phố Chùa Láng, Đống Đa, Hà Nội"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy"
          />
        </div>

        {/* Mini Map Coordinate Picker with Google Places Search Box */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-burgundy" /> Ghim vị trí tọa độ trên bản đồ
            </label>
            <span className="text-[11px] text-gray-500">Bấm trực tiếp lên bản đồ để di chuyển ghim</span>
          </div>

          {/* Google Places Search Box positioned directly above map */}
          <div ref={searchContainerRef} className="relative z-20">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setIsDropdownOpen(true);
                }}
                placeholder="Tìm kiếm quán qua Google Places (VD: Highlands Láng Hạ, Aha Chùa Láng...)"
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy bg-slate-50 focus:bg-white transition-colors"
              />
              {isSearching && (
                <Loader2 className="w-3.5 h-3.5 text-burgundy animate-spin absolute right-3 pointer-events-none" />
              )}
              {!isSearching && searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setIsDropdownOpen(false);
                  }}
                  className="absolute right-2.5 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown Results list over map */}
            {isDropdownOpen && searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-border shadow-lg max-h-56 overflow-y-auto z-[1050] divide-y divide-gray-100">
                {isSearching ? (
                  <div className="p-3 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-burgundy" />
                    Đang tìm kiếm địa điểm trên Google Places...
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.id || `${item.lat}-${item.lng}`}
                      type="button"
                      onClick={() => handleSelectGooglePlace(item)}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-burgundy/5 transition-colors flex items-start gap-2.5 group"
                    >
                      <MapPin className="w-4 h-4 text-burgundy flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-gray-900 group-hover:text-burgundy truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate mt-0.5">
                          {item.address}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-gray-500">
                    Không tìm thấy địa điểm phù hợp trên Google Places.
                  </div>
                )}
              </div>
            )}
          </div>

          <MapPinPicker
            lat={lat}
            lng={lng}
            onChange={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
            height="260px"
          />
        </div>

        {/* Hours & Price */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Giờ mở cửa</label>
            <input
              type="time"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Giờ đóng cửa</label>
            <input
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Mức giá</label>
            <select
              value={priceLevel}
              onChange={(e) => setPriceLevel(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy bg-white"
            >
              <option value={1}>$ (&lt; 30.000đ - Giá sinh viên)</option>
              <option value={2}>$$ (30.000đ - 50.000đ)</option>
              <option value={3}>$$$ (50.000đ - 70.000đ)</option>
              <option value={4}>$$$$ (&gt; 70.000đ)</option>
            </select>
          </div>
        </div>

        {/* Amenities Selection */}
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-2">Tiện ích học tập có tại quán</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {amenities.map((am) => {
              const checked = selectedAmenityIds.includes(am.id);
              return (
                <button
                  key={am.id}
                  type="button"
                  onClick={() => handleAmenityToggle(am.id)}
                  className={`p-2 rounded-xl border text-xs font-medium text-left transition-colors ${
                    checked
                      ? 'border-burgundy bg-burgundy-light text-burgundy font-bold'
                      : 'border-border text-gray-700 hover:bg-slate-50'
                  }`}
                >
                  {checked ? '✓ ' : '+ '}
                  {am.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Mô tả chi tiết</label>
          <textarea
            rows={3}
            placeholder="Mô tả không gian, ánh sáng, số lượng ổ điện, độ yên tĩnh, phong cách của quán..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy"
          />
        </div>

        {/* Image link */}
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Link ảnh quán (URL Unsplash / Online)</label>
          <input
            type="url"
            placeholder="https://images.unsplash.com/..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-burgundy hover:bg-burgundy-hover text-white font-bold text-sm transition-colors shadow-sm"
          >
            {submitting ? 'Đang gửi...' : 'Gửi đề xuất phê duyệt'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SuggestPlacePage() {
  return (
    <AuthGuard>
      <SuggestPlaceContent />
    </AuthGuard>
  );
}
