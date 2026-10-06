'use client';

import React, { useState, useEffect } from 'react';
import { store } from '@/lib/data/store';
import { Category, Amenity } from '@/lib/types/database';
import { useToast } from '@/components/common/Toast';
import { 
  Plus, 
  Trash2, 
  Tags, 
  Sparkles,
  Coffee,
  BookOpen,
  CupSoda,
  Wifi,
  Zap,
  Users,
  VolumeX,
  Wind,
  Bike,
  Tag,
  Moon,
  Loader2
} from 'lucide-react';

export default function AdminCategoriesPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);

  // Add inputs & submission states
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [newAmName, setNewAmName] = useState('');
  const [addingAm, setAddingAm] = useState(false);

  const loadData = async () => {
    try {
      const [catRes, amRes] = await Promise.all([
        fetch('/api/categories', { cache: 'no-store' }),
        fetch('/api/amenities', { cache: 'no-store' })
      ]);

      if (catRes.ok) {
        const catJson = await catRes.json();
        if (Array.isArray(catJson.categories)) {
          setCategories(catJson.categories);
        }
      }

      if (amRes.ok) {
        const amJson = await amRes.json();
        if (Array.isArray(amJson.amenities)) {
          setAmenities(amJson.amenities);
        }
      }
    } catch (e) {
      // Fallback to store
      setCategories(store.getCategories());
      setAmenities(store.getAmenities());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = store.subscribe(() => {
      setCategories(store.getCategories());
      setAmenities(store.getAmenities());
    });
    return () => unsub();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || addingCat) return;

    setAddingCat(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim(), icon: 'Coffee' }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Lỗi khi thêm loại địa điểm mới', 'error');
        return;
      }

      setNewCatName('');
      showToast(`Đã thêm loại địa điểm "${data.category.name}" thành công!`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi mạng khi thêm danh mục', 'error');
    } finally {
      setAddingCat(false);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa loại địa điểm "${name}"?`)) return;

    try {
      const res = await fetch(`/api/categories?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Lỗi khi xóa loại địa điểm', 'error');
        return;
      }

      showToast(`Đã xóa loại địa điểm "${name}" thành công`, 'info');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi kết nối khi xóa danh mục', 'error');
    }
  };

  const handleAddAmenity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmName.trim() || addingAm) return;

    setAddingAm(true);
    try {
      const res = await fetch('/api/amenities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAmName.trim(), icon: 'Sparkles' }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Lỗi khi thêm tiện ích mới', 'error');
        return;
      }

      setNewAmName('');
      showToast(`Đã thêm tiện ích "${data.amenity.name}" thành công!`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi mạng khi thêm tiện ích', 'error');
    } finally {
      setAddingAm(false);
    }
  };

  const handleDeleteAmenity = async (id: number, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa tiện ích "${name}"?`)) return;

    try {
      const res = await fetch(`/api/amenities?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Lỗi khi xóa tiện ích', 'error');
        return;
      }

      showToast(`Đã xóa tiện ích "${name}" thành công`, 'info');
      store.deleteAmenity(id);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi kết nối khi xóa tiện ích', 'error');
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-extrabold text-gray-900">Quản lý Danh mục & Tiện ích</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Cấu hình các loại hình địa điểm và tiện ích học tập trong hệ thống STUDYSPOT FTU
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Categories Box */}
        <div className="bg-white p-6 rounded-2xl border border-border shadow-soft space-y-4">
          <div className="flex items-center gap-2">
            <Tags className="w-5 h-5 text-burgundy" />
            <h3 className="font-bold text-base text-gray-900">Loại địa điểm (Categories)</h3>
          </div>

          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              placeholder="Tên loại địa điểm mới..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              disabled={addingCat}
              className="flex-1 px-3 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
            />
            <button
              type="submit"
              disabled={addingCat || !newCatName.trim()}
              className="px-3.5 py-2 rounded-xl bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover disabled:opacity-50 flex items-center gap-1.5"
            >
              {addingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '+ Thêm'}
            </button>
          </form>

          <div className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">Chưa có danh mục nào.</p>
            ) : (
              categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border text-xs hover:border-burgundy/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-burgundy" />
                    <span className="font-semibold text-gray-800">{c.name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">#{c.id}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(c.id, c.name)}
                    className="text-gray-400 hover:text-rose-600 transition-colors p-1"
                    title="Xóa danh mục"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Amenities Box */}
        <div className="bg-white p-6 rounded-2xl border border-border shadow-soft space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-burgundy" />
            <h3 className="font-bold text-base text-gray-900">Tiện ích học tập (Amenities)</h3>
          </div>

          <form onSubmit={handleAddAmenity} className="flex gap-2">
            <input
              type="text"
              placeholder="Tên tiện ích mới..."
              value={newAmName}
              onChange={(e) => setNewAmName(e.target.value)}
              disabled={addingAm}
              className="flex-1 px-3 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
            />
            <button
              type="submit"
              disabled={addingAm || !newAmName.trim()}
              className="px-3.5 py-2 rounded-xl bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover disabled:opacity-50 flex items-center gap-1.5"
            >
              {addingAm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '+ Thêm'}
            </button>
          </form>

          <div className="space-y-2">
            {amenities.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">Chưa có tiện ích nào.</p>
            ) : (
              amenities.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border text-xs hover:border-burgundy/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-gray-800">{a.name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">#{a.id}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteAmenity(a.id, a.name)}
                    className="text-gray-400 hover:text-rose-600 transition-colors p-1"
                    title="Xóa tiện ích"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
