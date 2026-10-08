'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { store } from '@/lib/data/store';
import { Review, ReviewReport, Place } from '@/lib/types/database';
import { useToast } from '@/components/common/Toast';
import { matchesSearch } from '@/lib/utils/text';
import { 
  Eye, 
  EyeOff, 
  Trash2, 
  Star, 
  Flag, 
  CheckCheck, 
  Search, 
  X, 
  MapPin, 
  User, 
  Calendar, 
  Wifi, 
  Zap, 
  Volume2, 
  DollarSign, 
  Maximize2, 
  RotateCcw,
  Loader2,
  FileText,
  AlertTriangle
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

export default function AdminReviewsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'all' | 'reported'>('all');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Detail Modal State
  const [detailReview, setDetailReview] = useState<Review | null>(null);

  // Delete Confirm Modal State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get Auth Headers with session token if available
  const getAuthHeaders = async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch (e) {}
    return headers;
  };

  // Load Data
  const loadData = async () => {
    // 1. Instant sync from local store
    const localReviews = store.getAllReviewsAdmin();
    const localPlaces = store.getAllPlacesAdmin();
    setReviews(localReviews);
    setPlaces(localPlaces);
    setReports(store.getReviewReports());

    // 2. Fetch authoritative data from server API
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const [revRes, placeRes] = await Promise.all([
        fetch('/api/reviews?admin=1', { headers, cache: 'no-store' }),
        fetch('/api/places?all=1', { headers, cache: 'no-store' }),
      ]);

      if (revRes.ok) {
        const revData = await revRes.json();
        if (Array.isArray(revData.reviews)) {
          setReviews(revData.reviews);
        }
      }

      if (placeRes.ok) {
        const placeData = await placeRes.json();
        if (Array.isArray(placeData.places)) {
          setPlaces(placeData.places);
        }
      }
    } catch (e) {
      console.warn('Admin reviews load data error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = store.subscribe(() => {
      setReports(store.getReviewReports());
    });
    return () => unsub();
  }, []);

  // Map of places by id for fast lookup
  const placeMap = useMemo(() => {
    const map: Record<string, Place> = {};
    for (const p of places) {
      map[p.id] = p;
    }
    return map;
  }, [places]);

  // Alphabetically sorted list of places for filter options
  const sortedPlaces = useMemo(() => {
    return [...places].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [places]);

  // Helper to resolve place name
  const getPlaceName = (placeId: string, reviewPlace?: { id: string; name: string } | null): string => {
    if (reviewPlace?.name) return reviewPlace.name;
    if (placeMap[placeId]?.name) return placeMap[placeId].name;
    return 'Địa điểm không xác định';
  };

  // Helper to format date
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Filtered reviews client-side
  const filteredReviews = useMemo(() => {
    return reviews.filter((rev) => {
      // 1. Place filter
      if (selectedPlaceId !== 'all' && rev.place_id !== selectedPlaceId) {
        return false;
      }

      // 2. Rating filter
      if (selectedRating !== 'all') {
        const target = Number(selectedRating);
        if (Math.round(rev.rating) !== target) {
          return false;
        }
      }

      // 3. Status filter
      if (selectedStatus === 'visible' && rev.is_hidden) {
        return false;
      }
      if (selectedStatus === 'hidden' && !rev.is_hidden) {
        return false;
      }

      // 4. Search query (reviewer name, place name, content)
      if (searchQuery.trim()) {
        const reviewerName = rev.user?.full_name || '';
        const placeName = getPlaceName(rev.place_id, rev.place);
        const content = rev.content || '';
        const match =
          matchesSearch(reviewerName, searchQuery) ||
          matchesSearch(placeName, searchQuery) ||
          matchesSearch(content, searchQuery);
        if (!match) {
          return false;
        }
      }

      return true;
    });
  }, [reviews, selectedPlaceId, selectedRating, selectedStatus, searchQuery, placeMap]);

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedPlaceId('all');
    setSelectedRating('all');
    setSelectedStatus('all');
  };

  const isFiltered = searchQuery !== '' || selectedPlaceId !== 'all' || selectedRating !== 'all' || selectedStatus !== 'all';

  // Toggle Hide/Unhide
  const handleToggleHide = async (revId: string) => {
    const rev = reviews.find((r) => r.id === revId);
    if (!rev) return;
    const nextHidden = !rev.is_hidden;

    // Optimistic UI & store update
    setReviews((prev) =>
      prev.map((r) => (r.id === revId ? { ...r, is_hidden: nextHidden } : r))
    );
    if (detailReview && detailReview.id === revId) {
      setDetailReview((prev) => (prev ? { ...prev, is_hidden: nextHidden } : null));
    }
    store.setReviewHidden(revId, nextHidden);

    showToast(nextHidden ? 'Đã ẩn đánh giá' : 'Đã hiển thị đánh giá', 'info');

    // Persist to database via API
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ reviewId: revId, is_hidden: nextHidden }),
      });
      if (!res.ok) {
        throw new Error('Cập nhật thất bại');
      }
    } catch (e) {
      // Rollback on failure
      setReviews((prev) =>
        prev.map((r) => (r.id === revId ? { ...r, is_hidden: !nextHidden } : r))
      );
      if (detailReview && detailReview.id === revId) {
        setDetailReview((prev) => (prev ? { ...prev, is_hidden: !nextHidden } : null));
      }
      store.setReviewHidden(revId, !nextHidden);
      showToast('Không thể cập nhật trạng thái trên máy chủ. Đã hoàn tác.', 'error');
    }
  };

  // Delete review
  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const revId = deleteTargetId;
    setIsDeleting(true);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/reviews?id=${revId}`, { 
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) {
        throw new Error('Lỗi khi xóa đánh giá');
      }

      // Update state and store
      setReviews((prev) => prev.filter((r) => r.id !== revId));
      if (detailReview && detailReview.id === revId) {
        setDetailReview(null);
      }
      store.deleteReview(revId);
      showToast('Đã xóa vĩnh viễn đánh giá thành công', 'success');
      setDeleteTargetId(null);
    } catch (e: any) {
      showToast('Không thể xóa đánh giá. Vui lòng thử lại!', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Report dismiss
  const handleDismissReport = (reportId: string) => {
    store.dismissReport(reportId);
    setReports(store.getReviewReports());
    showToast('Đã bỏ qua báo cáo này', 'info');
  };

  const pendingReports = reports.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-extrabold text-gray-900">Kiểm duyệt Đánh giá & Báo cáo</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Quản lý đánh giá cộng đồng, lọc theo địa điểm, số sao và xử lý các báo cáo vi phạm
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
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-border shadow-soft flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo người viết, địa điểm, nội dung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-border text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-burgundy transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              {/* Place Filter */}
              <select
                value={selectedPlaceId}
                onChange={(e) => setSelectedPlaceId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border text-xs font-semibold bg-white text-gray-700 focus:outline-none focus:border-burgundy max-w-[200px] truncate"
                title="Lọc theo địa điểm"
              >
                <option value="all">Tất cả địa điểm ({places.length})</option>
                {sortedPlaces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Rating Filter */}
              <select
                value={selectedRating}
                onChange={(e) => setSelectedRating(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border text-xs font-semibold bg-white text-gray-700 focus:outline-none focus:border-burgundy"
                title="Lọc theo số sao"
              >
                <option value="all">Tất cả số sao</option>
                <option value="5">5 sao</option>
                <option value="4">4 sao</option>
                <option value="3">3 sao</option>
                <option value="2">2 sao</option>
                <option value="1">1 sao</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border text-xs font-semibold bg-white text-gray-700 focus:outline-none focus:border-burgundy"
                title="Lọc theo trạng thái"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="visible">Hiển thị</option>
                <option value="hidden">Đã ẩn</option>
              </select>

              {/* Reset Filter Button */}
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-2 rounded-xl border border-gray-200 text-gray-500 hover:text-burgundy hover:bg-slate-50 text-xs flex items-center gap-1 font-semibold transition-colors"
                  title="Đặt lại bộ lọc"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Đặt lại</span>
                </button>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-between px-1 text-xs text-gray-500">
            <span>
              Hiển thị <strong className="text-gray-800">{filteredReviews.length}</strong> / {reviews.length} đánh giá
            </span>
            {isFiltered && (
              <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                Đang áp dụng bộ lọc
              </span>
            )}
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-border shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-slate-50 border-b border-border text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Người viết</th>
                    <th className="py-3 px-4">Địa điểm</th>
                    <th className="py-3 px-4">Sao</th>
                    <th className="py-3 px-4">Nội dung</th>
                    <th className="py-3 px-4 whitespace-nowrap">Thời gian</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && reviews.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-burgundy" />
                        <span>Đang tải danh sách đánh giá...</span>
                      </td>
                    </tr>
                  ) : filteredReviews.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        <p className="text-sm font-semibold text-gray-600 mb-1">
                          Không tìm thấy đánh giá nào
                        </p>
                        <p className="text-xs">
                          {isFiltered
                            ? 'Không có đánh giá nào phù hợp với các tiêu chí tìm kiếm và bộ lọc đã chọn.'
                            : 'Chưa có đánh giá nào trong hệ thống.'}
                        </p>
                        {isFiltered && (
                          <button
                            onClick={handleResetFilters}
                            className="mt-3 px-3.5 py-1.5 rounded-xl bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover transition-colors"
                          >
                            Xóa bộ lọc
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredReviews.map((rev) => {
                      const placeName = getPlaceName(rev.place_id, rev.place);
                      return (
                        <tr key={rev.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Reviewer */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {rev.user?.avatar_url ? (
                                <img
                                  src={rev.user.avatar_url}
                                  alt=""
                                  className="w-6 h-6 rounded-full object-cover ring-1 ring-border"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">
                                  {(rev.user?.full_name || 'U').charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="font-bold text-gray-900">
                                {rev.user?.full_name || 'Người dùng FTU'}
                              </span>
                            </div>
                          </td>

                          {/* Place Name */}
                          <td className="py-3 px-4 max-w-[200px]">
                            <div className="font-semibold text-gray-800 truncate" title={placeName}>
                              {placeName}
                            </div>
                          </td>

                          {/* Star */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-bold text-amber-500 flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 fill-amber-500" />
                              <span>{rev.rating}</span>
                            </div>
                          </td>

                          {/* Content */}
                          <td className="py-3 px-4 max-w-xs">
                            <div 
                              className="truncate text-gray-700 cursor-pointer hover:text-burgundy" 
                              onClick={() => setDetailReview(rev)}
                              title="Bấm để xem chi tiết đầy đủ"
                            >
                              {rev.content}
                            </div>
                          </td>

                          {/* Date */}
                          <td className="py-3 px-4 whitespace-nowrap text-gray-500 text-[11px]">
                            {formatDate(rev.created_at)}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                                rev.is_hidden
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {rev.is_hidden ? 'Đã ẩn' : 'Hiển thị'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                            {/* View Detail */}
                            <button
                              onClick={() => setDetailReview(rev)}
                              className="p-1.5 text-gray-500 hover:text-burgundy rounded-lg hover:bg-slate-100 inline-block transition-colors"
                              title="Xem chi tiết đánh giá"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            {/* Hide / Unhide */}
                            <button
                              onClick={() => handleToggleHide(rev.id)}
                              className={`p-1.5 rounded-lg inline-block transition-colors ${
                                rev.is_hidden
                                  ? 'text-emerald-600 hover:bg-emerald-50'
                                  : 'text-amber-600 hover:bg-amber-50'
                              }`}
                              title={rev.is_hidden ? 'Hiển thị lại đánh giá' : 'Ẩn đánh giá'}
                            >
                              {rev.is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setDeleteTargetId(rev.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg inline-block transition-colors"
                              title="Xóa vĩnh viễn"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
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
            pendingReports.map((rep) => {
              const repPlaceName = rep.review
                ? getPlaceName(rep.review.place_id, rep.review.place)
                : 'Địa điểm không xác định';

              return (
                <div
                  key={rep.id}
                  className="bg-white p-5 rounded-2xl border border-rose-200 shadow-soft space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                    <span className="font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 inline-block w-fit">
                      Lý do báo cáo: {rep.reason}
                    </span>
                    <span className="text-gray-400">
                      Gửi bởi: {rep.user?.full_name || 'FTUer'} • {formatDate(rep.created_at)}
                    </span>
                  </div>

                  {rep.review && (
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-border text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-gray-900 flex items-center gap-1.5">
                          <span>{rep.review.user?.full_name || 'Người dùng'}</span>
                          <span className="text-gray-400 font-normal">tại</span>
                          <span className="text-burgundy font-semibold">{repPlaceName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-500" />
                          <span>{rep.review.rating}</span>
                        </div>
                      </div>
                      <p className="text-gray-700 italic bg-white p-2.5 rounded-lg border border-slate-200">
                        "{rep.review.content}"
                      </p>
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
                          onClick={() => setDetailReview(rep.review!)}
                          className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-gray-700 hover:bg-slate-100 flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" /> Xem chi tiết
                        </button>
                        <button
                          onClick={() => handleToggleHide(rep.review!.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600"
                        >
                          {rep.review.is_hidden ? 'Hiện review này' : 'Ẩn review này'}
                        </button>
                        <button
                          onClick={() => setDeleteTargetId(rep.review!.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa vĩnh viễn
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL: REVIEW DETAIL */}
      {detailReview && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-elevated border border-border max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-burgundy" />
                <h3 className="font-extrabold text-base text-gray-900">Chi tiết đánh giá</h3>
              </div>
              <button
                onClick={() => setDetailReview(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reviewer & Place */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-border text-xs">
              <div>
                <span className="text-gray-400 block mb-0.5 font-medium">Người đánh giá:</span>
                <div className="flex items-center gap-2">
                  {detailReview.user?.avatar_url ? (
                    <img
                      src={detailReview.user.avatar_url}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">
                      {(detailReview.user?.full_name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-bold text-gray-900">
                    {detailReview.user?.full_name || 'Người dùng FTU'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-gray-400 block mb-0.5 font-medium">Địa điểm:</span>
                <div className="font-bold text-burgundy flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {getPlaceName(detailReview.place_id, detailReview.place)}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-gray-400 block mb-0.5 font-medium">Thời gian tạo:</span>
                <div className="font-semibold text-gray-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>{formatDate(detailReview.created_at)}</span>
                </div>
              </div>

              <div>
                <span className="text-gray-400 block mb-0.5 font-medium">Trạng thái:</span>
                <div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                      detailReview.is_hidden
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {detailReview.is_hidden ? 'Đã ẩn' : 'Hiển thị'}
                  </span>
                </div>
              </div>
            </div>

            {/* Overall Rating Section */}
            <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-700 block">Đánh giá chung (Overall)</span>
                <span className="text-[11px] text-gray-500">Độc lập với 5 tiêu chí chi tiết</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center text-amber-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= Math.round(detailReview.rating)
                          ? 'fill-amber-500 text-amber-500'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-extrabold text-sm text-gray-900 ml-1">
                  {detailReview.rating} / 5
                </span>
              </div>
            </div>

            {/* 5 Criteria Ratings Section (Independent) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700 block">
                5 tiêu chí khảo sát chi tiết (Độc lập):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {/* Wifi */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-border text-center space-y-1">
                  <div className="flex items-center justify-center gap-1 text-gray-500 text-[11px] font-medium">
                    <Wifi className="w-3.5 h-3.5" /> Wifi
                  </div>
                  <div className="font-extrabold text-xs text-gray-800">
                    {detailReview.wifi_rating ? `${detailReview.wifi_rating} / 5 ⭐` : '—'}
                  </div>
                </div>

                {/* Outlet */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-border text-center space-y-1">
                  <div className="flex items-center justify-center gap-1 text-gray-500 text-[11px] font-medium">
                    <Zap className="w-3.5 h-3.5" /> Ổ điện
                  </div>
                  <div className="font-extrabold text-xs text-gray-800">
                    {detailReview.outlet_rating ? `${detailReview.outlet_rating} / 5 ⭐` : '—'}
                  </div>
                </div>

                {/* Quiet */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-border text-center space-y-1">
                  <div className="flex items-center justify-center gap-1 text-gray-500 text-[11px] font-medium">
                    <Volume2 className="w-3.5 h-3.5" /> Yên tĩnh
                  </div>
                  <div className="font-extrabold text-xs text-gray-800">
                    {detailReview.quiet_rating ? `${detailReview.quiet_rating} / 5 ⭐` : '—'}
                  </div>
                </div>

                {/* Price */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-border text-center space-y-1">
                  <div className="flex items-center justify-center gap-1 text-gray-500 text-[11px] font-medium">
                    <DollarSign className="w-3.5 h-3.5" /> Mức giá
                  </div>
                  <div className="font-extrabold text-xs text-gray-800">
                    {detailReview.price_rating ? `${detailReview.price_rating} / 5 ⭐` : '—'}
                  </div>
                </div>

                {/* Space */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-border text-center space-y-1">
                  <div className="flex items-center justify-center gap-1 text-gray-500 text-[11px] font-medium">
                    <Maximize2 className="w-3.5 h-3.5" /> Không gian
                  </div>
                  <div className="font-extrabold text-xs text-gray-800">
                    {detailReview.space_rating ? `${detailReview.space_rating} / 5 ⭐` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Review Content */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-gray-700 block">Nội dung đánh giá:</span>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-border text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
                {detailReview.content}
              </div>
            </div>

            {/* Images if any */}
            {detailReview.images && detailReview.images.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-gray-700 block">Ảnh đính kèm:</span>
                <div className="flex flex-wrap gap-2">
                  {detailReview.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`Review photo ${idx + 1}`}
                      className="w-16 h-16 rounded-xl object-cover border border-border"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                onClick={() => setDeleteTargetId(detailReview.id)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Xóa đánh giá
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleHide(detailReview.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors ${
                    detailReview.is_hidden
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  {detailReview.is_hidden ? (
                    <>
                      <Eye className="w-4 h-4" /> Hiển thị lại
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4" /> Ẩn đánh giá
                    </>
                  )}
                </button>
                <button
                  onClick={() => setDetailReview(null)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-gray-700 hover:bg-slate-100 transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-elevated border border-border animate-in fade-in zoom-in-95">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-gray-900">Xác nhận xóa vĩnh viễn</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Bạn có chắc chắn muốn xóa đánh giá này khỏi cơ sở dữ liệu? Toàn bộ báo cáo và lượt hữu ích liên quan sẽ bị xóa theo. Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-gray-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa vĩnh viễn</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
