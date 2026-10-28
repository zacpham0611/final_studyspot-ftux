'use client';

import React, { useState } from 'react';
import { Review } from '@/lib/types/database';
import { Star, ThumbsUp, Flag, Edit2, Trash2, Loader2 } from 'lucide-react';

interface ReviewItemProps {
  review: Review;
  currentUserId?: string;
  isAdmin?: boolean;
  onToggleHelpful: (reviewId: string) => void;
  onReport: (review: Review) => void;
  onDelete: (reviewId: string) => void;
  onSaveEdit: (reviewId: string, content: string, rating: number) => Promise<void>;
}

export function ReviewItem({
  review: rev,
  currentUserId,
  isAdmin = false,
  onToggleHelpful,
  onReport,
  onDelete,
  onSaveEdit,
}: ReviewItemProps) {
  const isOwnReview = currentUserId === rev.user_id || isAdmin;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(rev.content);
  const [editRating, setEditRating] = useState(rev.rating);
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = () => {
    setEditContent(rev.content);
    setEditRating(rev.rating);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(rev.content);
    setEditRating(rev.rating);
    setIsEditing(false);
  };

  const handleSubmitEdit = async () => {
    if (!editContent.trim()) return;
    setIsSaving(true);
    try {
      await onSaveEdit(rev.id, editContent.trim(), editRating);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      key={rev.id}
      className="p-4 rounded-xl border border-border bg-white space-y-2 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src={
              rev.user?.avatar_url ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
            }
            alt={rev.user?.full_name || 'User'}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-burgundy/20"
          />
          <div>
            <div className="text-xs font-bold text-gray-900">
              {rev.user?.full_name || 'Sinh viên Ngoại thương'}
            </div>
            <div className="text-[10px] text-gray-400">
              {new Date(rev.created_at).toLocaleDateString('vi-VN')}
            </div>
          </div>
        </div>

        {/* Stars */}
        <div className="flex items-center gap-1 text-amber-500">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={`w-3.5 h-3.5 ${
                s <= (isEditing ? editRating : rev.rating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content or Edit Form */}
      {isEditing ? (
        <div className="space-y-2 pt-2">
          <div className="flex gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setEditRating(s)}
                className="p-1 cursor-pointer"
              >
                <Star
                  className={`w-5 h-5 ${
                    s <= editRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            disabled={isSaving}
            className="w-full p-2.5 rounded-lg border border-border text-xs focus:outline-none focus:border-burgundy disabled:opacity-50"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="px-3 py-1 rounded text-xs text-gray-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmitEdit}
              disabled={isSaving || !editContent.trim()}
              className="px-3 py-1 rounded text-xs bg-burgundy text-white font-bold hover:bg-burgundy-hover transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>Lưu</span>
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-700 leading-relaxed">{rev.content}</p>
      )}

      {/* Review image if present */}
      {rev.images && rev.images.length > 0 && !isEditing && (
        <div className="pt-1">
          <img
            src={rev.images[0]}
            alt="Review photo"
            className="w-24 h-24 rounded-lg object-cover border border-border"
          />
        </div>
      )}

      {/* Helpful button & Report button & Actions */}
      {!isEditing && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onToggleHelpful(rev.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                rev.is_helpful_by_me
                  ? 'border-burgundy-border bg-burgundy-light text-burgundy'
                  : 'border-border text-gray-600 hover:bg-slate-50'
              }`}
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${rev.is_helpful_by_me ? 'fill-burgundy' : ''}`} />
              <span>Hữu ích ({rev.helpful_count || 0})</span>
            </button>

            {!isOwnReview && (
              <button
                type="button"
                onClick={() => onReport(rev)}
                className="text-gray-400 hover:text-rose-600 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" /> Báo cáo
              </button>
            )}
          </div>

          {/* Edit / Delete actions for own review or admin */}
          {isOwnReview && (
            <div className="flex items-center gap-3 text-[11px]">
              <button
                type="button"
                onClick={handleStartEdit}
                className="text-gray-500 hover:text-burgundy flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3 h-3" /> Sửa
              </button>
              <button
                type="button"
                onClick={() => onDelete(rev.id)}
                className="text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Xóa
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
