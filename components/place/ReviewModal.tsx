'use client';

import React, { useState } from 'react';
import { X, Star, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { store } from '@/lib/data/store';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/components/common/Toast';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  placeId: string;
  placeName: string;
  onReviewSuccess: () => void;
}

export function ReviewModal({
  isOpen,
  onClose,
  placeId,
  placeName,
  onReviewSuccess,
}: ReviewModalProps) {
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const [rating, setRating] = useState(5);
  const [wifiRating, setWifiRating] = useState(5);
  const [outletRating, setOutletRating] = useState(5);
  const [quietRating, setQuietRating] = useState(4);
  const [priceRating, setPriceRating] = useState(4);
  const [spaceRating, setSpaceRating] = useState(5);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enforce authentication & active account status
    if (!currentUser) {
      showToast('Vui lòng đăng nhập để viết đánh giá cho địa điểm này!', 'error');
      return;
    }

    if (currentUser.is_locked) {
      showToast('Tài khoản của bạn đã bị khóa bởi Ban Quản Trị.', 'error');
      return;
    }

    if (!content.trim()) {
      showToast('Vui lòng nhập nội dung đánh giá', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Resolve target place_id to UUID if needed
      let targetPlaceId = placeId;
      const matched = store.getPlaceById(placeId);
      if (matched && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matched.id)) {
        targetPlaceId = matched.id;
      }

      const reviewPayload = {
        place_id: targetPlaceId,
        user_id: currentUser.id,
        rating,
        wifi_rating: wifiRating,
        outlet_rating: outletRating,
        quiet_rating: quietRating,
        price_rating: priceRating,
        space_rating: spaceRating,
        content: content.trim(),
        images: imageUrl.trim() ? [imageUrl.trim()] : [],
        is_hidden: false,
      };

      // 1. Submit to API endpoint for direct Supabase persistence
      try {
        const apiRes = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reviewPayload),
        });
        const apiJson = await apiRes.json();
        if (!apiRes.ok && apiJson.error && apiJson.error.includes('đã viết đánh giá')) {
          showToast('Bạn đã viết đánh giá cho địa điểm này rồi.', 'error');
          setIsSubmitting(false);
          return;
        }
      } catch (apiErr) {
        console.warn('API review POST notice:', apiErr);
      }

      // 2. Direct Supabase insert attempt
      try {
        await supabase.from('reviews').insert(reviewPayload);
      } catch (dbErr) {}

      // 3. Sync with local client store
      store.addReview(reviewPayload);
      await store.loadFromSupabase();

      showToast('Đăng đánh giá thành công lên hệ thống!', 'success');
      onReviewSuccess();
      onClose();
    } catch (err: any) {
      console.error('Review submit error:', err);
      // Client store fallback
      const result = store.addReview({
        place_id: placeId,
        user_id: currentUser.id,
        rating,
        wifi_rating: wifiRating,
        outlet_rating: outletRating,
        quiet_rating: quietRating,
        price_rating: priceRating,
        space_rating: spaceRating,
        content: content.trim(),
        images: imageUrl.trim() ? [imageUrl.trim()] : [],
      });

      if (result.success) {
        showToast(result.message, 'success');
        onReviewSuccess();
        onClose();
      } else {
        showToast(result.message, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStarPicker = (val: number, setVal: (n: number) => void) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setVal(star)}
          className="p-0.5 text-gray-300 hover:text-amber-400 transition-colors"
        >
          <Star
            className={`w-4 h-4 ${
              star <= val ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-elevated overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-extrabold text-base text-gray-900">Viết đánh giá</h3>
            <p className="text-xs text-gray-500 truncate max-w-xs">{placeName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Overall Rating */}
          <div className="p-3 bg-burgundy-light rounded-xl border border-burgundy-border flex items-center justify-between">
            <span className="text-xs font-bold text-burgundy">Đánh giá chung:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Sub-ratings */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Wifi mạnh / ổn định:</span>
              {renderStarPicker(wifiRating, setWifiRating)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Ổ cắm điện (nhiều/dễ tìm):</span>
              {renderStarPicker(outletRating, setOutletRating)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Độ yên tĩnh (ít ồn ào):</span>
              {renderStarPicker(quietRating, setQuietRating)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Giá cả hợp lý (sinh viên):</span>
              {renderStarPicker(priceRating, setPriceRating)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Không gian & chỗ ngồi:</span>
              {renderStarPicker(spaceRating, setSpaceRating)}
            </div>
          </div>

          {/* Review Content */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Chia sẻ trải nghiệm của bạn (bàn ghế, ánh sáng, đồ uống...)
            </label>
            <textarea
              required
              rows={4}
              placeholder="Quán có tầng 2 rất yên tĩnh để chạy deadline, bàn rộng và nhiều ổ cắm quanh tường..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy"
            />
          </div>

          {/* Optional Image URL */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Link ảnh minh chứng (tuỳ chọn)
            </label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/photo-..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-gray-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-burgundy hover:bg-burgundy-hover text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang gửi...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Đăng đánh giá</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
