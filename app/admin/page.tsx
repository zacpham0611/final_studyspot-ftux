'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { store } from '@/lib/data/store';
import { Place } from '@/lib/types/database';
import { 
  MapPin, 
  Eye, 
  Users, 
  Inbox, 
  MessageSquare, 
  ArrowRight, 
  Clock, 
  Sparkles,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalPlaces: 0,
    approvedPlaces: 0,
    totalReviews: 0,
    todayCheckins: 0,
    pendingProposals: 0,
    pendingReports: 0,
    totalViews: 0,
    totalUsers: 0,
  });

  const [topPlaces, setTopPlaces] = useState<Place[]>([]);
  const [pendingList, setPendingList] = useState<Place[]>([]);
  const [activityDays, setActivityDays] = useState<{ date: string; label: string; checkins: number; reviews: number }[]>([]);

  useEffect(() => {
    const updateStats = () => {
      setStats(store.getAdminStats());
      setTopPlaces(store.getTopPlaces(5));
      setActivityDays(store.getLast14DaysActivity());
      setPendingList(store.getAllPlacesAdmin().filter((p) => p.status === 'pending'));
    };

    updateStats();
    store.loadFromSupabase().then(updateStats);
  }, []);

  // Compute max count for chart scaling
  const maxActivity = Math.max(
    15,
    ...activityDays.map((d) => Math.max(d.checkins, d.reviews))
  );

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Bảng điều khiển Quản trị</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Giám sát hoạt động, số liệu check-in, đánh giá và kiểm duyệt địa điểm quanh ĐH Ngoại thương
        </p>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-2xl border border-border shadow-soft flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-burgundy-light text-burgundy flex items-center justify-center flex-shrink-0">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Tổng địa điểm</div>
            <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{stats.approvedPlaces}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Tổng số trong DB: {stats.totalPlaces}</div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-2xl border border-border shadow-soft flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Tổng người dùng</div>
            <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{stats.totalUsers}</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Cộng đồng FTUer</div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-2xl border border-border shadow-soft flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Tổng đánh giá</div>
            <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{stats.totalReviews}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">5 tiêu chí chi tiết</div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded-2xl border border-border shadow-soft flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Check-in hôm nay</div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-0.5">{stats.todayCheckins}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Độ đông thực tế</div>
          </div>
        </div>
      </div>

      {/* Section: 14 Days Activity Chart */}
      <div className="bg-white p-6 rounded-2xl border border-border shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-burgundy" /> Thống kê hoạt động 14 ngày gần nhất
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Số lượt check-in báo độ đông và đánh giá mới gửi lên hệ thống
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-burgundy">
              <span className="w-3 h-3 rounded-sm bg-burgundy"></span> Check-in
            </span>
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-3 h-3 rounded-sm bg-blue-500"></span> Đánh giá
            </span>
          </div>
        </div>

        {/* SVG/HTML Bar Chart */}
        <div className="overflow-x-auto no-scrollbar pt-2">
          <div className="min-w-[600px] h-44 flex items-end justify-between gap-2 border-b border-border px-2 pb-1">
            {activityDays.map((d, idx) => {
              const checkinHeight = ((d.checkins / maxActivity) * 100);
              const reviewHeight = ((d.reviews / maxActivity) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-10 bg-gray-900 text-white text-[10px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {d.label}: {d.checkins} check-in, {d.reviews} review
                  </div>

                  {/* Dual Bars */}
                  <div className="w-full flex items-end justify-center gap-1 h-full">
                    <div
                      style={{ height: `${checkinHeight}%` }}
                      className="w-3 bg-burgundy rounded-t hover:bg-burgundy-hover transition-all"
                    ></div>
                    <div
                      style={{ height: `${reviewHeight}%` }}
                      className="w-3 bg-blue-500 rounded-t hover:bg-blue-600 transition-all"
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="min-w-[600px] flex justify-between text-[10px] text-gray-400 pt-2 px-2 font-mono">
            {activityDays.map((d, idx) => (
              <span key={idx} className="w-8 text-center">{d.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Tasks requiring attention & Top 5 places */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Khối "Cần xử lý" */}
        <div className="bg-white rounded-2xl border border-border shadow-soft p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-burgundy" /> Cần xử lý ngay
            </h3>
            <span className="text-[11px] font-semibold text-gray-400">Hàng chờ kiểm duyệt</span>
          </div>

          <div className="space-y-3">
            {/* Pending Proposals Card */}
            <Link
              href="/admin/de-xuat"
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-amber-50/50 hover:bg-amber-50 hover:border-amber-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900">Đề xuất địa điểm chờ duyệt</div>
                  <div className="text-xs text-gray-500">Do sinh viên gửi lên cần xét duyệt</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold text-amber-700">{stats.pendingProposals}</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>

            {/* Pending Reports Card */}
            <Link
              href="/admin/danh-gia"
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-rose-50/50 hover:bg-rose-50 hover:border-rose-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900">Báo cáo đánh giá vi phạm</div>
                  <div className="text-xs text-gray-500">Các đánh giá bị người dùng gắn cờ</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold text-rose-700">{stats.pendingReports}</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          </div>

          {/* Danh sách đề xuất cần duyệt gấp */}
          {pendingList.length > 0 && (
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-900 flex items-center gap-1.5">
                  <Inbox className="w-3.5 h-3.5 text-amber-600" /> Đề xuất cần duyệt gấp ({pendingList.length})
                </span>
                <Link href="/admin/de-xuat" className="text-[11px] font-bold text-burgundy hover:underline">
                  Vào trang duyệt
                </Link>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pendingList.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl border border-amber-200/80 bg-amber-50/40 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={p.images[0] || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=100&q=80'}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover ring-1 ring-amber-200"
                      />
                      <div className="truncate">
                        <div className="font-bold text-gray-900 truncate">{p.name}</div>
                        <div className="text-[10px] text-gray-500 truncate">{p.address}</div>
                      </div>
                    </div>
                    <Link
                      href="/admin/de-xuat"
                      className="px-2.5 py-1 rounded-lg bg-burgundy text-white text-[11px] font-bold hover:bg-burgundy-hover flex-shrink-0"
                    >
                      Xét duyệt
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bảng Top 5 địa điểm */}
        <div className="bg-white rounded-2xl border border-border shadow-soft p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-burgundy" /> Top 5 địa điểm nổi bật
            </h3>
            <Link href="/admin/dia-diem" className="text-xs font-bold text-burgundy hover:underline">
              Xem tất cả
            </Link>
          </div>

          <div className="divide-y divide-border text-xs">
            {topPlaces.map((p, idx) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    idx === 0 ? 'bg-amber-100 text-amber-800' :
                    idx === 1 ? 'bg-slate-200 text-gray-800' :
                    idx === 2 ? 'bg-orange-100 text-orange-800' : 'text-gray-400'
                  }`}>
                    {idx + 1}
                  </span>
                  <img
                    src={p.images[0] || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=100&q=80'}
                    alt=""
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                  <div className="truncate">
                    <div className="font-bold text-gray-900 truncate">{p.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">{p.address}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right flex-shrink-0">
                  <div>
                    <span className="font-bold text-gray-900">{p.view_count}</span>
                    <span className="text-[10px] text-gray-400 block">lượt xem</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
