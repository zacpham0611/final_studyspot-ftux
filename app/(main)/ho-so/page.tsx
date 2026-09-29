'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { store } from '@/lib/data/store';
import { UserProfile, Review, Checkin, Place } from '@/lib/types/database';
import { useToast } from '@/components/common/Toast';
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
  ArrowRight
} from 'lucide-react';

export default function ProfilePage() {
  const { showToast } = useToast();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'reviews' | 'checkins' | 'proposals'>('reviews');

  // Stats
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [myCheckins, setMyCheckins] = useState<Checkin[]>([]);
  const [myProposals, setMyProposals] = useState<Place[]>([]);

  // Avatar edit
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [showAvatarInput, setShowAvatarInput] = useState(false);

  const loadProfile = () => {
    const user = store.getCurrentUser();
    setCurrentUser(user);

    if (user) {
      // Find reviews by this user
      const allReviews = store.getAllReviewsAdmin();
      setMyReviews(allReviews.filter((r) => r.user_id === user.id));

      // Find proposals by this user
      const allPlaces = store.getAllPlacesAdmin();
      setMyProposals(allPlaces.filter((p) => p.created_by === user.id || p.id.startsWith('p-')));

      // Checkins
      setMyCheckins(store.getCheckinsForPlace('p-1')); // sample user checkins
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpdateAvatar = () => {
    if (currentUser && newAvatarUrl.trim()) {
      const updated = { ...currentUser, avatar_url: newAvatarUrl.trim() };
      store.setCurrentUser(updated);
      setCurrentUser(updated);
      setShowAvatarInput(false);
      setNewAvatarUrl('');
      showToast('Cập nhật ảnh đại diện thành công!', 'success');
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <User className="w-12 h-12 text-gray-400 mx-auto" />
        <h2 className="text-xl font-bold">Vui lòng đăng nhập</h2>
        <Link
          href="/dang-nhap"
          className="inline-block px-4 py-2 rounded-xl bg-burgundy text-white font-bold text-xs"
        >
          Đến trang đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24 md:pb-12">
      {/* Profile Card Header */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-border shadow-soft flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="relative group">
          <img
            src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
            alt={currentUser.full_name}
            className="w-24 h-24 rounded-2xl object-cover ring-4 ring-burgundy/10 shadow-md"
          />
          <button
            onClick={() => setShowAvatarInput(!showAvatarInput)}
            className="absolute -bottom-2 -right-2 p-2 bg-burgundy text-white rounded-xl shadow-md hover:bg-burgundy-hover transition-colors"
            title="Đổi ảnh đại diện"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 text-center sm:text-left space-y-1">
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

          <p className="text-[11px] text-gray-400 flex items-center justify-center sm:justify-start gap-1 pt-1">
            <Calendar className="w-3.5 h-3.5" />
            Tham gia: {new Date(currentUser.created_at).toLocaleDateString('vi-VN')}
          </p>

          {/* Avatar edit input popup */}
          {showAvatarInput && (
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-border flex gap-2">
              <input
                type="url"
                placeholder="Dán link ảnh đại diện mới..."
                value={newAvatarUrl}
                onChange={(e) => setNewAvatarUrl(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-border text-xs focus:outline-none focus:border-burgundy"
              />
              <button
                onClick={handleUpdateAvatar}
                className="px-3 py-1.5 bg-burgundy text-white text-xs font-bold rounded-lg"
              >
                Lưu
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3 Tabs Container */}
      <div className="bg-white rounded-2xl border border-border shadow-soft overflow-hidden">
        {/* Tab Headers */}
        <div className="grid grid-cols-3 border-b border-border bg-slate-50 text-center font-bold text-xs">
          <button
            onClick={() => setActiveTab('reviews')}
            className={`py-3.5 flex items-center justify-center gap-1.5 transition-colors ${
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
            className={`py-3.5 flex items-center justify-center gap-1.5 transition-colors ${
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
            className={`py-3.5 flex items-center justify-center gap-1.5 transition-colors ${
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
