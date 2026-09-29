'use client';

import React from 'react';
import { CrowdStatus } from '@/lib/types/database';
import { Clock, Info } from 'lucide-react';

interface HourlyData {
  hour: number;
  label: string;
  score: number;
  level: CrowdStatus;
}

interface HourlyCrowdChartProps {
  data: HourlyData[];
}

export function HourlyCrowdChart({ data }: HourlyCrowdChartProps) {
  const currentHour = new Date().getHours();

  // Color mapping
  const getColor = (level: CrowdStatus) => {
    switch (level) {
      case 'empty':
        return 'bg-emerald-500 hover:bg-emerald-600';
      case 'medium':
        return 'bg-amber-500 hover:bg-amber-600';
      case 'full':
        return 'bg-rose-500 hover:bg-rose-600';
      default:
        return 'bg-gray-400 hover:bg-gray-500';
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-border shadow-soft space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-burgundy" /> Độ đông trung bình theo giờ
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Dựa trên phân tích lịch sử check-in của FTUer từ 07:00 đến 22:00
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
          <Info className="w-3.5 h-3.5 text-emerald-600" />
          <span>Thường vắng nhất: 14:00 - 16:00</span>
        </div>
      </div>

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
          {data.map((item) => {
            const isCurrent = item.hour === currentHour;
            // Height proportional to score (scale from 1.0 to 3.0 -> 25% to 95%)
            const heightPercent = Math.min(95, Math.max(25, ((item.score - 0.8) / 2.2) * 95));

            return (
              <div
                key={item.hour}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative"
              >
                {/* Tooltip on hover */}
                <div className="absolute -top-8 bg-gray-900 text-white text-[10px] font-bold py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {item.label}: {item.score} ({item.level === 'empty' ? 'Vắng' : item.level === 'medium' ? 'Vừa' : 'Đông'})
                </div>

                {/* Bar */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full max-w-[24px] rounded-t-md transition-all duration-300 ${getColor(item.level)} ${
                    isCurrent
                      ? 'ring-2 ring-burgundy shadow-md scale-105'
                      : ''
                  }`}
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
          {data.map((item) => {
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
    </div>
  );
}
