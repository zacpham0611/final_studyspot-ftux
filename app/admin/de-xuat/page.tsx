'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { store } from '@/lib/data/store';
import { Place } from '@/lib/types/database';
import { useToast } from '@/components/common/Toast';
import { 
  Check, 
  X, 
  MapPin, 
  Eye, 
  Clock, 
  Trash2, 
  Image as ImageIcon,
  User,
  Calendar,
  AlertCircle
} from 'lucide-react';
import MapSkeleton from '@/components/map/MapSkeleton';

const StudyMap = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export default function AdminProposalsPage() {
  const { showToast } = useToast();
  const [proposals, setProposals] = useState<Place[]>([]);
  const [activeDrawerPlace, setActiveDrawerPlace] = useState<Place | null>(null);
  const [rejectModalPlace, setRejectModalPlace] = useState<Place | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = () => {
    const all = store.getAllPlacesAdmin();
    setProposals(all.filter((p) => p.status === 'pending'));
  };

  useEffect(() => {
    loadData();
    store.loadFromSupabase().then(loadData);
    const unsubscribe = store.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (placeId: string, placeName: string) => {
    // 1. Optimistic update
    store.approveProposal(placeId);
    loadData();
    setActiveDrawerPlace(null);
    showToast(`Đã duyệt xuất bản địa điểm: "${placeName}" và gửi thông báo tới người đề xuất!`, 'success');

    // 2. Persist to Supabase
    try {
      await fetch('/api/places', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId, status: 'approved' }),
      });
      await store.loadFromSupabase();
      loadData();
    } catch (e: any) {
      console.warn('Approve proposal sync notice:', e.message);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalPlace) return;
    if (!rejectReason.trim()) {
      showToast('Vui lòng nhập lý do từ chối', 'error');
      return;
    }
    const targetPlaceId = rejectModalPlace.id;
    const reason = rejectReason.trim();

    // 1. Optimistic update
    store.rejectProposal(targetPlaceId, reason);
    setRejectModalPlace(null);
    setRejectReason('');
    setActiveDrawerPlace(null);
    loadData();
    showToast('Đã từ chối đề xuất và gửi thông báo giải thích cho sinh viên', 'info');

    // 2. Persist to Supabase
    try {
      await fetch('/api/places', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: targetPlaceId, status: 'rejected', rejectReason: reason }),
      });
      await store.loadFromSupabase();
      loadData();
    } catch (e: any) {
      console.warn('Reject proposal sync notice:', e.message);
    }
  };

  const handleRemoveProposalImage = (index: number) => {
    if (!activeDrawerPlace) return;
    store.removePlaceImage(activeDrawerPlace.id, index);
    const updated = store.getPlaceById(activeDrawerPlace.id);
    setActiveDrawerPlace(updated || null);
    loadData();
    showToast('Đã gỡ bỏ ảnh không phù hợp khỏi đề xuất', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="border-b border-border pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Duyệt Đề xuất Địa điểm</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Danh sách địa điểm học tập mới do cộng đồng sinh viên FTU gửi lên chờ phê duyệt ({proposals.length} đề xuất)
          </p>
        </div>
      </div>

      {proposals.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-border shadow-soft text-center space-y-2">
          <Clock className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="font-bold text-gray-800 text-base">Hiện không có đề xuất nào chờ duyệt</h3>
          <p className="text-xs text-gray-500">Mọi đề xuất từ sinh viên đã được giải quyết kịp thời.</p>
        </div>
      ) : (
        /* PROPOSALS TABLE */
        <div className="bg-white rounded-2xl border border-border shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-slate-50 border-b border-border text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Ảnh & Tên địa điểm</th>
                  <th className="py-3 px-4">Địa chỉ quanh FTU</th>
                  <th className="py-3 px-4">Người đề xuất</th>
                  <th className="py-3 px-4">Thời gian gửi</th>
                  <th className="py-3 px-4">Số ảnh</th>
                  <th className="py-3 px-4 text-right">Thao tác duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {proposals.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={
                            p.images[0] ||
                            'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=100&q=80'
                          }
                          alt=""
                          className="w-10 h-10 rounded-xl object-cover ring-1 ring-border"
                        />
                        <div className="max-w-[220px]">
                          <div className="font-bold text-gray-900 truncate">{p.name}</div>
                          <div className="text-[10px] text-gray-400 truncate">
                            Mức giá: {'$'.repeat(p.price_level || 2)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-[220px] truncate">
                      <div className="flex items-center gap-1 text-gray-700 truncate">
                        <MapPin className="w-3.5 h-3.5 text-burgundy flex-shrink-0" />
                        <span className="truncate">{p.address}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium text-gray-800">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span>{p.creator?.full_name || 'Sinh viên FTU'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-gray-500">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>{new Date(p.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-gray-700">
                      <div className="flex items-center gap-1 text-[11px]">
                        <ImageIcon className="w-3.5 h-3.5 text-burgundy" />
                        <span>{p.images.length} ảnh</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setActiveDrawerPlace(p)}
                        className="px-2.5 py-1.5 rounded-lg border border-border text-gray-700 hover:text-burgundy hover:bg-slate-100 font-semibold inline-flex items-center gap-1"
                        title="Xem chi tiết & Bản đồ"
                      >
                        <Eye className="w-3.5 h-3.5 text-burgundy" /> Chi tiết
                      </button>
                      <button
                        onClick={() => setRejectModalPlace(p)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold inline-flex items-center gap-1"
                        title="Từ chối đề xuất"
                      >
                        <X className="w-3.5 h-3.5" /> Từ chối
                      </button>
                      <button
                        onClick={() => handleApprove(p.id, p.name)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold inline-flex items-center gap-1 shadow-xs"
                        title="Phê duyệt đưa lên bản đồ"
                      >
                        <Check className="w-3.5 h-3.5" /> Duyệt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SLIDE-OVER DRAWER WITH MAP & PHOTO REMOVAL */}
      <AnimatePresence>
        {activeDrawerPlace && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDrawerPlace(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            />

            {/* Slide-over Content Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl bg-white shadow-2xl z-10 flex flex-col h-full"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-border flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-burgundy-light text-burgundy flex items-center justify-center font-bold">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-gray-900 leading-snug">
                      {activeDrawerPlace.name}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Gửi bởi {activeDrawerPlace.creator?.full_name || 'Sinh viên FTU'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveDrawerPlace(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                {/* Basic info box */}
                <div className="bg-slate-50 rounded-xl p-3.5 border border-border space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-burgundy flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-gray-800">Địa chỉ:</span>{' '}
                      <span className="text-gray-700">{activeDrawerPlace.address}</span>
                    </div>
                  </div>
                  <div className="text-gray-500 text-[11px]">
                    Tọa độ: <span className="font-mono">{activeDrawerPlace.lat.toFixed(5)}, {activeDrawerPlace.lng.toFixed(5)}</span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="font-bold text-gray-800 mb-1.5">Ghi chú & Mô tả của sinh viên:</h4>
                  <p className="p-3 rounded-xl bg-slate-50 border border-border text-gray-700 leading-relaxed italic">
                    "{activeDrawerPlace.description || 'Không có mô tả chi tiết'}"
                  </p>
                </div>

                {/* Photos List with Admin Remove Controls */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-800">Ảnh sinh viên tải lên ({activeDrawerPlace.images.length}):</h4>
                    <span className="text-[10px] text-gray-400">Di chuột để gỡ ảnh không phù hợp</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {activeDrawerPlace.images.map((img, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden h-28 border border-border bg-slate-100">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => handleRemoveProposalImage(idx)}
                          className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          title="Gỡ ảnh này khỏi đề xuất"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mini Map Location Verification */}
                <div>
                  <h4 className="font-bold text-gray-800 mb-2">Bản đồ vị trí ghim quanh Ngoại thương:</h4>
                  <div className="h-64 rounded-xl overflow-hidden border border-border shadow-inner">
                    <StudyMap
                      places={[activeDrawerPlace]}
                      selectedPlaceId={activeDrawerPlace.id}
                      height="100%"
                      minHeight="240px"
                    />
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-border bg-slate-50 flex items-center justify-between gap-3">
                <button
                  onClick={() => setRejectModalPlace(activeDrawerPlace)}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 font-bold hover:bg-rose-100 flex items-center gap-1.5 transition-colors"
                >
                  <X className="w-4 h-4" /> Từ chối đề xuất
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveDrawerPlace(null)}
                    className="px-4 py-2.5 rounded-xl border border-border font-semibold text-gray-700 hover:bg-slate-100"
                  >
                    Đóng
                  </button>
                  <button
                    onClick={() => handleApprove(activeDrawerPlace.id, activeDrawerPlace.name)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Check className="w-4 h-4" /> Phê duyệt & Đưa lên bản đồ
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REJECT MODAL (Requires Reason) */}
      {rejectModalPlace && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-elevated border border-border p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-extrabold text-base text-gray-900">Từ chối đề xuất địa điểm</h3>
            </div>
            <p className="text-xs text-gray-600">
              Bạn đang từ chối đề xuất <strong>"{rejectModalPlace.name}"</strong>. Vui lòng nhập lý do giải thích rõ ràng cho sinh viên gửi đề xuất:
            </p>
            <textarea
              rows={3}
              placeholder="Ví dụ: Quán đã đóng cửa, vị trí quá xa Đại học Ngoại thương, thông tin trùng lặp..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-border text-xs focus:outline-none focus:border-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => {
                  setRejectModalPlace(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 rounded-xl text-xs text-gray-600 hover:bg-slate-100 font-semibold"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-sm"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
