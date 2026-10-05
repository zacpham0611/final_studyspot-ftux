'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { store } from '@/lib/data/store';
import { FTU_COORDINATES } from '@/lib/utils/distance';
import { useToast } from '@/components/common/Toast';
import { PlusCircle, MapPin, Search, Loader2, X, AlertCircle, Check, Compass } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Category, Amenity } from '@/lib/types/database';
import { WEEK_DAYS, ALL_DAY_KEYS } from '@/lib/utils/hours';
import { PRICE_RANGE_OPTIONS, calculatePriceLevel } from '@/lib/utils/price';

const MapPinPicker = dynamic(() => import('@/components/map/MapPinPicker'), {
  ssr: false,
  loading: () => <div className="h-64 bg-slate-100 rounded-xl animate-pulse"></div>,
});

function SuggestPlaceContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>(() => store.getAmenities());
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(FTU_COORDINATES.lat);
  const [lng, setLng] = useState(FTU_COORDINATES.lng);
  const [latInput, setLatInput] = useState(FTU_COORDINATES.lat.toString());
  const [lngInput, setLngInput] = useState(FTU_COORDINATES.lng.toString());
  const [coordError, setCoordError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [is24h, setIs24h] = useState(false);
  const [openDays, setOpenDays] = useState<string[]>([...ALL_DAY_KEYS]);
  const [openTime, setOpenTime] = useState('07:30');
  const [closeTime, setCloseTime] = useState('22:30');
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>(['30.000đ – 50.000đ']);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<number[]>([1, 2, 5]);
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Map Search State (OpenStreetMap Nominatim Search)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; name: string; address: string; lat: number; lng: number }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Reverse Geocoding State (Map Click)
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [geocodedLocation, setGeocodedLocation] = useState<{
    name?: string;
    address: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [reverseError, setReverseError] = useState<string | null>(null);

  useEffect(() => {
    const updateStoreData = () => {
      const cats = store.getCategories();
      if (cats && cats.length > 0) {
        setCategories(cats);
        setCategoryId((prev) => (prev && cats.some((c) => Number(c.id) === Number(prev))) ? prev : Number(cats[0].id));
      }
      const ams = store.getAmenities();
      if (ams && ams.length > 0) {
        setAmenities(ams);
      }
    };

    updateStoreData();
    fetch('/api/categories', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
          setCategoryId((prev) => (prev && data.categories.some((c: Category) => Number(c.id) === Number(prev))) ? prev : Number(data.categories[0].id));
        }
      })
      .catch(() => {});
    store.loadFromSupabase().then(updateStoreData);
    const unsub = store.subscribe(updateStoreData);
    return () => unsub();
  }, []);

  // Debounced Search (400ms) calling server-side Nominatim endpoint
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?query=${encodeURIComponent(searchQuery.trim())}`);
        const json = await res.json();

        if (res.ok && json.success) {
          setSearchResults(Array.isArray(json.places) ? json.places : []);
          setSearchError(null);
        } else {
          setSearchResults([]);
          setSearchError(json.error || 'Không thể lấy dữ liệu tìm kiếm.');
        }
        setIsDropdownOpen(true);
      } catch (err: any) {
        console.warn('Map search error:', err);
        setSearchResults([]);
        setSearchError('Lỗi kết nối dịch vụ tìm kiếm địa điểm.');
        setIsDropdownOpen(true);
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

  // Reusable Server-side Nominatim Reverse Geocoding
  const executeReverseGeocode = async (targetLat: number, targetLng: number) => {
    setIsReverseGeocoding(true);
    setReverseError(null);
    setGeocodedLocation(null);

    try {
      const res = await fetch(`/api/places/reverse?lat=${targetLat}&lng=${targetLng}`);
      const json = await res.json();

      if (res.ok && json.success && json.data) {
        const found = json.data;
        const resultItem = {
          name: found.name || '',
          address: found.address || '',
          lat: targetLat,
          lng: targetLng,
        };

        setGeocodedLocation(resultItem);

        // Autofill Address field automatically
        if (found.address) {
          setAddress(found.address);
        }

        // If meaningful place name returned and place name field is empty, suggest it
        if (found.name && !name.trim()) {
          setName(found.name);
        }
      } else {
        setReverseError(json.error || 'Không tìm thấy thông tin địa chỉ tại tọa độ này.');
      }
    } catch (err: any) {
      console.warn('Reverse geocoding error:', err);
      setReverseError('Lỗi kết nối định vị địa chỉ từ tọa độ.');
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Synchronize manual coordinate inputs (Validation: lat [-90, 90], lng [-180, 180])
  useEffect(() => {
    const trimmedLat = latInput.trim();
    const trimmedLng = lngInput.trim();

    if (!trimmedLat || !trimmedLng) {
      setCoordError(null);
      return;
    }

    const pLat = parseFloat(trimmedLat);
    const pLng = parseFloat(trimmedLng);

    if (isNaN(pLat) || pLat < -90 || pLat > 90) {
      setCoordError('Vĩ độ (Latitude) phải là số từ -90 đến 90');
      return;
    }

    if (isNaN(pLng) || pLng < -180 || pLng > 180) {
      setCoordError('Kinh độ (Longitude) phải là số từ -180 đến 180');
      return;
    }

    setCoordError(null);

    // If coordinates are valid and changed from current map pin
    if (pLat !== lat || pLng !== lng) {
      setLat(pLat);
      setLng(pLng);

      const timer = setTimeout(() => {
        executeReverseGeocode(pLat, pLng);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [latInput, lngInput, lat, lng]);

  // 1. Flow Search Place -> select result -> autofill name/address/coordinates -> flyTo
  const handleSelectPlace = (place: { name: string; address: string; lat: number; lng: number }) => {
    if (place.name) {
      setName(place.name);
    }
    if (place.address) {
      setAddress(place.address);
    }
    if (place.lat != null && place.lng != null) {
      setLat(place.lat);
      setLng(place.lng);
      setLatInput(place.lat.toString());
      setLngInput(place.lng.toString());
      setCoordError(null);
    }
    setIsDropdownOpen(false);
    setSearchQuery(place.name || '');
    setGeocodedLocation(null);
    setReverseError(null);
    showToast(`Đã tự động điền "${place.name}" và ghim vị trí trên bản đồ!`, 'success');
  };

  // 2. Flow Map Click -> reverse geocode -> autofill address/coordinates -> confirm
  const handleMapLocationSelect = (clickedLat: number, clickedLng: number) => {
    // Move marker to clicked coordinates & update manual coordinate inputs
    setLat(clickedLat);
    setLng(clickedLng);
    setLatInput(clickedLat.toFixed(6));
    setLngInput(clickedLng.toFixed(6));
    setCoordError(null);

    // Trigger Server-side Nominatim Reverse Geocoding
    executeReverseGeocode(clickedLat, clickedLng);
  };

  const handleAmenityToggle = (id: number) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleDay = (dayKey: string) => {
    if (is24h) return;
    setOpenDays((prev) => {
      if (prev.includes(dayKey)) {
        if (prev.length === 1) {
          showToast('Địa điểm cần mở cửa ít nhất 1 ngày trong tuần', 'error');
          return prev;
        }
        return prev.filter((d) => d !== dayKey);
      } else {
        return [...prev, dayKey];
      }
    });
  };

  const handlePriceRangeToggle = (val: string) => {
    setSelectedPriceRanges((prev) => {
      if (prev.includes(val)) {
        if (prev.length === 1) {
          showToast('Vui lòng chọn ít nhất 1 khoảng giá', 'error');
          return prev;
        }
        return prev.filter((r) => r !== val);
      } else {
        return [...prev, val];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      showToast('Vui lòng điền đầy đủ tên và địa chỉ quán', 'error');
      return;
    }

    const finalLat = parseFloat(latInput);
    const finalLng = parseFloat(lngInput);
    if (!user || !user.id) {
      showToast('Vui lòng đăng nhập để gửi đề xuất địa điểm.', 'error');
      return;
    }

    if (isNaN(finalLat) || finalLat < -90 || finalLat > 90 || isNaN(finalLng) || finalLng < -180 || finalLng > 180) {
      showToast('Tọa độ (Latitude/Longitude) không hợp lệ', 'error');
      return;
    }

    setSubmitting(true);

    const chosenAmenities = amenities.filter((a) => selectedAmenityIds.includes(a.id));
    const activeCategories = categories.length > 0 ? categories : store.getCategories();
    const selectedCategory = activeCategories.find((c) => Number(c.id) === Number(categoryId));
    if (!selectedCategory) {
      showToast('Vui lòng chọn loại hình địa điểm (danh mục) hợp lệ', 'error');
      setSubmitting(false);
      return;
    }
    const targetCatId = Number(selectedCategory.id);
    const targetCatName = selectedCategory.name;

    const calculatedPriceLevel = calculatePriceLevel(selectedPriceRanges);

    const placePayload = {
      name: name.trim(),
      category_id: targetCatId,
      category_name: targetCatName,
      address: address.trim(),
      lat: finalLat,
      lng: finalLng,
      description: description.trim(),
      opening_hours: {
        is_24h: is24h,
        open_days: openDays,
        price_ranges: selectedPriceRanges,
        monday: { open: is24h ? '00:00' : openTime, close: is24h ? '23:59' : closeTime, is_closed: !openDays.includes('monday') },
        tuesday: { open: is24h ? '00:00' : openTime, close: is24h ? '23:59' : closeTime, is_closed: !openDays.includes('tuesday') },
        wednesday: { open: is24h ? '00:00' : openTime, close: is24h ? '23:59' : closeTime, is_closed: !openDays.includes('wednesday') },
        thursday: { open: is24h ? '00:00' : openTime, close: is24h ? '23:59' : closeTime, is_closed: !openDays.includes('thursday') },
        friday: { open: is24h ? '00:00' : openTime, close: is24h ? '23:59' : closeTime, is_closed: !openDays.includes('friday') },
        saturday: { open: is24h ? '00:00' : openTime, close: is24h ? '23:59' : closeTime, is_closed: !openDays.includes('saturday') },
        sunday: { open: is24h ? '00:00' : openTime, close: is24h ? '23:59' : closeTime, is_closed: !openDays.includes('sunday') },
      },
      price_level: calculatedPriceLevel,
      price_ranges: selectedPriceRanges,
      images: imageUrl.trim()
        ? [imageUrl.trim()]
        : ['https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1000&q=80'],
      amenities: chosenAmenities,
      created_by: user.id,
    };

    let targetPlaceId = '';
    let targetLat = finalLat;
    let targetLng = finalLng;

    try {
      // 1. Submit to API endpoint (inserts into Supabase public.places and returns created record with UUID)
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(placePayload),
      });

      const resJson = await res.json();

      if (!res.ok || !resJson.success || !resJson.place) {
        throw new Error(resJson.error || 'Lỗi gửi đề xuất địa điểm lên hệ thống.');
      }

      targetPlaceId = resJson.place.id;
      targetLat = resJson.place.lat;
      targetLng = resJson.place.lng;
      store.savePlace(resJson.place);

      setSubmitting(false);
      showToast(
        'Gửi đề xuất địa điểm thành công! Quán đang ở trạng thái Chờ duyệt bởi Ban Quản Trị FTU.',
        'success'
      );

      // 2. Auto navigate to home map, prioritizing place.id, then lat/lng
      router.push(`/?placeId=${targetPlaceId}&lat=${targetLat}&lng=${targetLng}`);
    } catch (err: any) {
      setSubmitting(false);
      showToast(err.message || 'Lỗi gửi đề xuất địa điểm. Vui lòng thử lại!', 'error');
    }
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
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy bg-white"
            >
              {categories.length === 0 ? (
                <option value="">Đang tải danh mục...</option>
              ) : (
                categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
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

        {/* Map Location Selector with Search & Reverse Geocoding */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-burgundy" /> 
              <span>Vị trí trên bản đồ & Tọa độ GPS</span>
            </label>
            <span className="text-[11px] text-gray-500">Nhập tọa độ hoặc click bản đồ để tự động lấy địa chỉ</span>
          </div>

          {/* Manual Coordinate Inputs: Latitude & Longitude (Primary coordinate input) */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-burgundy" />
                <span>Nhập tọa độ thủ công (Latitude & Longitude) *</span>
              </span>
              <span className="text-[11px] text-gray-500">VD: 21.028511, 105.804817</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Vĩ độ (Latitude) [-90 đến 90] *
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="VD: 21.028511"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-mono focus:outline-none bg-white transition-colors ${
                    coordError && (isNaN(parseFloat(latInput)) || parseFloat(latInput) < -90 || parseFloat(latInput) > 90)
                      ? 'border-rose-500 text-rose-700 focus:border-rose-600 ring-1 ring-rose-200'
                      : 'border-border focus:border-burgundy'
                  }`}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Kinh độ (Longitude) [-180 đến 180] *
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="VD: 105.804817"
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-mono focus:outline-none bg-white transition-colors ${
                    coordError && (isNaN(parseFloat(lngInput)) || parseFloat(lngInput) < -180 || parseFloat(lngInput) > 180)
                      ? 'border-rose-500 text-rose-700 focus:border-rose-600 ring-1 ring-rose-200'
                      : 'border-border focus:border-burgundy'
                  }`}
                />
              </div>
            </div>

            {coordError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span className="font-medium">{coordError}</span>
              </div>
            )}
          </div>

          {/* Search Box positioned directly above map */}
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
                  if (searchResults.length > 0 || searchError) setIsDropdownOpen(true);
                }}
                placeholder="Tìm nhanh quán trên bản đồ (VD: Highlands Láng Hạ, Aha Chùa Láng...)"
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
                    setSearchError(null);
                    setIsDropdownOpen(false);
                  }}
                  className="absolute right-2.5 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
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
                    Đang tìm kiếm địa điểm trên bản đồ...
                  </div>
                ) : searchError ? (
                  <div className="p-3 text-center text-xs text-amber-600 flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{searchError}</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.id || `${item.lat}-${item.lng}`}
                      type="button"
                      onClick={() => handleSelectPlace(item)}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-burgundy/5 transition-colors flex items-start gap-2.5 group cursor-pointer"
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
                    Không tìm thấy địa điểm phù hợp trên bản đồ.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interactive Leaflet Map for click-to-locate */}
          <MapPinPicker
            lat={lat}
            lng={lng}
            onChange={(newLat, newLng) => {
              handleMapLocationSelect(newLat, newLng);
            }}
            height="260px"
          />

          {/* Reverse Geocode Loading Indicator */}
          {isReverseGeocoding && (
            <div className="p-3 bg-burgundy/5 border border-burgundy/20 rounded-xl flex items-center gap-2 text-xs text-burgundy animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              <span>Đang định vị và giải mã địa chỉ từ điểm đã bấm trên bản đồ...</span>
            </div>
          )}

          {/* Reverse Geocode Error Notice */}
          {reverseError && !isReverseGeocoding && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>{reverseError}</span>
              </div>
              <button
                type="button"
                onClick={() => setReverseError(null)}
                className="text-amber-500 hover:text-amber-700 cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Confirmation State: "Location found: [address]" with "Use this location" button */}
          {geocodedLocation && !isReverseGeocoding && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2.5 text-xs shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-bold text-emerald-900 flex items-center gap-1.5 flex-wrap">
                      <span>Location found:</span>
                      <span className="font-normal text-emerald-800 break-words">
                        {geocodedLocation.address}
                      </span>
                    </div>
                    {geocodedLocation.name && (
                      <div className="text-emerald-700 text-[11px] mt-1">
                        Gợi ý tên: <span className="font-semibold text-emerald-900">{geocodedLocation.name}</span>
                      </div>
                    )}
                    <div className="text-[10px] font-mono text-emerald-600 mt-0.5">
                      Tọa độ: {geocodedLocation.lat.toFixed(5)}, {geocodedLocation.lng.toFixed(5)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setGeocodedLocation(null)}
                  className="text-emerald-500 hover:text-emerald-700 p-0.5 cursor-pointer flex-shrink-0"
                  title="Đóng thông báo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-emerald-200/60">
                <button
                  type="button"
                  onClick={() => {
                    if (geocodedLocation.address) setAddress(geocodedLocation.address);
                    if (geocodedLocation.name && !name.trim()) setName(geocodedLocation.name);
                    setLat(geocodedLocation.lat);
                    setLng(geocodedLocation.lng);
                    setLatInput(geocodedLocation.lat.toString());
                    setLngInput(geocodedLocation.lng.toString());
                    setCoordError(null);
                    showToast('Đã áp dụng địa chỉ và tọa độ vào biểu mẫu!', 'success');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Use this location</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hours & Price */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="de-xuat-is-24h"
              checked={is24h}
              onChange={(e) => {
                const checked = e.target.checked;
                setIs24h(checked);
                if (checked) {
                  setOpenDays([...ALL_DAY_KEYS]);
                }
              }}
              className="w-4 h-4 text-burgundy rounded border-gray-300 focus:ring-burgundy cursor-pointer"
            />
            <label htmlFor="de-xuat-is-24h" className="text-xs font-bold text-gray-700 cursor-pointer select-none">
              Mở cửa 24/7 (Phục vụ cả ngày & đêm)
            </label>
          </div>

          {/* Opening Days Multi-select */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 block">
              Mở cửa vào:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {WEEK_DAYS.map((d) => {
                const isSelected = openDays.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    disabled={is24h}
                    onClick={() => handleToggleDay(d.key)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      isSelected
                        ? 'border-burgundy bg-burgundy-light text-burgundy shadow-xs'
                        : 'border-border text-gray-600 hover:bg-slate-50'
                    } ${is24h ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Daily hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Giờ mở cửa</label>
              <input
                type="time"
                disabled={is24h}
                value={is24h ? '00:00' : openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy ${
                  is24h ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Giờ đóng cửa</label>
              <input
                type="time"
                disabled={is24h}
                value={is24h ? '23:59' : closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy ${
                  is24h ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>

          {/* Price Range Multi-select */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-gray-700 block">
              Mức giá <span className="text-gray-400 font-normal">(có thể chọn nhiều khoảng giá)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRICE_RANGE_OPTIONS.map((opt) => {
                const checked = selectedPriceRanges.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePriceRangeToggle(opt.value)}
                    className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-colors ${
                      checked
                        ? 'border-burgundy bg-burgundy-light text-burgundy font-bold shadow-xs'
                        : 'border-border text-gray-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold mr-1">{checked ? '✓' : '+'}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
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
            className="w-full py-3 rounded-xl bg-burgundy hover:bg-burgundy-hover text-white font-bold text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50"
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
