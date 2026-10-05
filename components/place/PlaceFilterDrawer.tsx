'use client';

import React from 'react';
import { PlaceFilterOptions, Category, Amenity, CrowdStatus } from '@/lib/types/database';
import { X, SlidersHorizontal, RotateCcw, Check } from 'lucide-react';
import { PRICE_RANGE_OPTIONS } from '@/lib/utils/price';

interface PlaceFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  amenities: Amenity[];
  filterOptions: PlaceFilterOptions;
  onChangeFilter: (options: PlaceFilterOptions) => void;
}

export function PlaceFilterDrawer({
  isOpen,
  onClose,
  categories,
  amenities,
  filterOptions,
  onChangeFilter,
}: PlaceFilterDrawerProps) {
  if (!isOpen) return null;

  const handleCategoryChange = (catId: number | 'all') => {
    onChangeFilter({ ...filterOptions, categoryId: catId });
  };

  const handleAmenityToggle = (amId: number) => {
    const current = filterOptions.amenityIds || [];
    const next = current.includes(amId)
      ? current.filter((id) => id !== amId)
      : [...current, amId];
    onChangeFilter({ ...filterOptions, amenityIds: next });
  };

  const handleCrowdToggle = (status: CrowdStatus) => {
    const current = filterOptions.crowdStatus || [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onChangeFilter({ ...filterOptions, crowdStatus: next });
  };

  const handlePriceToggle = (price: number) => {
    const current = filterOptions.priceLevels || [];
    const next = current.includes(price)
      ? current.filter((p) => p !== price)
      : [...current, price];
    onChangeFilter({ ...filterOptions, priceLevels: next });
  };

  const handlePriceRangeToggle = (val: string) => {
    const current = filterOptions.priceRanges || [];
    const next = current.includes(val)
      ? current.filter((p) => p !== val)
      : [...current, val];
    onChangeFilter({ ...filterOptions, priceRanges: next });
  };

  const handleReset = () => {
    onChangeFilter({
      query: '',
      categoryId: 'all',
      amenityIds: [],
      priceLevels: [],
      priceRanges: [],
      openNow: false,
      openLate: false,
      crowdStatus: [],
      sortBy: 'distance',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-burgundy" />
            <h3 className="font-bold text-base text-text-primary">Bộ lọc nâng cao</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Categories */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2.5">
              Loại địa điểm
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCategoryChange('all')}
                className={`text-xs py-2 px-3 rounded-xl border text-left font-medium transition-colors ${
                  !filterOptions.categoryId || filterOptions.categoryId === 'all'
                    ? 'border-burgundy bg-burgundy-light text-burgundy font-bold'
                    : 'border-border text-gray-700 hover:bg-slate-50'
                }`}
              >
                Tất cả loại hình
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`text-xs py-2 px-3 rounded-xl border text-left font-medium transition-colors ${
                    filterOptions.categoryId === cat.id
                      ? 'border-burgundy bg-burgundy-light text-burgundy font-bold'
                      : 'border-border text-gray-700 hover:bg-slate-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Crowd Status */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2.5">
              Độ đông thời gian thực
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { status: 'empty' as CrowdStatus, label: '🟢 Vắng', desc: '< 1.67' },
                { status: 'medium' as CrowdStatus, label: '🟡 Vừa', desc: '1.67 - 2.33' },
                { status: 'full' as CrowdStatus, label: '🔴 Đông', desc: '> 2.33' },
              ].map((item) => {
                const isChecked = filterOptions.crowdStatus?.includes(item.status);
                return (
                  <button
                    key={item.status}
                    type="button"
                    onClick={() => handleCrowdToggle(item.status)}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                      isChecked
                        ? 'border-burgundy bg-burgundy-light font-bold text-burgundy'
                        : 'border-border hover:bg-slate-50 text-gray-700'
                    }`}
                  >
                    <div className="text-xs font-semibold">{item.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time & Operation */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2.5">
              Thời gian mở cửa
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 p-2 rounded-xl border border-border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={filterOptions.openNow || false}
                  onChange={(e) =>
                    onChangeFilter({ ...filterOptions, openNow: e.target.checked })
                  }
                  className="rounded text-burgundy focus:ring-burgundy w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-800">Đang mở cửa bây giờ</span>
              </label>
              <label className="flex items-center gap-2.5 p-2 rounded-xl border border-border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={filterOptions.openLate || false}
                  onChange={(e) =>
                    onChangeFilter({ ...filterOptions, openLate: e.target.checked })
                  }
                  className="rounded text-burgundy focus:ring-burgundy w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-800">
                  Mở muộn (Đóng từ 22:00 / Mở 24h)
                </span>
              </label>
            </div>
          </div>

          {/* Amenities */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2.5">
              Tiện ích học tập
            </label>
            <div className="grid grid-cols-2 gap-2">
              {amenities.map((am) => {
                const isChecked = filterOptions.amenityIds?.includes(am.id);
                return (
                  <button
                    key={am.id}
                    type="button"
                    onClick={() => handleAmenityToggle(am.id)}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs font-medium transition-colors ${
                      isChecked
                        ? 'border-burgundy bg-burgundy-light text-burgundy font-bold'
                        : 'border-border text-gray-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{am.name}</span>
                    {isChecked && <Check className="w-3.5 h-3.5 text-burgundy flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Ranges */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2.5">
              Khoảng giá
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRICE_RANGE_OPTIONS.map((opt) => {
                const isChecked = filterOptions.priceRanges?.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePriceRangeToggle(opt.value)}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      isChecked
                        ? 'border-burgundy bg-burgundy-light text-burgundy font-bold shadow-xs'
                        : 'border-border text-gray-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    {opt.subLabel && <div className="text-[10px] text-gray-500">{opt.subLabel}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-slate-50 flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-700 hover:bg-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Đặt lại
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-burgundy text-white font-semibold text-sm hover:bg-burgundy-hover transition-colors shadow-sm"
          >
            Áp dụng bộ lọc
          </button>
        </div>
      </div>
    </div>
  );
}
