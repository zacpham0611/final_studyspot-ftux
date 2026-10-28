'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { store } from '@/lib/data/store';
import { Place, Review } from '@/lib/types/database';
import { ReviewItem } from '@/components/place/ReviewItem';
import { ReviewModal } from '@/components/place/ReviewModal';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/lib/supabase/client';
import {
  ArrowLeft,
  Star,
  MessageSquarePlus,
  AlertCircle,
  Flag,
  X,
  Loader2,
  MapPin
} from 'lucide-react';

const REVIEWS_PER_PAGE = 10;

export default function PlaceAllReviewsPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const placeId = params.id as string;

  const [place, setPlace] = useState<Place | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | 'all'>('all');
  const [displayedLimit, setDisplayedLimit] = useState(REVIEWS_PER_PAGE);

  // Modals
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reportReviewTarget, setReportReviewTarget] = useState<Review | null>(null);
  const [reportReason, setReportReason] = useState('Nội dung không phù hợp');

  const { user: currentUser, isLoading: isAuthLoading } = useAuth();

  const loadData = async () => {
    // 1. Load from local store first for instant UI response
    const cachedPlace = store.getPlaceById(placeId);
    if (cachedPlace) {
      setPlace(cachedPlace);
      setReviews(store.getReviewsForPlace(placeId));
    }

    try {
      // 2. Fetch authoritative place data
      const placePromise = (async () => {
        try {
          const res = await fetch(`/api/places?id=${encodeURIComponent(placeId)}`, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            const freshPlace = data.place || (Array.isArray(data.places) ? data.places[0] : null);
            if (freshPlace) {
              setPlace(freshPlace);
              store.savePlace(freshPlace);
            }
          }
        } catch (e) {
          console.warn('AllReviews place fetch notice:', e);
        }
      })();

      // 3. Fetch authoritative reviews
      const reviewsPromise = (async () => {
        try {
          let supaReviews: any[] | null = null;
          try {
            const revRes = await fetch(`/api/reviews?placeId=${encodeURIComponent(placeId)}`, { cache: 'no-store' });
            if (revRes.ok) {
              const revJson = await revRes.json();
              if (Array.isArray(revJson.reviews)) {
                supaReviews = revJson.reviews;
              }
            }
          } catch (apiErr) {}

          if (!supaReviews) {
            const { data, error } = await supabase
              .from('reviews')
              .select(`
                *,
                user:users!reviews_user_id_fkey(full_name, avatar_url)
              `)
              .eq('place_id', placeId)
              .order('created_at', { ascending: false });

            if (!error && data) {
              supaReviews = data;
            } else {
              const { data: plainReviews } = await supabase
                .from('reviews')
                .select('*')
                .eq('place_id', placeId)
                .order('created_at', { ascending: false });

              if (plainReviews) {
                const userIds = Array.from(new Set(plainReviews.map((r: any) => r.user_id).filter(Boolean)));
                let userMap: Record<string, any> = {};
                if (userIds.length > 0) {
                  const { data: usersData } = await supabase
                    .from('users')
                    .select('id, full_name, avatar_url')
                    .in('id', userIds);
                  if (usersData) {
                    userMap = Object.fromEntries(usersData.map((u: any) => [u.id, u]));
                  }
                }
                supaReviews = plainReviews.map((r: any) => ({
                  ...r,
                  user: userMap[r.user_id] || null,
                }));
              }
            }
          }

          if (supaReviews) {
            setReviews(supaReviews as any);
            store.syncPlaceReviews(placeId, supaReviews as any);
          } else {
            setReviews(store.getReviewsForPlace(placeId));
          }
        } catch (e) {
          console.warn('AllReviews reviews fetch notice:', e);
          setReviews(store.getReviewsForPlace(placeId));
        }
      })();

      await Promise.all([placePromise, reviewsPromise]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Intentionally DO NOT call store.incrementView on this page!
  }, [placeId, currentUser]);

  const handleOpenReview = () => {
    if (isAuthLoading) {
      showToast('Đang kiểm tra trạng thái đăng nhập...', 'info');
      return;
    }
    if (!currentUser) {
      showToast('Vui lòng đăng nhập để viết đánh giá!', 'info');
      router.push(`/dang-nhap?redirect=/dia-diem/${placeId}/danh-gia`);
      return;
    }
    setIsReviewOpen(true);
  };

  // Review Actions
  const handleToggleHelpful = (revId: string) => {
    const res = store.toggleHelpfulReview(revId);
    setReviews((prev) =>
      prev.map((r) =>
        r.id === revId
          ? {
              ...r,
              helpful_count: res.count,
              is_helpful_by_me: res.helpful,
            }
          : r
      )
    );
    showToast(res.helpful ? 'Đã thích đánh giá hữu ích!' : 'Đã bỏ thích đánh giá', 'info');
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReviewTarget) return;

    const res = store.reportReview(reportReviewTarget.id, reportReason);
    setReportReviewTarget(null);
    setReportReason('Nội dung không phù hợp');
    showToast(res.message, 'success');
  };

  const handleDeleteReview = async (revId: string) => {
    if (confirm('Bạn có chắc muốn xóa đánh giá này?')) {
      try {
        await supabase.from('reviews').delete().eq('id', revId);
      } catch (e) {}
      store.deleteReview(revId);
      setReviews((prev) => prev.filter((r) => r.id !== revId));
      showToast('Đã xóa đánh giá', 'info');
    }
  };

  const handleSaveEdit = async (revId: string, content: string, rating: number) => {
    try {
      await supabase.from('reviews').update({ content, rating }).eq('id', revId);
    } catch (e) {}
    store.updateReview(revId, content, rating);
    await loadData();
    showToast('Cập nhật đánh giá thành công!', 'success');
  };

  // Filter & Stats calculations
  const activeReviews = reviews.filter((r) => !r.is_hidden);
  const activeReviewCount = activeReviews.length;
  const overallRating =
    activeReviewCount > 0
      ? (
          Math.round(
            (activeReviews.reduce((sum, r) => sum + r.rating, 0) / activeReviewCount) * 10
          ) / 10
        ).toFixed(1)
      : null;

  // Criteria averages
  const getCriteriaAvg = (key: keyof Review) => {
    const valid = activeReviews.filter((r) => typeof r[key] === 'number');
    if (valid.length === 0) return 4.8;
    const sum = valid.reduce((acc, r) => acc + (r[key] as number), 0);
    return Math.round((sum / valid.length) * 10) / 10;
  };

  const avgWifi = getCriteriaAvg('wifi_rating');
  const avgOutlet = getCriteriaAvg('outlet_rating');
  const avgQuiet = getCriteriaAvg('quiet_rating');
  const avgPrice = getCriteriaAvg('price_rating');
  const avgSpace = getCriteriaAvg('space_rating');

  // Star counts for badges
  const starCounts = {
    5: activeReviews.filter((r) => r.rating === 5).length,
    4: activeReviews.filter((r) => r.rating === 4).length,
    3: activeReviews.filter((r) => r.rating === 3).length,
    2: activeReviews.filter((r) => r.rating === 2).length,
    1: activeReviews.filter((r) => r.rating === 1).length,
  };

  const filteredReviews = activeReviews.filter((r) =>
    selectedStarFilter === 'all' ? true : r.rating === selectedStarFilter
  );

  const displayedReviews = filteredReviews.slice(0, displayedLimit);
  const hasMoreReviews = filteredReviews.length > displayedLimit;

  if (isLoading && !place) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-6 animate-pulse">
        <div className="h-4 w-32 bg-slate-200 rounded"></div>
        <div className="h-8 w-64 bg-slate-200 rounded"></div>
        <div className="h-24 bg-slate-100 rounded-2xl"></div>
        <div className="space-y-3">
          <div className="h-28 bg-slate-100 rounded-xl"></div>
          <div className="h-28 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!place) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-800">Không tìm thấy địa điểm</h2>
        <p className="text-sm text-gray-500 mt-1">Địa điểm này có thể đã bị xóa hoặc đường dẫn không chính xác.</p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-burgundy text-white font-semibold text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại bản đồ
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24 md:pb-12">
      {/* Top Navigation Back to Place Detail */}
      <div>
        <Link
          href={`/dia-diem/${placeId}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-burgundy hover:text-burgundy-hover transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại thông tin địa điểm</span>
        </Link>
      </div>

      {/* Place Summary Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-border shadow-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-gray-900">{place.name}</h1>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate">{place.address}</span>
          </p>
          <div className="flex items-center gap-2 pt-1">
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="w-4 h-4 fill-amber-400" />
              <span className="text-sm font-extrabold">{overallRating || 'Chưa có'}</span>
            </div>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs font-semibold text-gray-600">
              {activeReviewCount} đánh giá từ cộng đồng
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenReview}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover transition-colors cursor-pointer shadow-xs sm:self-start"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>+ Viết đánh giá</span>
        </button>
      </div>

      {/* 5 Criteria Breakdown Card */}
      <div className="p-4 rounded-xl bg-slate-50 border border-border grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-2xs">
          <div className="text-[11px] text-gray-500 font-medium">Wifi</div>
          <div className="text-base font-extrabold text-burgundy mt-0.5">{avgWifi}/5</div>
        </div>
        <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-2xs">
          <div className="text-[11px] text-gray-500 font-medium">Ổ điện</div>
          <div className="text-base font-extrabold text-burgundy mt-0.5">{avgOutlet}/5</div>
        </div>
        <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-2xs">
          <div className="text-[11px] text-gray-500 font-medium">Yên tĩnh</div>
          <div className="text-base font-extrabold text-burgundy mt-0.5">{avgQuiet}/5</div>
        </div>
        <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-2xs">
          <div className="text-[11px] text-gray-500 font-medium">Giá cả</div>
          <div className="text-base font-extrabold text-burgundy mt-0.5">{avgPrice}/5</div>
        </div>
        <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[11px] text-gray-500 font-medium">Không gian</div>
          <div className="text-base font-extrabold text-burgundy mt-0.5">{avgSpace}/5</div>
        </div>
      </div>

      {/* Filter by Stars */}
      <div className="bg-white p-4 rounded-2xl border border-border shadow-soft space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-gray-700">Lọc theo mức đánh giá:</div>
          <span className="text-[11px] text-gray-400">
            Hiển thị {filteredReviews.length} / {activeReviewCount} đánh giá
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => {
              setSelectedStarFilter('all');
              setDisplayedLimit(REVIEWS_PER_PAGE);
            }}
            className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
              selectedStarFilter === 'all'
                ? 'bg-burgundy text-white font-bold shadow-xs'
                : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({activeReviewCount})
          </button>

          {([5, 4, 3, 2, 1] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSelectedStarFilter(s);
                setDisplayedLimit(REVIEWS_PER_PAGE);
              }}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                selectedStarFilter === s
                  ? 'bg-burgundy text-white font-bold shadow-xs'
                  : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
              }`}
            >
              <span>{s} ⭐</span>
              <span className={`text-[10px] ${selectedStarFilter === s ? 'text-white/80' : 'text-gray-400'}`}>
                ({starCounts[s]})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-border shadow-soft text-center space-y-3">
            <p className="text-xs text-gray-500 italic">
              {activeReviewCount === 0
                ? 'Chưa có đánh giá nào từ cộng đồng FTU. Hãy là người đầu tiên chia sẻ cảm nhận về quán nhé!'
                : `Chưa có đánh giá nào cho mức ${selectedStarFilter} sao.`}
            </p>
            {activeReviewCount === 0 ? (
              <button
                type="button"
                onClick={handleOpenReview}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover transition-colors"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>Viết đánh giá ngay</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedStarFilter('all')}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl border border-border bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-gray-700 transition-colors"
              >
                <span>Xem tất cả đánh giá</span>
              </button>
            )}
          </div>
        ) : (
          displayedReviews.map((rev) => (
            <ReviewItem
              key={rev.id}
              review={rev}
              currentUserId={currentUser?.id}
              isAdmin={currentUser?.role === 'admin'}
              onToggleHelpful={handleToggleHelpful}
              onReport={(r) => setReportReviewTarget(r)}
              onDelete={handleDeleteReview}
              onSaveEdit={handleSaveEdit}
            />
          ))
        )}

        {/* Load More Button */}
        {hasMoreReviews && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setDisplayedLimit((prev) => prev + REVIEWS_PER_PAGE)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-border bg-white hover:bg-slate-50 text-xs font-bold text-gray-700 transition-colors cursor-pointer shadow-xs"
            >
              <span>Xem thêm đánh giá (còn lại {filteredReviews.length - displayedLimit})</span>
            </button>
          </div>
        )}
      </div>

      {/* Review Modal */}
      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        placeId={place.id}
        placeName={place.name}
        onReviewSuccess={loadData}
      />

      {/* Review Report Modal */}
      {reportReviewTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <Flag className="w-4 h-4" /> Báo cáo đánh giá vi phạm
              </div>
              <button
                onClick={() => setReportReviewTarget(null)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                  Lý do báo cáo vi phạm:
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border text-xs focus:outline-none focus:border-burgundy bg-white"
                >
                  <option value="Nội dung không phù hợp">Nội dung không phù hợp / Xúc phạm</option>
                  <option value="Spam hoặc quảng cáo">Spam hoặc thông tin quảng cáo trục lợi</option>
                  <option value="Thông tin sai lệch về quán">Thông tin sai lệch về không gian, giá cả của quán</option>
                  <option value="Khác">Lý do khác</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-border text-xs text-gray-600 italic">
                "{reportReviewTarget.content}"
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setReportReviewTarget(null)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-gray-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
                >
                  Gửi báo cáo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
