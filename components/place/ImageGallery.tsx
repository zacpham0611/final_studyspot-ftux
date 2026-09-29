'use client';

import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface ImageGalleryProps {
  images: string[];
  placeName: string;
}

export function ImageGallery({ images, placeName }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const displayImages = images && images.length > 0
    ? images
    : ['https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1000&q=80'];

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const prevImage = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + displayImages.length) % displayImages.length);
    }
  };

  const nextImage = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % displayImages.length);
    }
  };

  return (
    <div className="relative">
      {/* 1 Large + 4 Small Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-2xl overflow-hidden h-[340px] md:h-[420px]">
        {/* Main Large Image */}
        <div
          onClick={() => openLightbox(0)}
          className="md:col-span-2 md:row-span-2 relative group cursor-pointer overflow-hidden bg-slate-100"
        >
          <img
            src={displayImages[0]}
            alt={`${placeName} main`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
            <span className="flex items-center gap-1.5 text-sm font-semibold bg-black/50 px-3 py-1.5 rounded-full backdrop-blur">
              <Eye className="w-4 h-4" /> Xem ảnh lớn
            </span>
          </div>
        </div>

        {/* 4 Small Images */}
        {displayImages.slice(1, 5).map((img, idx) => (
          <div
            key={idx}
            onClick={() => openLightbox(idx + 1)}
            className="hidden md:block relative group cursor-pointer overflow-hidden bg-slate-100"
          >
            <img
              src={img}
              alt={`${placeName} thumb ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Eye className="w-5 h-5 drop-shadow" />
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <button
            onClick={closeLightbox}
            className="absolute top-6 right-6 text-white/80 hover:text-white bg-white/10 p-2.5 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <button
            onClick={prevImage}
            className="absolute left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 p-3 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={nextImage}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 p-3 rounded-full transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center">
            <img
              src={displayImages[lightboxIndex]}
              alt={`${placeName} fullscreen`}
              className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            <div className="mt-3 text-white/70 text-sm font-medium">
              Ảnh {lightboxIndex + 1} / {displayImages.length} • {placeName}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
