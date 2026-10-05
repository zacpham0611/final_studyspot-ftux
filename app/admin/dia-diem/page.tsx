'use client';

import React, { useState, useEffect, useRef } from 'react';
import { store } from '@/lib/data/store';
import { Place, Category, OpeningHours } from '@/lib/types/database';
import { WEEK_DAYS, ALL_DAY_KEYS, getOpenDaysFromHours } from '@/lib/utils/hours';
import { PRICE_RANGE_OPTIONS, calculatePriceLevel, getPriceRangesFromPlace } from '@/lib/utils/price';
import { useToast } from '@/components/common/Toast';
import { 
  MapPin, 
  Search, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  ExternalLink,
  Image as ImageIcon,
  Upload,
  Star,
  X,
  Check,
  Edit3
} from 'lucide-react';
import Link from 'next/link';

export default function AdminPlacesPage() {
  const { showToast } = useToast();
  const [places, setPlaces] = useState<Place[]>([]);
  const [categories, setCategories] = useState<Category[]>(() => store.getCategories());
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');

  // Modal State for Edit Place
  const [editModalPlace, setEditModalPlace] = useState<Place | null>(null);
  const [editName, setEditName] = useState('');
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editAddress, setEditAddress] = useState('');
  const [editLat, setEditLat] = useState(21.0245);
  const [editLng, setEditLng] = useState(105.8046);
  const [editDescription, setEditDescription] = useState('');
  const [editIs24h, setEditIs24h] = useState(false);
  const [editOpenDays, setEditOpenDays] = useState<string[]>([...ALL_DAY_KEYS]);
  const [editOpenTime, setEditOpenTime] = useState('07:30');
  const [editCloseTime, setEditCloseTime] = useState('22:30');
  const [editPriceRanges, setEditPriceRanges] = useState<string[]>(['30.000đ – 50.000đ']);

  // Modal State for Image Controls
  const [imageModalPlace, setImageModalPlace] = useState<Place | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State for Add New Place
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCatId, setNewCatId] = useState<number | null>(null);
  const [newAddress, setNewAddress] = useState('');
  const [newLat, setNewLat] = useState(21.0245);
  const [newLng, setNewLng] = useState(105.8046);
  const [newDescription, setNewDescription] = useState('');
  const [newInitialImage, setNewInitialImage] = useState('');
  const [newIs24h, setNewIs24h] = useState(false);
  const [newOpenDays, setNewOpenDays] = useState<string[]>([...ALL_DAY_KEYS]);
  const [newOpenTime, setNewOpenTime] = useState('07:30');
  const [newCloseTime, setNewCloseTime] = useState('22:30');
  const [newPriceRanges, setNewPriceRanges] = useState<string[]>(['30.000đ – 50.000đ']);

  const loadData = () => {
    setPlaces(store.getAllPlacesAdmin());
    const cats = store.getCategories();
    if (cats && cats.length > 0) {
      setCategories(cats);
      setNewCatId((prev) => (prev && cats.some((c) => Number(c.id) === Number(prev))) ? prev : Number(cats[0].id));
    }
  };

  useEffect(() => {
    loadData();
    fetch('/api/categories', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
          setNewCatId((prev) => (prev && data.categories.some((c: Category) => Number(c.id) === Number(prev))) ? prev : Number(data.categories[0].id));
        }
      })
      .catch(() => {});
    store.loadFromSupabase().then(loadData);
    const unsub = store.subscribe(loadData);
    return () => unsub();
  }, []);

  const handleToggleHide = async (place: Place) => {
    const nextStatus = place.status === 'hidden' ? 'approved' : 'hidden';
    store.updatePlaceStatus(place.id, nextStatus);
    loadData();
    showToast(
      `Đã chuyển trạng thái sang: ${nextStatus === 'hidden' ? 'Đang ẩn' : 'Đã duyệt / Hiển thị'}`,
      'info'
    );
    try {
      await fetch('/api/places', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: place.id, status: nextStatus }),
      });
    } catch (e) {}
  };

  const handleDelete = async (placeId: string, placeName: string) => {
    if (confirm(`Bạn có chắc muốn xóa vĩnh viễn địa điểm "${placeName}"?`)) {
      store.deletePlace(placeId);
      loadData();
      showToast('Đã xóa địa điểm thành công', 'success');
      try {
        await fetch(`/api/places?id=${placeId}`, { method: 'DELETE' });
      } catch (e) {}
    }
  };

  const openEditModal = (place: Place) => {
    setEditModalPlace(place);
    setEditName(place.name);
    const activeCategories = categories.length > 0 ? categories : store.getCategories();
    const foundCat = activeCategories.find((c) => Number(c.id) === Number(place.category_id));
    setEditCatId(foundCat ? Number(foundCat.id) : (Number(activeCategories[0]?.id) || 1));
    setEditAddress(place.address);
    setEditLat(place.lat);
    setEditLng(place.lng);
    setEditDescription(place.description || '');

    const is24h = Boolean(place.opening_hours?.is_24h);
    setEditIs24h(is24h);
    const days = getOpenDaysFromHours(place.opening_hours);
    setEditOpenDays(days);
    const day = place.opening_hours?.monday || place.opening_hours?.tuesday || place.opening_hours?.sunday;
    setEditOpenTime(day?.open && day.open !== '00:00' ? day.open : '07:30');
    setEditCloseTime(day?.close && day.close !== '23:59' ? day.close : '22:30');
    const ranges = getPriceRangesFromPlace(place);
    setEditPriceRanges(ranges);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalPlace || !editName.trim() || !editAddress.trim()) {
      showToast('Vui lòng nhập đầy đủ tên và địa chỉ', 'error');
      return;
    }

    const activeCategories = categories.length > 0 ? categories : store.getCategories();
    const selectedCat = activeCategories.find((c) => Number(c.id) === Number(editCatId));
    if (!selectedCat) {
      showToast('Vui lòng chọn loại hình địa điểm (danh mục) hợp lệ', 'error');
      return;
    }
    const targetCatId = Number(selectedCat.id);
    const targetCatName = selectedCat.name;

    const calculatedPriceLevel = calculatePriceLevel(editPriceRanges);

    const openingHours: OpeningHours = {
      is_24h: editIs24h,
      open_days: editOpenDays,
      price_ranges: editPriceRanges,
      monday: { open: editIs24h ? '00:00' : editOpenTime, close: editIs24h ? '23:59' : editCloseTime, is_closed: !editOpenDays.includes('monday') },
      tuesday: { open: editIs24h ? '00:00' : editOpenTime, close: editIs24h ? '23:59' : editCloseTime, is_closed: !editOpenDays.includes('tuesday') },
      wednesday: { open: editIs24h ? '00:00' : editOpenTime, close: editIs24h ? '23:59' : editCloseTime, is_closed: !editOpenDays.includes('wednesday') },
      thursday: { open: editIs24h ? '00:00' : editOpenTime, close: editIs24h ? '23:59' : editCloseTime, is_closed: !editOpenDays.includes('thursday') },
      friday: { open: editIs24h ? '00:00' : editOpenTime, close: editIs24h ? '23:59' : editCloseTime, is_closed: !editOpenDays.includes('friday') },
      saturday: { open: editIs24h ? '00:00' : editOpenTime, close: editIs24h ? '23:59' : editCloseTime, is_closed: !editOpenDays.includes('saturday') },
      sunday: { open: editIs24h ? '00:00' : editOpenTime, close: editIs24h ? '23:59' : editCloseTime, is_closed: !editOpenDays.includes('sunday') },
    };

    const editPayload: any = {
      name: editName.trim(),
      category_id: targetCatId,
      category_name: targetCatName,
      address: editAddress.trim(),
      lat: editLat,
      lng: editLng,
      price_level: calculatedPriceLevel,
      price_ranges: editPriceRanges,
      description: editDescription.trim(),
      opening_hours: openingHours,
    };

    store.updatePlace(editModalPlace.id, editPayload);
    const targetId = editModalPlace.id;
    loadData();
    setEditModalPlace(null);
    showToast(`Đã lưu thay đổi cho địa điểm "${editName}"!`, 'success');

    try {
      await fetch('/api/places', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: targetId, ...editPayload }),
      });
    } catch (e) {}
  };

  // Image Control: Client side compression + add image
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imageModalPlace) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress using HTML Canvas
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = Math.min(img.width, MAX_WIDTH);
        canvas.height = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

        // Add to place images
        store.addImageToPlace(imageModalPlace.id, compressedBase64);
        loadData();
        const updated = store.getPlaceById(imageModalPlace.id);
        setImageModalPlace(updated || null);
        setUploading(false);
        showToast('Tải ảnh và nén ảnh thành công!', 'success');

        if (updated) {
          fetch('/api/places', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placeId: imageModalPlace.id, images: updated.images }),
          }).catch(() => {});
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddImageUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageUrl.trim() || !imageModalPlace) return;

    store.addImageToPlace(imageModalPlace.id, newImageUrl.trim());
    setNewImageUrl('');
    loadData();
    const updated = store.getPlaceById(imageModalPlace.id);
    setImageModalPlace(updated || null);
    showToast('Đã thêm ảnh vào danh sách', 'success');

    if (updated) {
      fetch('/api/places', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: imageModalPlace.id, images: updated.images }),
      }).catch(() => {});
    }
  };

  const handleSetFeatured = (index: number) => {
    if (!imageModalPlace) return;
    store.setPlaceFeaturedImage(imageModalPlace.id, index);
    loadData();
    const updated = store.getPlaceById(imageModalPlace.id);
    setImageModalPlace(updated || null);
    showToast('Đã đặt làm ảnh đại diện chính!', 'success');

    if (updated) {
      fetch('/api/places', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: imageModalPlace.id, images: updated.images }),
      }).catch(() => {});
    }
  };

  const handleRemoveImage = (index: number) => {
    if (!imageModalPlace) return;
    if (confirm('Bạn có chắc muốn xóa ảnh này?')) {
      store.removePlaceImage(imageModalPlace.id, index);
      loadData();
      const updated = store.getPlaceById(imageModalPlace.id);
      setImageModalPlace(updated || null);
      showToast('Đã xóa ảnh khỏi địa điểm', 'info');

      if (updated) {
        fetch('/api/places', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeId: imageModalPlace.id, images: updated.images }),
        }).catch(() => {});
      }
    }
  };

  const handleToggleNewDay = (dayKey: string) => {
    if (newIs24h) return;
    setNewOpenDays((prev) => {
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

  const handleToggleNewPriceRange = (val: string) => {
    setNewPriceRanges((prev) => {
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

  const handleToggleEditDay = (dayKey: string) => {
    if (editIs24h) return;
    setEditOpenDays((prev) => {
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

  const handleToggleEditPriceRange = (val: string) => {
    setEditPriceRanges((prev) => {
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

  // Create new place directly (approved)
  const handleCreatePlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newAddress.trim()) {
      showToast('Vui lòng điền tên và địa chỉ', 'error');
      return;
    }

    const activeCategories = categories.length > 0 ? categories : store.getCategories();
    const selectedCat = activeCategories.find((c) => Number(c.id) === Number(newCatId));
    if (!selectedCat) {
      showToast('Vui lòng chọn loại hình địa điểm (danh mục) hợp lệ', 'error');
      return;
    }
    const targetCatId = Number(selectedCat.id);
    const targetCatName = selectedCat.name;

    const calculatedPriceLevel = calculatePriceLevel(newPriceRanges);

    const openingHours: OpeningHours = {
      is_24h: newIs24h,
      open_days: newOpenDays,
      price_ranges: newPriceRanges,
      monday: { open: newIs24h ? '00:00' : newOpenTime, close: newIs24h ? '23:59' : newCloseTime, is_closed: !newOpenDays.includes('monday') },
      tuesday: { open: newIs24h ? '00:00' : newOpenTime, close: newIs24h ? '23:59' : newCloseTime, is_closed: !newOpenDays.includes('tuesday') },
      wednesday: { open: newIs24h ? '00:00' : newOpenTime, close: newIs24h ? '23:59' : newCloseTime, is_closed: !newOpenDays.includes('wednesday') },
      thursday: { open: newIs24h ? '00:00' : newOpenTime, close: newIs24h ? '23:59' : newCloseTime, is_closed: !newOpenDays.includes('thursday') },
      friday: { open: newIs24h ? '00:00' : newOpenTime, close: newIs24h ? '23:59' : newCloseTime, is_closed: !newOpenDays.includes('friday') },
      saturday: { open: newIs24h ? '00:00' : newOpenTime, close: newIs24h ? '23:59' : newCloseTime, is_closed: !newOpenDays.includes('saturday') },
      sunday: { open: newIs24h ? '00:00' : newOpenTime, close: newIs24h ? '23:59' : newCloseTime, is_closed: !newOpenDays.includes('sunday') },
    };

    const payload = {
      name: newName.trim(),
      category_id: targetCatId,
      category_name: targetCatName,
      address: newAddress.trim(),
      lat: Number(newLat),
      lng: Number(newLng),
      price_level: calculatedPriceLevel,
      price_ranges: newPriceRanges,
      description: newDescription.trim(),
      images: newInitialImage.trim() ? [newInitialImage.trim()] : [],
      opening_hours: openingHours,
      status: 'approved',
      created_by: store.getCurrentUser()?.id,
    };

    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      if (!res.ok || !data.success || !data.place?.id) {
        showToast(data.error || 'Lỗi khi tạo địa điểm vào Supabase', 'error');
        return;
      }

      // Successfully created with real UUID from Supabase
      const createdPlace: Place = {
        ...data.place,
        status: 'approved',
        approved_at: data.place.approved_at || new Date().toISOString(),
      };
      store.savePlace(createdPlace);
      await store.loadFromSupabase();
      loadData();

      setIsAddPlaceOpen(false);
      setNewName('');
      setNewAddress('');
      setNewDescription('');
      setNewInitialImage('');
      setNewIs24h(false);
      setNewOpenDays([...ALL_DAY_KEYS]);
      setNewOpenTime('07:30');
      setNewCloseTime('22:30');
      setNewPriceRanges(['30.000đ – 50.000đ']);
      showToast(`Đã tạo địa điểm "${payload.name}" thành công với trạng thái Hoạt động!`, 'success');
    } catch (err: any) {
      console.error('Create place error:', err);
      showToast('Lỗi kết nối khi tạo địa điểm: ' + err.message, 'error');
    }
  };

  const filtered = places.filter((p) => {
    if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.address.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Quản lý Địa điểm & Ảnh</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Quản trị thông tin quán, kiểm soát thư viện ảnh và trạng thái hiển thị
          </p>
        </div>
        <button
          onClick={() => {
            const cats = categories.length > 0 ? categories : store.getCategories();
            if (cats.length > 0 && !cats.some((c) => Number(c.id) === Number(newCatId))) {
              setNewCatId(Number(cats[0].id));
            }
            setIsAddPlaceOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover shadow-sm"
        >
          <Plus className="w-4 h-4" /> + Thêm địa điểm mới
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc địa chỉ quán..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="px-3 py-2 rounded-xl border border-border text-xs font-medium bg-white focus:outline-none focus:border-burgundy"
        >
          <option value="all">Tất cả loại hình</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Places Table */}
      <div className="bg-white rounded-2xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-slate-50 border-b border-border text-gray-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Ảnh & Tên quán</th>
                <th className="py-3 px-4">Loại hình</th>
                <th className="py-3 px-4">Đánh giá</th>
                <th className="py-3 px-4">Số ảnh</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Quản lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((place) => (
                <tr key={place.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-gray-900">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={place.images[0] || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=100&q=80'}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover ring-1 ring-border"
                      />
                      <div className="truncate max-w-[200px]">
                        <div className="truncate">{place.name}</div>
                        <div className="text-[10px] text-gray-400 font-normal truncate">{place.address}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{place.category?.name || 'Quán Cà Phê'}</td>
                  <td className="py-3 px-4 whitespace-nowrap font-bold text-amber-500">
                    ⭐ {place.average_rating || 4.8} ({place.review_count || 0})
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <button
                      onClick={() => setImageModalPlace(place)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-gray-700 font-semibold text-[11px] flex items-center gap-1"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-burgundy" />
                      <span>{place.images.length} ảnh</span>
                    </button>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleHide(place)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          place.status === 'approved' ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                        title={place.status === 'approved' ? 'Bật hiển thị (Bấm để ẩn)' : 'Đang ẩn (Bấm để hiển thị)'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            place.status === 'approved' ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span
                        className={`text-[10px] font-bold ${
                          place.status === 'approved' ? 'text-emerald-700' : 'text-gray-500'
                        }`}
                      >
                        {place.status === 'approved' ? 'Hiển thị' : 'Đang ẩn'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      onClick={() => openEditModal(place)}
                      className="p-1.5 text-gray-600 hover:text-burgundy hover:bg-burgundy-light/40 rounded-lg inline-block transition-colors"
                      title="Sửa thông tin địa điểm"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setImageModalPlace(place)}
                      className="p-1.5 text-gray-600 hover:text-burgundy hover:bg-burgundy-light/40 rounded-lg inline-block transition-colors"
                      title="Quản lý thư viện ảnh"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/dia-diem/${place.id}`}
                      target="_blank"
                      className="p-1.5 text-gray-600 hover:text-burgundy hover:bg-burgundy-light/40 rounded-lg inline-block transition-colors"
                      title="Xem trang quán"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(place.id, place.name)}
                      className="p-1.5 text-gray-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg inline-block transition-colors"
                      title="Xóa vĩnh viễn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL IMAGE CONTROLS MODAL */}
      {imageModalPlace && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-elevated border border-border p-6 max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border flex-shrink-0">
              <div>
                <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-burgundy" /> Quản lý thư viện ảnh quán
                </h3>
                <p className="text-xs text-gray-500">{imageModalPlace.name}</p>
              </div>
              <button onClick={() => setImageModalPlace(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Upload & Add URL Toolbar */}
            <div className="p-3 bg-slate-50 rounded-xl border border-border flex flex-col sm:flex-row gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3.5 py-2 rounded-xl bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Đang nén & tải...' : 'Tải ảnh từ máy tính (Tự nén)'}
              </button>

              <form onSubmit={handleAddImageUrl} className="flex-1 flex gap-1.5">
                <input
                  type="url"
                  placeholder="Hoặc dán URL ảnh trực tiếp..."
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-border focus:outline-none focus:border-burgundy"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-gray-700 text-xs font-bold"
                >
                  + Thêm URL
                </button>
              </form>
            </div>

            {/* Images Grid */}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {imageModalPlace.images.map((img, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-border bg-slate-100 h-36">
                    <img src={img} alt="" className="w-full h-full object-cover" />

                    {/* Featured Badge */}
                    {idx === 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-burgundy text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                        Ảnh đại diện chính
                      </div>
                    )}

                    {/* Hover Actions Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2 text-white">
                      {idx !== 0 && (
                        <button
                          onClick={() => handleSetFeatured(idx)}
                          className="px-2.5 py-1 bg-white text-gray-900 rounded-lg text-[10px] font-bold hover:bg-burgundy hover:text-white transition-colors"
                        >
                          ⭐ Đặt làm ảnh đại diện
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveImage(idx)}
                        className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs"
                        title="Xóa ảnh này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border flex justify-end flex-shrink-0">
              <button
                onClick={() => setImageModalPlace(null)}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADD NEW PLACE DIRECTLY */}
      {isAddPlaceOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-elevated border border-border p-6 max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-gray-900">+ Thêm địa điểm mới trực tiếp</h3>
              <button onClick={() => setIsAddPlaceOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlace} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Tên địa điểm *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Cà Phê Mùa Thu Chùa Láng"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Loại hình</label>
                <select
                  value={newCatId ?? ''}
                  onChange={(e) => setNewCatId(e.target.value ? Number(e.target.value) : null)}
                  required
                  className="w-full p-2.5 rounded-xl border border-border text-xs bg-white focus:outline-none focus:border-burgundy"
                >
                  {categories.length === 0 ? (
                    <option value="">Đang tải danh mục...</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Price Range Multi-select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">
                  Mức giá <span className="text-gray-400 font-normal">(có thể chọn nhiều khoảng giá)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRICE_RANGE_OPTIONS.map((opt) => {
                    const checked = newPriceRanges.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleToggleNewPriceRange(opt.value)}
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

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Địa chỉ chính xác *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: 45 Phố Chùa Láng, Đống Đa, Hà Nội"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Vĩ độ (Lat)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newLat}
                    onChange={(e) => setNewLat(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Kinh độ (Lng)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newLng}
                    onChange={(e) => setNewLng(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy font-mono"
                  />
                </div>
              </div>

              <div className="space-y-3 p-3 bg-slate-50 border border-border rounded-xl">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="admin-add-is-24h"
                    checked={newIs24h}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setNewIs24h(checked);
                      if (checked) {
                        setNewOpenDays([...ALL_DAY_KEYS]);
                      }
                    }}
                    className="w-4 h-4 text-burgundy rounded border-gray-300 focus:ring-burgundy cursor-pointer"
                  />
                  <label htmlFor="admin-add-is-24h" className="text-xs font-bold text-gray-700 cursor-pointer select-none">
                    Mở cửa 24/7 (Phục vụ cả ngày & đêm)
                  </label>
                </div>

                {/* Opening days pills */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-600 block">
                    Mở cửa vào:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEK_DAYS.map((d) => {
                      const isSelected = newOpenDays.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          disabled={newIs24h}
                          onClick={() => handleToggleNewDay(d.key)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                            isSelected
                              ? 'border-burgundy bg-burgundy-light text-burgundy shadow-xs'
                              : 'border-border text-gray-600 hover:bg-white'
                          } ${newIs24h ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Giờ mở cửa</label>
                    <input
                      type="time"
                      disabled={newIs24h}
                      value={newIs24h ? '00:00' : newOpenTime}
                      onChange={(e) => setNewOpenTime(e.target.value)}
                      className={`w-full p-2 rounded-lg border border-border text-xs focus:outline-none focus:border-burgundy ${
                        newIs24h ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Giờ đóng cửa</label>
                    <input
                      type="time"
                      disabled={newIs24h}
                      value={newIs24h ? '23:59' : newCloseTime}
                      onChange={(e) => setNewCloseTime(e.target.value)}
                      className={`w-full p-2 rounded-lg border border-border text-xs focus:outline-none focus:border-burgundy ${
                        newIs24h ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Mô tả không gian</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả số tầng, wifi, ổ điện..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Link ảnh đại diện (URL)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newInitialImage}
                  onChange={(e) => setNewInitialImage(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPlaceOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-gray-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover"
                >
                  Xuất bản ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PLACE MODAL */}
      {editModalPlace && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-elevated border border-border p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-burgundy-light text-burgundy flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">Sửa thông tin địa điểm</h3>
                  <p className="text-[11px] text-gray-400">ID: {editModalPlace.id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalPlace(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Tên địa điểm *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Loại hình</label>
                <select
                  value={editCatId ?? ''}
                  onChange={(e) => setEditCatId(e.target.value ? Number(e.target.value) : null)}
                  required
                  className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy bg-white"
                >
                  {categories.length === 0 ? (
                    <option value="">Đang tải danh mục...</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Price Range Multi-select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">
                  Mức giá <span className="text-gray-400 font-normal">(có thể chọn nhiều khoảng giá)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRICE_RANGE_OPTIONS.map((opt) => {
                    const checked = editPriceRanges.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleToggleEditPriceRange(opt.value)}
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

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Địa chỉ chi tiết *</label>
                <input
                  type="text"
                  required
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Vĩ độ (Lat)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editLat}
                    onChange={(e) => setEditLat(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Kinh độ (Lng)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editLng}
                    onChange={(e) => setEditLng(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 p-3 bg-slate-50 border border-border rounded-xl">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="admin-edit-is-24h"
                    checked={editIs24h}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditIs24h(checked);
                      if (checked) {
                        setEditOpenDays([...ALL_DAY_KEYS]);
                      }
                    }}
                    className="w-4 h-4 text-burgundy rounded border-gray-300 focus:ring-burgundy cursor-pointer"
                  />
                  <label htmlFor="admin-edit-is-24h" className="text-xs font-bold text-gray-700 cursor-pointer select-none">
                    Mở cửa 24/7 (Phục vụ cả ngày & đêm)
                  </label>
                </div>

                {/* Opening days pills */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-600 block">
                    Mở cửa vào:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEK_DAYS.map((d) => {
                      const isSelected = editOpenDays.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          disabled={editIs24h}
                          onClick={() => handleToggleEditDay(d.key)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                            isSelected
                              ? 'border-burgundy bg-burgundy-light text-burgundy shadow-xs'
                              : 'border-border text-gray-600 hover:bg-white'
                          } ${editIs24h ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Giờ mở cửa</label>
                    <input
                      type="time"
                      disabled={editIs24h}
                      value={editIs24h ? '00:00' : editOpenTime}
                      onChange={(e) => setEditOpenTime(e.target.value)}
                      className={`w-full p-2 rounded-lg border border-border text-xs focus:outline-none focus:border-burgundy ${
                        editIs24h ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Giờ đóng cửa</label>
                    <input
                      type="time"
                      disabled={editIs24h}
                      value={editIs24h ? '23:59' : editCloseTime}
                      onChange={(e) => setEditCloseTime(e.target.value)}
                      className={`w-full p-2 rounded-lg border border-border text-xs focus:outline-none focus:border-burgundy ${
                        editIs24h ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Mô tả không gian & Tiện ích</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditModalPlace(null)}
                  className="px-4 py-2 rounded-xl text-xs text-gray-600 hover:bg-slate-100 font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover shadow-sm"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
