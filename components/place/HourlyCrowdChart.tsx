'use client';

import React, { useState, useEffect } from 'react';
import { CrowdStatus } from '@/lib/types/database';
import { Clock, Info, Edit3, Check, X, Loader2 } from 'lucide-react';
import { useToast } from '@/components/common/Toast';

interface HourlyData {
  hour: number;
  label: string;
  score: number;
  level: CrowdStatus;
  count?: number;
}

interface HourlyCrowdChartProps {
  data: HourlyData[];
  placeId?: string;
  isAdmin?: boolean;
  onDataUpdated?: () => void;
}

export function HourlyCrowdChart({ data, placeId, isAdmin, onDataUpdated }: HourlyCrowdChartProps) {
  const currentHour = new Date().getHours();
  const { showToast } = useToast();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Optimistic UI state: initialized from data prop
  const [chartData, setChartData] = useState<HourlyData[]>(data);

  // Sync internal chart data when external data changes
  useEffect(() => {
    setChartData(data);
  }, [data]);

  const [editLevels, setEditLevels] = useState<{ [hour: number]: number }>(() => {
    const initial: { [hour: number]: number } = {};
    for (let h = 7; h <= 22; h++) {
      const match = data.find((d) => d.hour === h);
      if (match && match.score > 0) {
        initial[h] = Math.round(match.score);
      } else {
        initial[h] = 1;
      }
    }
    return initial;
  });

  // Keep editLevels aligned with latest chartData
  useEffect(() => {
    setEditLevels((prev) => {
      const updated = { ...prev };
      for (let h = 7; h <= 22; h++) {
        const match = chartData.find((d) => d.hour === h);
        if (match && match.score > 0) {
          updated[h] = Math.round(match.score);
        }
      }
      return updated;
    });
  }, [chartData]);

  // Check if any hour has actual check-in data
  const hasData = chartData && chartData.length > 0 && chartData.some((d) => d.score > 0 || (d.count && d.count > 0));

  // Find dynamic quietest period (lowest score > 0)
  const itemsWithLogs = chartData.filter((d) => d.score > 0);
  const quietest = itemsWithLogs.length > 0
    ? itemsWithLogs.reduce((prev, curr) => (curr.score < prev.score ? curr : prev), itemsWithLogs[0])
    : null;

  const getColor = (level: CrowdStatus) => {
    switch (level) {
      case 'empty':
        return 'bg-emerald-500 hover:bg-emerald-600';
      case 'medium':
        return 'bg-amber-500 hover:bg-amber-600';
      case 'full':
        return 'bg-rose-500 hover:bg-rose-600';
      default:
        return 'bg-slate-200';
    }
  };

  const handleSaveAdminData = async () => {
    if (!placeId) return;

    // 1. Snapshot previous state for rollback if error occurs
    const previousChartData = [...chartData];
    const previousEditLevels = { ...editLevels };

    // 2. Prepare payload for all hours 07:00–22:00 (1 single batch payload)
    const payload = Object.entries(editLevels).map(([h, lvl]) => ({
      hour: parseInt(h, 10),
      level: lvl,
    }));

    // 3. Optimistic UI update: instantly update UI bars and stats
    const optimisticChartData: HourlyData[] = Array.from({ length: 16 }, (_, i) => i + 7).map((h) => {
      const lvl = editLevels[h] || 1;
      const status: CrowdStatus = lvl <= 1 ? 'empty' : lvl === 2 ? 'medium' : 'full';
      return {
        hour: h,
        label: `${h}:00`,
        score: lvl,
        level: status,
        count: 1,
      };
    });

    setChartData(optimisticChartData);
    setSaving(true);

    try {
      // 4. Send EXACTLY ONE HTTP request with batch payload
      const res = await fetch('/api/checkins/hourly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId,
          hourlyData: payload,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Lỗi cập nhật dữ liệu độ đông');
      }

      // Success: maintain optimistic state, close modal, notify user
      showToast('Đã cập nhật dữ liệu độ đông thành công!', 'success');
      setIsEditModalOpen(false);

      // Targeted refetch of only checkins data if callback provided
      if (onDataUpdated) {
        onDataUpdated();
      }
    } catch (err: any) {
      console.error('Hourly update error:', err);
      // 5. Rollback on error
      setChartData(previousChartData);
      setEditLevels(previousEditLevels);
      showToast(err.message || 'Không thể lưu dữ liệu độ đông. Đã hoàn tác!', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-border shadow-soft space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-burgundy" /> Độ đông trung bình theo giờ
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Dựa trên phân tích lịch sử check-in của FTUer từ 07:00 đến 22:00
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasData && quietest && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <Info className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Thường vắng nhất: {quietest.hour}:00 - {quietest.hour + 1}:00
              </span>
            </div>
          )}

          {isAdmin && placeId && (
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-burgundy-light text-burgundy hover:bg-burgundy hover:text-white transition-colors text-xs font-bold cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Chỉnh sửa dữ liệu (Admin)</span>
            </button>
          )}
        </div>
      </div>

      {/* Case 1: No Check-in Data -> Empty State (No chart, no fake quietest badge) */}
      {!hasData ? (
        <div className="text-center py-10 space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-gray-400 flex items-center justify-center mx-auto shadow-inner">
            <Clock className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-gray-700">Chưa có dữ liệu độ đông</h4>
          <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            Địa điểm này chưa ghi nhận lượt check-in nào. Hãy là người đầu tiên báo độ đông khi bạn ghé quán!
          </p>
        </div>
      ) : (
        /* Case 2: Has Check-in Data -> Render Dynamic Histogram */
        <>
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Vắng (&lt; 1.67)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Vừa (1.67 - 2.33)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Đông (&gt; 2.33)
            </span>
          </div>

          {/* Histogram Bar Chart */}
          <div className="pt-4 pb-2 overflow-x-auto no-scrollbar">
            <div className="min-w-[540px] flex items-end justify-between gap-1.5 h-36 border-b border-border px-1 pb-1">
              {chartData.map((item) => {
                const isCurrent = item.hour === currentHour;
                const hasItemData = item.score > 0;
                const heightPercent = hasItemData
                  ? Math.min(95, Math.max(25, ((item.score - 0.8) / 2.2) * 95))
                  : 8;

                return (
                  <div
                    key={item.hour}
                    className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-8 bg-gray-900 text-white text-[10px] font-bold py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {hasItemData
                        ? `${item.label}: ${item.score} (${item.level === 'empty' ? 'Vắng' : item.level === 'medium' ? 'Vừa' : 'Đông'})`
                        : `${item.label}: Chưa có lượt check-in`}
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[24px] rounded-t-md transition-all duration-300 ${
                        hasItemData ? getColor(item.level) : 'bg-slate-100 border border-slate-200'
                      } ${isCurrent && hasItemData ? 'ring-2 ring-burgundy shadow-md scale-105' : ''}`}
                    ></div>

                    {/* Current hour marker indicator */}
                    {isCurrent && (
                      <div className="absolute -bottom-5 w-1.5 h-1.5 rounded-full bg-burgundy"></div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Hour labels */}
            <div className="min-w-[540px] flex justify-between text-[10px] text-gray-500 pt-2 px-1 font-mono">
              {chartData.map((item) => {
                const isCurrent = item.hour === currentHour;
                return (
                  <span
                    key={item.hour}
                    className={`w-6 text-center ${
                      isCurrent ? 'font-bold text-burgundy scale-110' : ''
                    }`}
                  >
                    {item.hour}h
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Admin Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-elevated border border-border p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h4 className="font-extrabold text-sm text-gray-900">Thiết lập độ đông theo giờ (Admin)</h4>
                <p className="text-xs text-gray-500">Dữ liệu sẽ được lưu trực tiếp vào bảng checkins trên Supabase.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {Array.from({ length: 16 }, (_, i) => i + 7).map((h) => {
                const currentVal = editLevels[h] || 1;
                return (
                  <div key={h} className="p-2 border border-border rounded-xl flex items-center justify-between bg-slate-50">
                    <span className="font-bold font-mono">{h}:00</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditLevels((prev) => ({ ...prev, [h]: 1 }))}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          currentVal === 1 ? 'bg-emerald-500 text-white shadow-xs' : 'bg-white text-gray-600 border border-border'
                        }`}
                      >
                        Vắng
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditLevels((prev) => ({ ...prev, [h]: 2 }))}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          currentVal === 2 ? 'bg-amber-500 text-white shadow-xs' : 'bg-white text-gray-600 border border-border'
                        }`}
                      >
                        Vừa
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditLevels((prev) => ({ ...prev, [h]: 3 }))}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          currentVal === 3 ? 'bg-rose-500 text-white shadow-xs' : 'bg-white text-gray-600 border border-border'
                        }`}
                      >
                        Đông
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-gray-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveAdminData}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-burgundy hover:bg-burgundy-hover text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Lưu lên Supabase</span>
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
