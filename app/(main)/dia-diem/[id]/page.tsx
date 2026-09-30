'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { store } from '@/lib/data/store';
import { Place, Review, Checkin } from '@/lib/types/database';
import { ImageGallery } from '@/components/place/ImageGallery';
import { CheckinModal } from '@/components/place/CheckinModal';
import { ReviewModal } from '@/components/place/ReviewModal';
import { HourlyCrowdChart } from '@/components/place/HourlyCrowdChart';
import { SimilarPlaces } from '@/components/place/SimilarPlaces';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { formatDistance, FTU_COORDINATES } from '@/lib/utils/distance';
import { 
  Star, 
  MapPin, 
  Clock, 
  Heart, 
  Share2, 
  Navigation, 
  Users, 
  MessageSquarePlus, 
  Wifi, 
  Zap, 
  VolumeX, 
  Tag, 
  Wind, 
  Bike, 
  Moon, 
  ArrowLeft,
  AlertCircle,
  Trash2,
  Edit2,
  ThumbsUp,
  Flag,
  X
} from 'lucide-react';

// Dynamic Mini Map (no SSR, OpenStreetMap free tiles)
const StudyMap = dynamic(() => import('@/components/map/StudyMap'), {
  ssr: false,
  loading: () => <div className="h-64 bg-slate-100 rounded-xl animate-pulse"></div>,
});

