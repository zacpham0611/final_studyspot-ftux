'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { store } from '@/lib/data/store';
import { UserProfile, Review, Checkin, Place } from '@/lib/types/database';
import { useToast } from '@/components/common/Toast';
import { supabase } from '@/lib/supabase/client';
import { 
  User, 
  Mail, 
  Calendar, 
  Star, 
  Users, 
  PlusCircle, 
  Camera, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  MapPin, 
  ArrowRight,
  Upload,
  Loader2
} from 'lucide-react';

import { useAuth } from '@/components/auth/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';

function ProfileContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user: currentUser, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'reviews' | 'checkins' | 'proposals'>('reviews');

  // Stats
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [myCheckins, setMyCheckins] = useState<Checkin[]>([]);
  const [myProposals, setMyProposals] = useState<Place[]>([]);

  // Avatar Upload States
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const loadProfile = async () => {
    if (!currentUser) return;
    try {
      // 1. Fetch live reviews by this user from Supabase
      const { data: dbReviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (dbReviews && dbReviews.length > 0) {
        setMyReviews(dbReviews);
      } else {
        const allReviews = store.getAllReviewsAdmin();
        setMyReviews(allReviews.filter((r) => r.user_id === currentUser.id));
      }

      // 2. Fetch live proposals by this user from Supabase
      const { data: dbPlaces } = await supabase
        .from('places')
        .select('*')
        .eq('created_by', currentUser.id)
        .order('created_at', { ascending: false });

      if (dbPlaces && dbPlaces.length > 0) {
        setMyProposals(dbPlaces);
      } else {
        const allPlaces = store.getAllPlacesAdmin();
        setMyProposals(allPlaces.filter((p) => p.created_by === currentUser.id));
      }

      // 3. Fetch checkins from Supabase
      const { data: dbCheckins } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (dbCheckins && dbCheckins.length > 0) {
        setMyCheckins(dbCheckins);
      } else {
        setMyCheckins(store.getCheckinsForPlace('p-1'));
      }
    } catch (e) {
      console.warn('Supabase profile load warning:', e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setNameInput(currentUser.full_name);
      loadProfile();
    }
  }, [currentUser]);

  // Trigger file selection dialog
  const handleAvatarClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  // Handle file chosen from device
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Vui lòng chọn một file hình ảnh (JPG, PNG, WEBP,...)', 'error');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Kích thước ảnh tối đa là 5MB', 'error');
      return;
    }

    // 1. Instant preview
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    // 2. Upload file to Supabase Storage
    await handleAvatarUpload(file);

    // Reset input value so same file can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload Logic to Supabase Storage & Database
  const handleAvatarUpload = async (file: File) => {
    if (!currentUser) return;
    setIsUploading(true);

    const userId = currentUser.id;

    try {
      // Send file to server avatar endpoint (uploads to Supabase Storage and updates public.users.avatar_url)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);

      const uploadRes = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await uploadRes.json();
      if (!uploadRes.ok || !uploadResult.success || !uploadResult.avatar_url) {
        throw new Error(uploadResult.error || 'Lỗi xử lý tải ảnh lên máy chủ');
      }

      const finalAvatarUrl = uploadResult.avatar_url;

      // Update AuthContext, Header & Store immediately
      store.updateUserAvatar(userId, finalAvatarUrl);
      await refreshUser();
      setPreviewUrl(finalAvatarUrl);

      showToast('Cập nhật ảnh đại diện thành công!', 'success');
      router.refresh();
    } catch (err: any) {
      console.error('Avatar upload exception:', err);
      // Clean rollback on failure (never keep broken preview)
      setPreviewUrl(null);
      showToast(err.message || 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại!', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  if (!currentUser) {
    return null;
  }

  const displayedAvatar =
    previewUrl ||
    currentUser.avatar_url ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24 md:pb-12">
      {/* Hidden File Input for Device Image Selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Profile Card Header */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-soft flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Avatar Container with Upload & Preview Overlay */}
        <div 
          onClick={handleAvatarClick}
          className="relative group cursor-pointer flex-shrink-0"
          title="Bấm để tải ảnh đại diện từ máy tính"
        >
          <img
            src={displayedAvatar}
            alt={currentUser.full_name}
            className={`w-28 h-28 rounded-2xl object-cover ring-4 ring-burgundy/10 shadow-md transition-all ${
              isUploading ? 'opacity-40 blur-[1px]' : 'group-hover:ring-burgundy/30'
            }`}
          />

          {/* Uploading Spinner Overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/40 rounded-2xl flex flex-col items-center justify-center text-white gap-1.5 z-10">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
              <span className="text-[10px] font-bold tracking-tight">Đang tải...</span>
            </div>
          )}

          {/* Hover Overlay Hint */}
          {!isUploading && (
            <div className="absolute inset-0 bg-black/25 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-6 h-6 text-white drop-shadow-md" />
            </div>
          )}

          {/* Camera Action Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAvatarClick();
            }}
            disabled={isUploading}
            className="absolute -bottom-2 -right-2 p-2.5 bg-burgundy text-white rounded-xl shadow-md hover:bg-burgundy-hover transition-colors z-20 cursor-pointer disabled:opacity-50"
            title="Tải ảnh từ máy tính"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* User Details & Action Button */}
        <div className="flex-1 text-center sm:text-left space-y-1.5">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 className="text-2xl font-extrabold text-gray-900">{currentUser.full_name}</h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-burgundy-light text-burgundy border border-burgundy-border">
              {currentUser.role === 'admin' ? 'Ban Quản Trị' : 'Sinh viên FTU'}
            </span>
          </div>

          <p className="text-xs text-gray-500 flex items-center justify-center sm:justify-start gap-1">
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            {currentUser.email}
          </p>

          <p className="text-[11px] text-gray-400 flex items-center justify-center sm:justify-start gap-1 pt-0.5">
            <Calendar className="w-3.5 h-3.5" />
            Tham gia: {new Date(currentUser.created_at).toLocaleDateString('vi-VN')}
          </p>

          {/* Choose File from Computer Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-gray-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-burgundy" />
                  <span>Đang tải ảnh lên...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-burgundy" />
                  <span>Chọn ảnh từ máy tính</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3 Tabs Container */}
      <div className="bg-white rounded-2xl border border-border shadow-soft overflow-hidden">
        {/* Tab Headers */}
        <div className="grid grid-cols-3 border-b border-border bg-slate-50 text-center font-bold text-xs">
          <button
            onClick={() => setActiveTab('reviews')}
            className={`py-3.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'reviews'
                ? 'bg-white text-burgundy border-b-2 border-burgundy font-extrabold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Star className="w-4 h-4" />
            Đánh giá của tôi ({myReviews.length})
          </button>

          <button
            onClick={() => setActiveTab('checkins')}
            className={`py-3.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'checkins'
                ? 'bg-white text-burgundy border-b-2 border-burgundy font-extrabold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Check-in độ đông ({myCheckins.length})
          </button>

          <button
            onClick={() => setActiveTab('proposals')}
            className={`py-3.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'proposals'
                ? 'bg-white text-burgundy border-b-2 border-burgundy font-extrabold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Đề xuất của tôi ({myProposals.length})
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {/* TAB 1: REVIEWS */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {myReviews.length === 0 ? (
                <p className="text-center py-8 text-xs text-gray-500">
                  Bạn chưa viết đánh giá nào. Hãy ghé thăm các quán và để lại review nhé!
                </p>
              ) : (
                myReviews.map((rev) => (
                  <div key={rev.id} className="p-4 rounded-xl border border-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-amber-500 font-bold">
                        <Star className="w-4 h-4 fill-amber-400" />
                        <span>{rev.rating}/5 sao</span>
                      </div>
                      <span className="text-gray-400 text-[10px]">
                        {new Date(rev.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{rev.content}</p>
                    <Link
                      href={`/dia-diem/${rev.place_id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-burgundy hover:underline pt-1"
                    >
                      Xem trang quán <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: CHECKINS */}
          {activeTab === 'checkins' && (
            <div className="space-y-3">
              {myCheckins.length === 0 ? (
                <p className="text-center py-8 text-xs text-gray-500">
                  Chưa có lượt check-in nào được ghi nhận.
                </p>
              ) : (
                myCheckins.map((chk) => (
                  <div
                    key={chk.id}
                    className="p-3.5 rounded-xl border border-border flex items-center justify-between text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            chk.level === 1
                              ? 'bg-emerald-100 text-emerald-800'
                              : chk.level === 2
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {chk.level === 1 ? '🟢 Vắng' : chk.level === 2 ? '🟡 Vừa' : '🔴 Đông'}
                        </span>
                        <span className="text-gray-600 italic font-medium">"{chk.note || 'Không có ghi chú'}"</span>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {new Date(chk.created_at).toLocaleString('vi-VN')}
                      </div>
                    </div>
                    <Link
                      href={`/dia-diem/${chk.place_id}`}
                      className="text-xs font-bold text-burgundy hover:underline flex items-center gap-0.5"
                    >
                      Chi tiết <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: PROPOSALS */}
          {activeTab === 'proposals' && (
            <div className="space-y-4">
              {myProposals.length === 0 ? (
                <p className="text-center py-8 text-xs text-gray-500">
                  Bạn chưa đề xuất địa điểm nào.
                </p>
              ) : (
                myProposals.map((prop) => (
                  <div
                    key={prop.id}
                    className="p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-sm text-gray-900">{prop.name}</h4>
                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            prop.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : prop.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {prop.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                          {prop.status === 'pending' && <Clock className="w-3 h-3" />}
                          {prop.status === 'rejected' && <XCircle className="w-3 h-3" />}
                          {prop.status === 'approved'
                            ? 'Đã duyệt'
                            : prop.status === 'pending'
                            ? 'Chờ duyệt'
                            : 'Từ chối'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-burgundy" /> {prop.address}
                      </p>
                      {prop.reject_reason && (
                        <p className="text-xs text-rose-600 mt-1 italic">
                          Lý do: {prop.reject_reason}
                        </p>
                      )}
                    </div>

                    <Link
                      href={`/dia-diem/${prop.id}`}
                      className="text-xs font-bold text-burgundy hover:underline flex items-center gap-1 self-start sm:self-center"
                    >
                      Xem trang quán <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
