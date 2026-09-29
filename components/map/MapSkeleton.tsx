'use client';

import React from 'react';
import { MapPin } from 'lucide-react';

export default function MapSkeleton() {
  return (
    <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-slate-100 text-gray-500 gap-3 animate-pulse">
      <div className="w-12 h-12 rounded-2xl bg-burgundy/10 text-burgundy flex items-center justify-center">
        <MapPin className="w-6 h-6 animate-bounce" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-xs font-bold text-gray-700">Đang tải bản đồ OpenStreetMap FTU...</p>
        <p className="text-[11px] text-gray-400">Vui lòng chờ trong giây lát</p>
      </div>
    </div>
  );
}
