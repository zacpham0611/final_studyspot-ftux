'use client';

import React, { useState } from 'react';
import { X, Star, Sparkles } from 'lucide-react';
import { store } from '@/lib/data/store';
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      showToast('Vui lòng nhập nội dung đánh giá', 'error');
      return;
    }

    setIsSubmitting(true);
    const result = store.addReview({
      place_id: placeId,
      user_id: store.getCurrentUser()?.id || 'guest',
      rating,
      wifi_rating: wifiRating,
      outlet_rating: outletRating,
      quiet_rating: quietRating,
      price_rating: priceRating,
      space_rating: spaceRating,
      content: content.trim(),
      images: imageUrl ? [imageUrl] : [],
    });
    setIsSubmitting(false);

    if (result.success) {
      showToast(result.message, 'success');
      onReviewSuccess();
      onClose();
    } else {
      showToast(result.message, 'error');
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
      <span className="text-xs font-bold text-gray-700 ml-1.5">{val}/5</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-elevated border border-border p-6 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-border flex-shrink-0">
          <div>
            <h3 className="font-bold text-base text-gray-900">Viết đánh giá địa điểm</h3>
            <p className="text-xs text-gray-500 truncate max-w-[280px]">{placeName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Main Overall Rating */}
          <div className="bg-burgundy-light/30 p-4 rounded-xl text-center border border-burgundy-border/50">
            <label className="text-xs font-bold text-burgundy block mb-1.5 uppercase tracking-wide">
              Đánh giá tổng quan
            </label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 text-gray-300 hover:text-amber-400 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-bold text-gray-700 mt-1 inline-block">
              {rating === 5 ? 'Tuyệt vời, cực kỳ hợp học tập!' : rating === 4 ? 'Rất tốt' : rating === 3 ? 'Bình thường' : 'Chưa phù hợp lắm'}
            </span>
          </div>

          {/* 5 Detailed Criteria */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-2">
              Chấm điểm theo 5 tiêu chí học tập:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-700 font-medium">Wifi:</span>
                {renderStarPicker(wifiRating, setWifiRating)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-700 font-medium">Ổ điện:</span>
                {renderStarPicker(outletRating, setOutletRating)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-700 font-medium">Yên tĩnh:</span>
                {renderStarPicker(quietRating, setQuietRating)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-700 font-medium">Giá cả:</span>
                {renderStarPicker(priceRating, setPriceRating)}
              </div>
              <div className="flex items-center justify-between sm:col-span-2">
                <span className="text-xs text-gray-700 font-medium">Không gian / Ghế ngồi:</span>
                {renderStarPicker(spaceRating, setSpaceRating)}
              </div>
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">
              Nội dung đánh giá chi tiết
            </label>
            <textarea
              required
              rows={4}
              placeholder="Chia sẻ trải nghiệm của bạn về không gian, máy lạnh, âm lượng nhạc, độ nhiệt tình của nhân viên..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy"
            />
          </div>

          {/* Optional Image */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">
              Link ảnh minh họa (tùy chọn)
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-700 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-burgundy hover:bg-burgundy-hover text-white text-sm font-semibold transition-colors shadow-sm"
            >
              {isSubmitting ? 'Đang gửi...' : 'Đăng đánh giá'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
