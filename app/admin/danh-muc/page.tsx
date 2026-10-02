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
  Moon
} from 'lucide-react';

export default function AdminCategoriesPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);

  // Add inputs
  const [newCatName, setNewCatName] = useState('');
  const [newAmName, setNewAmName] = useState('');

  const loadData = () => {
    setCategories(store.getCategories());
    setAmenities(store.getAmenities());
  };

  useEffect(() => {
    loadData();
    store.loadFromSupabase().then(loadData);
    const unsub = store.subscribe(loadData);
    return () => unsub();
  }, []);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    store.saveCategory({ id: Date.now(), name: newCatName.trim(), icon: 'Coffee' });
    setNewCatName('');
    loadData();
    showToast('Đã thêm loại địa điểm mới', 'success');
  };

  const handleDeleteCategory = (id: number) => {
    store.deleteCategory(id);
    loadData();
    showToast('Đã xóa loại địa điểm', 'info');
  };

  const handleAddAmenity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmName.trim()) return;
    store.saveAmenity({ id: Date.now(), name: newAmName.trim(), icon: 'Sparkles' });
    setNewAmName('');
    loadData();
    showToast('Đã thêm tiện ích mới', 'success');
  };

  const handleDeleteAmenity = (id: number) => {
    store.deleteAmenity(id);
    loadData();
    showToast('Đã xóa tiện ích', 'info');
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
              className="flex-1 px-3 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover"
            >
              + Thêm
            </button>
          </form>

          <div className="space-y-2">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-xl border border-border text-xs"
              >
                <div className="flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-burgundy" />
                  <span className="font-semibold text-gray-800">{c.name}</span>
                </div>
                <button
                  onClick={() => handleDeleteCategory(c.id)}
                  className="text-gray-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
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
              className="flex-1 px-3 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover"
            >
              + Thêm
            </button>
          </form>

          <div className="space-y-2">
            {amenities.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 rounded-xl border border-border text-xs"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-gray-800">{a.name}</span>
                </div>
                <button
                  onClick={() => handleDeleteAmenity(a.id)}
                  className="text-gray-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