export default function PlaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const placeId = params.id as string;

  const [place, setPlace] = useState<Place | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [similarPlaces, setSimilarPlaces] = useState<Place[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | 'all'>('all');

  // Modals
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Report Modal
  const [reportReviewTarget, setReportReviewTarget] = useState<Review | null>(null);
  const [reportReason, setReportReason] = useState('Nội dung không phù hợp');

  // Edit review state
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editRating, setEditRating] = useState(5);

  const { user: currentUser } = useAuth();

  const refreshData = async () => {
    const p = store.getPlaceById(placeId);
    if (!p) return;
    setPlace(p);

    try {
      const { data: supaReviews, error } = await supabase
        .from('reviews')
        .select(`
          *,
          user:users(full_name, avatar_url)
        `)
        .eq('place_id', placeId)
        .order('created_at', { ascending: false });

      if (!error && supaReviews && supaReviews.length > 0) {
        setReviews(supaReviews as any);
      } else {
        setReviews(store.getReviewsForPlace(placeId));
      }
    } catch {
      setReviews(store.getReviewsForPlace(placeId));
    }

    try {
      const { data: supaCheckins, error: checkinErr } = await supabase
        .from('checkins')
        .select('*')
        .eq('place_id', placeId)
        .order('created_at', { ascending: false });

      if (!checkinErr && supaCheckins) {
        setCheckins(supaCheckins);
        store.syncPlaceCheckins(placeId, supaCheckins);
      } else {
        setCheckins(store.getCheckinsForPlace(placeId));
      }
    } catch {
      setCheckins(store.getCheckinsForPlace(placeId));
    }

    setIsFavorite(store.isFavorite(placeId, currentUser?.id));
    setSimilarPlaces(store.getSimilarPlaces(placeId, 3));
  };

  useEffect(() => {
    store.incrementView(placeId);
    refreshData();
  }, [placeId, currentUser]);

  if (!place) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-800">Không tìm thấy địa điểm</h2>
        <p className="text-sm text-gray-500 mt-1">Địa điểm này có thể đã bị xóa hoặc đang chờ duyệt.</p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-burgundy text-white font-semibold text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại bản đồ
        </Link>
      </div>
    );
  }

  // Favorite toggle
  const handleToggleFavorite = () => {
    if (!currentUser) {
      showToast('Vui lòng đăng nhập để lưu địa điểm yêu thích!', 'info');
      router.push(`/dang-nhap?redirect=/dia-diem/${placeId}`);
      return;
    }
    const nextState = store.toggleFavorite(place.id, currentUser.id);
    setIsFavorite(nextState);
    showToast(
      nextState ? `Đã lưu "${place.name}" vào danh sách yêu thích!` : `Đã bỏ lưu "${place.name}"`,
      'info'
    );
  };

  const handleOpenCheckin = () => {
    if (!currentUser) {
      showToast('Vui lòng đăng nhập để báo độ đông (check-in)!', 'info');
      router.push(`/dang-nhap?redirect=/dia-diem/${placeId}`);
      return;
    }
    setIsCheckinOpen(true);
  };

  const handleOpenReview = () => {
    if (!currentUser) {
      showToast('Vui lòng đăng nhập để viết đánh giá!', 'info');
      router.push(`/dang-nhap?redirect=/dia-diem/${placeId}`);
      return;
    }
    setIsReviewOpen(true);
  };

  // Share handler
  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `STUDYSPOT FTU - ${place.name}`,
          text: `Xem địa điểm học tập ${place.name} gần Đại học Ngoại thương`,
          url: shareUrl,
        });
      } catch (e) {
        // Ignored
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      showToast('Đã sao chép link địa điểm vào bộ nhớ tạm!', 'success');
    }
  };

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;

  // Helpful button toggle
  const handleToggleHelpful = (revId: string) => {
    const res = store.toggleHelpfulReview(revId);
    refreshData();
    showToast(res.helpful ? 'Đã thích đánh giá hữu ích!' : 'Đã bỏ thích đánh giá', 'info');
  };

  // Submit report
  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReviewTarget) return;

    const res = store.reportReview(reportReviewTarget.id, reportReason);
    setReportReviewTarget(null);
    setReportReason('Nội dung không phù hợp');
    showToast(res.message, 'success');
  };

  // Criteria averages
  const getCriteriaAvg = (key: keyof Review) => {
    const valid = reviews.filter((r) => typeof r[key] === 'number');
    if (valid.length === 0) return 4.8;
    const sum = valid.reduce((acc, r) => acc + (r[key] as number), 0);
    return Math.round((sum / valid.length) * 10) / 10;
  };

  const avgWifi = getCriteriaAvg('wifi_rating');
  const avgOutlet = getCriteriaAvg('outlet_rating');
  const avgQuiet = getCriteriaAvg('quiet_rating');
  const avgPrice = getCriteriaAvg('price_rating');
  const avgSpace = getCriteriaAvg('space_rating');

  const handleDeleteReview = async (revId: string) => {
    if (confirm('Bạn có chắc muốn xóa đánh giá này?')) {
      try {
        await supabase.from('reviews').delete().eq('id', revId);
      } catch (e) {}
      store.deleteReview(revId);
      await refreshData();
      showToast('Đã xóa đánh giá', 'info');
    }
  };

  const handleStartEdit = (rev: Review) => {
    setEditingReviewId(rev.id);
    setEditContent(rev.content);
    setEditRating(rev.rating);
  };

  const handleSaveEdit = async (revId: string) => {
    try {
      await supabase.from('reviews').update({ content: editContent, rating: editRating }).eq('id', revId);
    } catch (e) {}
    store.updateReview(revId, editContent, editRating);
    setEditingReviewId(null);
    await refreshData();
    showToast('Cập nhật đánh giá thành công!', 'success');
  };

  const filteredReviews = reviews.filter((r) =>
    selectedStarFilter === 'all' ? true : r.rating === selectedStarFilter
  );

  const hourlyCrowdData = store.getHourlyCrowdData(place.id, checkins);
  const priceSymbol = '$'.repeat(place.price_level || 2);
  const priceText =
    place.price_level === 1 ? '< 30.000đ (Giá sinh viên)' :
    place.price_level === 2 ? '30.000đ - 50.000đ' :
    place.price_level === 3 ? '50.000đ - 70.000đ' : '> 70.000đ';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8 pb-24 md:pb-12"
    >
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-burgundy transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại bản đồ
        </Link>
      </div>

      {/* Gallery Section */}
      <ImageGallery images={place.images} placeName={place.name} />

      {/* Main Info Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 border-b border-border pb-6">
        <div className="space-y-3 flex-1">
          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-burgundy-light text-burgundy">
              {place.category?.name || 'Quán Cà Phê'}
            </span>

            {/* Real-time Crowd Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold shadow-sm ${
                place.crowd_status === 'empty'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : place.crowd_status === 'medium'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : place.crowd_status === 'full'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-gray-100 text-gray-800 border border-gray-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full animate-pulse bg-current"></span>
              <span>Độ đông: {place.crowd_label}</span>
              {place.crowd_score && (
                <span className="text-[10px] opacity-75">({place.crowd_score.toFixed(1)}/3)</span>
              )}
            </div>

            {/* Open / Closed Badge */}
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                place.is_open
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {place.is_open ? '● Đang mở cửa' : '○ Đang đóng cửa'}
            </span>

            {place.is_late_night && (
              <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                <Moon className="w-3 h-3" /> Mở muộn
              </span>
            )}
          </div>

          {/* Place Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            {place.name}
          </h1>

          {/* Location & FTU Distance */}
          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-sm text-text-secondary">
            <span className="flex items-center gap-1 text-gray-700 font-medium">
              <MapPin className="w-4 h-4 text-burgundy flex-shrink-0" />
              {place.address}
            </span>
            <span className="text-gray-300">•</span>
            <span className="font-semibold text-burgundy bg-burgundy-light px-2 py-0.5 rounded text-xs">
              Cách cổng FTU: {place.distance_meters ? formatDistance(place.distance_meters) : '150m'}
            </span>
          </div>

          {/* Rating Summary */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex items-center text-amber-500 font-bold text-lg">
              <Star className="w-5 h-5 fill-amber-500 mr-1" />
              {place.average_rating || 4.8}
            </div>
            <span className="text-sm text-gray-500">
              ({place.review_count || reviews.length} lượt đánh giá từ FTUer)
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-sm text-gray-500">{place.view_count} lượt xem</span>
          </div>
        </div>

        {/* Action Buttons Column */}
        <div className="flex flex-wrap sm:flex-nowrap lg:flex-col gap-2.5 flex-shrink-0">
          <button
            onClick={handleOpenCheckin}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-burgundy text-white font-bold text-sm hover:bg-burgundy-hover transition-colors shadow-sm"
          >
            <Users className="w-4 h-4" /> Báo độ đông (Check-in)
          </button>

          <button
            onClick={handleOpenReview}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-burgundy text-burgundy font-bold text-sm hover:bg-burgundy-light transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" /> Viết đánh giá
          </button>

          <div className="flex items-center gap-2 w-full">
            <button
              onClick={handleToggleFavorite}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                isFavorite
                  ? 'border-rose-300 bg-rose-50 text-rose-600'
                  : 'border-border text-gray-700 hover:bg-slate-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500' : ''}`} />
              {isFavorite ? 'Đã lưu' : 'Yêu thích'}
            </button>

            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-xs font-semibold text-gray-700 hover:bg-slate-50 transition-colors"
            >
              <Share2 className="w-4 h-4" /> Chia sẻ
            </button>

            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-xs font-semibold text-gray-700 hover:bg-slate-50 transition-colors"
            >
              <Navigation className="w-4 h-4 text-burgundy" /> Chỉ đường
            </a>
          </div>
        </div>
      </div>

      {/* Main Body Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Details, Hourly Chart, Reviews */}
        <div className="lg:col-span-2 space-y-8">
          {/* Description */}
          <div className="bg-white p-6 rounded-2xl border border-border shadow-soft space-y-3">
            <h3 className="text-base font-bold text-gray-900">Giới thiệu không gian</h3>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {place.description || 'Không gian học tập yên tĩnh, thoáng mát, thích hợp làm việc nhóm và ôn thi gần trường ĐH Ngoại thương.'}
            </p>
          </div>

          {/* Phase 1 Feature: Hourly Crowd Chart */}
          <HourlyCrowdChart
            data={hourlyCrowdData}
            placeId={place.id}
            isAdmin={currentUser?.role === 'admin'}
            onDataUpdated={refreshData}
          />

          {/* Amenities Grid */}
          <div className="bg-white p-6 rounded-2xl border border-border shadow-soft space-y-4">
            <h3 className="text-base font-bold text-gray-900">Tiện ích học tập có sẵn</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {place.amenities?.map((am) => (
                <div
                  key={am.id}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-border/80 text-xs font-semibold text-gray-800"
                >
                  <div className="w-7 h-7 rounded-lg bg-burgundy-light text-burgundy flex items-center justify-center flex-shrink-0">
                    {am.id === 1 && <Wifi className="w-4 h-4" />}
                    {am.id === 2 && <Zap className="w-4 h-4" />}
                    {am.id === 3 && <Users className="w-4 h-4" />}
                    {am.id === 4 && <VolumeX className="w-4 h-4" />}
                    {am.id === 5 && <Wind className="w-4 h-4" />}
                    {am.id === 6 && <Bike className="w-4 h-4" />}
                    {am.id === 7 && <Tag className="w-4 h-4" />}
                    {am.id === 8 && <Moon className="w-4 h-4" />}
                  </div>
                  <span>{am.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* REVIEWS & RATINGS SECTION */}
          <div className="bg-white p-6 rounded-2xl border border-border shadow-soft space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Đánh giá từ cộng đồng FTU</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tổng hợp từ sinh viên thực tế đã học tập tại quán
                </p>
              </div>
              <button
                onClick={handleOpenReview}
                className="px-3.5 py-1.5 rounded-xl bg-burgundy text-white text-xs font-bold hover:bg-burgundy-hover transition-colors"
              >
                + Viết đánh giá
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

            {/* Filter by stars */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <span className="text-xs font-semibold text-gray-500 mr-1">Lọc:</span>
              {(['all', 5, 4, 3, 2, 1] as (number | 'all')[]).map((starVal) => (
                <button
                  key={starVal}
                  type="button"
                  onClick={() => setSelectedStarFilter(starVal)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    selectedStarFilter === starVal
                      ? 'bg-burgundy text-white font-bold'
                      : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                  }`}
                >
                  {starVal === 'all' ? 'Tất cả' : `${starVal} ⭐`}
                </button>
              ))}
            </div>

            {/* Reviews List with Helpful & Report buttons */}
            <div className="space-y-4">
              {filteredReviews.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center italic">
                  Chưa có đánh giá nào cho mức sao này.
                </p>
              ) : (
                filteredReviews.map((rev) => {
                  const isOwnReview = currentUser?.id === rev.user_id || currentUser?.role === 'admin';
                  const isEditing = editingReviewId === rev.id;

                  return (
                    <div
                      key={rev.id}
                      className="p-4 rounded-xl border border-border bg-white space-y-2 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={rev.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
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
                                className="p-1"
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
                            className="w-full p-2.5 rounded-lg border border-border text-xs focus:outline-none focus:border-burgundy"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditingReviewId(null)}
                              className="px-3 py-1 rounded text-xs text-gray-600 hover:bg-slate-100"
                            >
                              Hủy
                            </button>
                            <button
                              onClick={() => handleSaveEdit(rev.id)}
                              className="px-3 py-1 rounded text-xs bg-burgundy text-white font-bold"
                            >
                              Lưu
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

                      {/* Phase 1: Helpful button & Report button */}
                      {!isEditing && (
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleHelpful(rev.id)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
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
                                onClick={() => setReportReviewTarget(rev)}
                                className="text-gray-400 hover:text-rose-600 text-xs font-medium flex items-center gap-1 transition-colors"
                              >
                                <Flag className="w-3.5 h-3.5" /> Báo cáo
                              </button>
                            )}
                          </div>

                          {/* Edit / Delete actions for own review */}
                          {isOwnReview && (
                            <div className="flex items-center gap-3 text-[11px]">
                              <button
                                onClick={() => handleStartEdit(rev)}
                                className="text-gray-500 hover:text-burgundy flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" /> Sửa
                              </button>
                              <button
                                onClick={() => handleDeleteReview(rev.id)}
                                className="text-rose-500 hover:text-rose-700 flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Xóa
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Phase 1: Similar places near this spot */}
          <SimilarPlaces places={similarPlaces} />
        </div>

        {/* Right Column (1 Col): Practical Specs & Mini Map */}
        <div className="space-y-6">
          {/* Operating Specs Card */}
          <div className="bg-white p-6 rounded-2xl border border-border shadow-soft space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-burgundy" /> Giờ mở cửa & Mức giá
            </h3>

            {/* Price Level */}
            <div className="p-3 rounded-xl bg-slate-50 border border-border">
              <div className="text-xs text-gray-500">Mức giá trung bình:</div>
              <div className="text-sm font-bold text-gray-900 mt-0.5">
                <span className="font-mono text-burgundy mr-1.5">{priceSymbol}</span>
                {priceText}
              </div>
            </div>

            {/* Opening hours table */}
            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-gray-700 mb-1">Lịch hoạt động trong tuần:</div>
              {[
                { day: 'Thứ Hai', schedule: place.opening_hours?.monday },
                { day: 'Thứ Ba', schedule: place.opening_hours?.tuesday },
                { day: 'Thứ Tư', schedule: place.opening_hours?.wednesday },
                { day: 'Thứ Năm', schedule: place.opening_hours?.thursday },
                { day: 'Thứ Sáu', schedule: place.opening_hours?.friday },
                { day: 'Thứ Bảy', schedule: place.opening_hours?.saturday },
                { day: 'Chủ Nhật', schedule: place.opening_hours?.sunday },
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 border-b border-gray-100 last:border-none">
                  <span className="text-gray-600">{item.day}</span>
                  <span className="font-semibold text-gray-900">
                    {place.opening_hours?.is_24h
                      ? 'Cả ngày (24/7)'
                      : item.schedule?.is_closed
                      ? 'Nghỉ'
                      : item.schedule?.open && item.schedule?.close
                      ? `${item.schedule.open} - ${item.schedule.close}`
                      : '07:00 - 23:00'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mini Map Card (Free OpenStreetMap Tiles) */}
          <div className="bg-white p-6 rounded-2xl border border-border shadow-soft space-y-3">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-burgundy" /> Vị trí trên bản đồ
            </h3>
            <div className="h-64 rounded-xl overflow-hidden border border-border">
              <StudyMap
                places={[place]}
                selectedPlaceId={place.id}
                height="100%"
                minHeight="240px"
              />
            </div>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-gray-800 text-xs font-bold transition-colors"
            >
              <Navigation className="w-3.5 h-3.5 text-burgundy" />
              Mở chỉ đường trong Google Maps
            </a>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CheckinModal
        isOpen={isCheckinOpen}
        onClose={() => setIsCheckinOpen(false)}
        placeId={place.id}
        placeName={place.name}
        onCheckinSuccess={refreshData}
      />

      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        placeId={place.id}
        placeName={place.name}
        onReviewSuccess={refreshData}
      />

      {/* Phase 1: Review Report Modal */}
      {reportReviewTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-elevated border border-border p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <Flag className="w-4 h-4" /> Báo cáo đánh giá vi phạm
              </div>
              <button onClick={() => setReportReviewTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">Lý do báo cáo vi phạm:</label>
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
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-gray-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
                >
                  Gửi báo cáo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
