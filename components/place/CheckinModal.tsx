'use client';

import React, { useState } from 'react';
import { X, Users, AlertCircle } from 'lucide-react';
import { CrowdLevel, Checkin } from '@/lib/types/database';
import { store } from '@/lib/data/store';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/components/auth/AuthContext';

interface CheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  placeId: string;
  placeName: string;
  onCheckinSuccess: (checkin?: Checkin) => void;
}

export function CheckinModal({
  isOpen,
  onClose,
  placeId,
  placeName,
  onCheckinSuccess,
}: CheckinModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [level, setLevel] = useState<CrowdLevel>(1);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('Vui lòng đăng nhập để báo độ đông!', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Submit via server API route
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId,
          level,
          note: note.trim() || undefined,
          userId: user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Lỗi khi gửi check-in');
      }

      // 2. Also ensure local store has the checkin
      const localResult = store.addCheckin(placeId, level, note.trim(), user || undefined);
      const resultingCheckin: Checkin = data.checkin || localResult.checkin || {
        id: `chk-${Date.now()}`,
        place_id: placeId,
        user_id: user.id,
        level,
        note: note.trim() || undefined,
        created_at: new Date().toISOString(),
        user: {
          full_name: user.full_name || 'Sinh viên FTU',
          avatar_url: user.avatar_url,
        },
      };

      showToast(data.message || 'Báo độ đông thành công! Cảm ơn bạn đã đóng góp cho cộng đồng FTU.', 'success');
      onCheckinSuccess(resultingCheckin);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi gửi check-in', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-elevated border border-border p-6 overflow-hidden animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-burgundy-light flex items-center justify-center text-burgundy">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900">Báo độ đông</h3>
              <p className="text-xs text-gray-500 truncate max-w-[240px]">{placeName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-2">
              Tình trạng chỗ ngồi thực tế tại quán lúc này:
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  lvl: 1 as CrowdLevel,
                  label: 'Vắng vẻ',
                  color: 'border-emerald-500 bg-emerald-50 text-emerald-800',
                  icon: '🟢',
                  desc: 'Nhiều bàn trống',
                },
                {
                  lvl: 2 as CrowdLevel,
                  label: 'Vừa phải',
                  color: 'border-amber-500 bg-amber-50 text-amber-800',
                  icon: '🟡',
                  desc: 'Vẫn còn chỗ',
                },
                {
                  lvl: 3 as CrowdLevel,
                  label: 'Đông đúc',
                  color: 'border-rose-500 bg-rose-50 text-rose-800',
                  icon: '🔴',
                  desc: 'Hết bàn / ồn',
                },
              ].map((item) => (
                <button
                  key={item.lvl}
                  type="button"
                  onClick={() => setLevel(item.lvl)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    level === item.lvl
                      ? `${item.color} shadow-sm font-bold scale-[1.02]`
                      : 'border-border text-gray-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xl mb-1">{item.icon}</div>
                  <div className="text-xs font-bold">{item.label}</div>
                  <div className="text-[10px] text-gray-500">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-gray-600">
                Ghi chú thêm (tùy chọn)
              </label>
              <span className="text-[11px] text-gray-400">{note.length}/100</span>
            </div>
            <input
              type="text"
              maxLength={100}
              placeholder="VD: Tầng 2 còn 4 bàn trống cạnh ổ điện..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-border text-[11px] text-gray-500 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-burgundy flex-shrink-0 mt-0.5" />
            <span>
              Hệ thống áp dụng thời gian chờ 30 phút giữa các lần check-in tại cùng địa điểm để đảm bảo dữ liệu luôn khách quan.
            </span>
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
              {isSubmitting ? 'Đang gửi...' : 'Gửi check-in ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
