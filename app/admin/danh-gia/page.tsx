'use client';

import React, { useState, useEffect } from 'react';
import { store } from '@/lib/data/store';
import { Review, ReviewReport } from '@/lib/types/database';
import { useToast } from '@/components/common/Toast';
import { Eye, EyeOff, Trash2, Star, Flag, CheckCheck } from 'lucide-react';

export default function AdminReviewsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'all' | 'reported'>('all');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<ReviewReport[]>([]);

  const loadData = () => {
    setReviews(store.getAllReviewsAdmin());
    setReports(store.getReviewReports());
  };

  useEffect(() => {
    loadData();
    store.loadFromSupabase().then(loadData);
  }, []);

  const handleToggleHide = (revId: string) => {
    store.toggleHideReview(revId);
    loadData();
    showToast('Đã cập nhật trạng thái hiển thị của đánh giá', 'info');
  };

  const handleDelete = (revId: string) => {
    if (confirm('Bạn có chắc muốn xóa vĩnh viễn đánh giá này?')) {
      store.deleteReview(revId);
      loadData();
      showToast('Đã xóa đánh giá thành công', 'success');
    }
  };

  const handleDismissReport = (reportId: string) => {
    store.dismissReport(reportId);
    loadData();
    showToast('Đã bỏ qua báo cáo này', 'info');
  };

  const pendingReports = reports.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-extrabold text-gray-900">Kiểm duyệt Đánh giá & Báo cáo</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Quản lý đánh giá cộng đồng, xử lý các báo cáo vi phạm tiêu chuẩn
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'all'
              ? 'border-burgundy text-burgundy font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Tất cả đánh giá ({reviews.length})
        </button>

        <button
          onClick={() => setActiveTab('reported')}
          className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'reported'
              ? 'border-burgundy text-burgundy font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Flag className="w-3.5 h-3.5 text-rose-500" />
          <span>Bị báo cáo ({pendingReports.length})</span>
        </button>
      </div>

      {/* TAB 1: ALL REVIEWS */}
      {activeTab === 'all' && (
        <div className="bg-white rounded-2xl border border-border shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-slate-50 border-b border-border text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Người viết</th>
                  <th className="py-3 px-4">Mã quán</th>
                  <th className="py-3 px-4">Sao</th>
                  <th className="py-3 px-4">Nội dung</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reviews.map((rev) => (
                  <tr key={rev.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                      {rev.user?.full_name || 'Người dùng'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">{rev.place_id}</td>
                    <td className="py-3 px-4 font-bold text-amber-500 flex items-center gap-0.5">
                      <Star className="w-3.5 h-3.5 fill-amber-500" />
                      {rev.rating}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-gray-800">{rev.content}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rev.is_hidden
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {rev.is_hidden ? 'Đang ẩn' : 'Hiển thị'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleHide(rev.id)}
                        className="p-1.5 text-gray-500 hover:text-amber-600 inline-block"
                        title={rev.is_hidden ? 'Hiện đánh giá' : 'Ẩn đánh giá'}
                      >
                        {rev.is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(rev.id)}
                        className="p-1.5 text-gray-500 hover:text-rose-600 inline-block"
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
      )}

      {/* TAB 2: REPORTED REVIEWS */}
      {activeTab === 'reported' && (
        <div className="space-y-4">
          {pendingReports.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-border shadow-soft text-center text-xs text-gray-500">
              Không có báo cáo nào chưa xử lý!
            </div>
          ) : (
            pendingReports.map((rep) => (
              <div
                key={rep.id}
                className="bg-white p-5 rounded-2xl border border-rose-200 shadow-soft space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                    Lý do báo cáo: {rep.reason}
                  </span>
                  <span className="text-gray-400">
                    Gửi bởi: {rep.user?.full_name || 'FTUer'} • {new Date(rep.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                {rep.review && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-border text-xs space-y-1">
                    <div className="font-bold text-gray-800">
                      Nội dung review của "{rep.review.user?.full_name}":
                    </div>
                    <p className="text-gray-700 italic">"{rep.review.content}"</p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => handleDismissReport(rep.id)}
                    className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-semibold text-gray-700 hover:bg-slate-100 flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Bỏ qua báo cáo
                  </button>
                  {rep.review && (
                    <>
                      <button
                        onClick={() => handleToggleHide(rep.review!.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600"
                      >
                        Ẩn review này
                      </button>
                      <button
                        onClick={() => handleDelete(rep.review!.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa vĩnh viễn
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
