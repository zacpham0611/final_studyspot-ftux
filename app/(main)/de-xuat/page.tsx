'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { store } from '@/lib/data/store';
import { FTU_COORDINATES } from '@/lib/utils/distance';
import { useToast } from '@/components/common/Toast';
import { PlusCircle, MapPin, Sparkles, Clock, Tag } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { supabase } from '@/lib/supabase/client';

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

  const categories = store.getCategories();
  const amenities = store.getAmenities();

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

    const placeData = {
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
    };

    let createdPlaceId = '';
    let createdLat = lat;
    let createdLng = lng;

    if (user?.id) {
      try {
        const { data: supaPlace, error: supaErr } = await supabase
          .from('places')
          .insert({
            name: placeData.name,
            category_id: placeData.category_id,
            address: placeData.address,
            lat: placeData.lat,
            lng: placeData.lng,
            description: placeData.description,
            opening_hours: placeData.opening_hours,
            price_level: placeData.price_level,
            images: placeData.images,
            status: 'pending',
            created_by: user.id,
          })
          .select()
          .single();

        if (!supaErr && supaPlace) {
          createdPlaceId = supaPlace.id;
          createdLat = supaPlace.lat;
          createdLng = supaPlace.lng;
        } else if (supaErr) {
          console.warn('Supabase place insert notice:', supaErr.message);
        }
      } catch (e) {
        console.warn('Supabase place proposal exception:', e);
      }
    }

    const newPlace = store.proposePlace({
      ...placeData,
      id: createdPlaceId || undefined,
    }, user || undefined);

    const finalId = createdPlaceId || newPlace.id;
    const finalLat = createdLat || newPlace.lat;
    const finalLng = createdLng || newPlace.lng;

    setSubmitting(false);
    showToast(
      'Gửi đề xuất địa điểm thành công! Quán đang ở trạng thái Chờ duyệt bởi Ban Quản Trị FTU.',
      'success'
    );
    // Tự động chuyển hướng đến đúng vị trí quán vừa tạo trên bản đồ (focus đúng ID + lat/lng)
    router.push(`/?placeId=${finalId}&lat=${finalLat}&lng=${finalLng}`);
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

        {/* Mini Map Coordinate Picker */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-burgundy" /> Ghim vị trí tọa độ trên bản đồ
            </label>
            <span className="text-[11px] text-gray-500">Bấm trực tiếp lên bản đồ để di chuyển ghim</span>
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
            className="w-full px-3.5 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
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
