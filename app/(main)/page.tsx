'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { store } from '@/lib/data/store';
import { supabase } from '@/lib/supabase/client';
import { Place, PlaceFilterOptions, Category, Amenity } from '@/lib/types/database';
import { PlaceCard } from '@/components/place/PlaceCard';
import { PlaceFilterDrawer } from '@/components/place/PlaceFilterDrawer';
import { useToast } from '@/components/common/Toast';
import MapSkeleton from '@/components/map/MapSkeleton';
import { 
  Search, 
  SlidersHorizontal, 
  RefreshCw, 
  Compass, 
  ChevronUp
} from 'lucide-react';

// Dynamically import Leaflet Map (no SSR, standard OpenStreetMap free tiles)
const StudyMap = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function HomePageContent() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [places, setPlaces] = useState<Place[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMobileSheetExpanded, setIsMobileSheetExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter state
  const [filterOptions, setFilterOptions] = useState<PlaceFilterOptions>({
    query: searchParams.get('q') || '',
    categoryId: 'all',
    amenityIds: [],
    priceLevels: [],
    openNow: false,
    openLate: false,
    crowdStatus: [],
    sortBy: 'distance',
  });

  const [activeChip, setActiveChip] = useState<string>('all');
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Check URL focus parameters (e.g. from proposal navigation)
  const paramPlaceId = searchParams.get('placeId') || searchParams.get('place') || searchParams.get('id');
  const paramLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const paramLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;

  // Check unauthorized redirect notice
  useEffect(() => {
    if (searchParams.get('denied') === '1') {
      showToast('Bạn không có quyền truy cập! Chỉ tài khoản Admin mới có quyền vào trang quản trị.', 'error');
    }
  }, [searchParams]);

  // Focus on proposed / targeted place on load (ONLY if approved)
  useEffect(() => {
    if (paramPlaceId) {
      setSelectedPlaceId(paramPlaceId);

      const localPlace = store.getPlaceById(paramPlaceId);
      if (localPlace && localPlace.status === 'approved') {
        setPlaces((prev) => {
          if (!prev.some((p) => p.id === paramPlaceId)) {
            return [localPlace, ...prev];
          }
          return prev;
        });
      }

      // Query Supabase directly for newly created place
      const fetchPlace = async () => {
        try {
          const { data: supaData, error: supaErr } = await supabase
            .from('places')
            .select('*')
            .eq('id', paramPlaceId)
            .single();

          if (!supaErr && supaData) {
            const formatted: Place = {
              ...supaData,
              opening_hours: typeof supaData.opening_hours === 'string' ? JSON.parse(supaData.opening_hours) : supaData.opening_hours,
              images: supaData.images || [],
              price_level: supaData.price_level || 2,
              view_count: supaData.view_count || 0,
            };
            store.savePlace(formatted);
            if (formatted.status === 'approved') {
              setPlaces((prev) => {
                const idx = prev.findIndex((p) => p.id === paramPlaceId);
                if (idx !== -1) {
                  const next = [...prev];
                  next[idx] = formatted;
                  return next;
                }
                return [formatted, ...prev];
              });
            } else {
              // Pending or rejected places must NEVER appear on the public map
              setPlaces((prev) => prev.filter((p) => p.id !== paramPlaceId));
            }
          }
        } catch (e) {
          console.warn('Place fetch notice:', e);
        }
      };

      fetchPlace();
    }
  }, [paramPlaceId]);

  // Fetch / Refresh data
  const loadData = () => {
    setCategories(store.getCategories());
    setAmenities(store.getAmenities());
    const filtered = store.filterPlaces(filterOptions);
    setPlaces(filtered);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = store.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [filterOptions]);

  // Polling crowd data every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setIsRefreshing(true);
      const filtered = store.filterPlaces(filterOptions);
      setPlaces(filtered);
      setTimeout(() => setIsRefreshing(false), 600);
    }, 60000);

    return () => clearInterval(interval);
  }, [filterOptions]);

  // Synchronized interaction: Map marker clicked -> highlight card & scroll card into view
  const handleSelectFromMap = (place: Place) => {
    setSelectedPlaceId(place.id);
    const cardEl = cardRefs.current[place.id];
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Synchronized interaction: Place card body clicked -> flyTo marker & open popup
  const handleSelectFromCard = (place: Place) => {
    setSelectedPlaceId(place.id);
  };

  // Fast Filter Chips handler
  const handleChipClick = (chipKey: string) => {
    setActiveChip(chipKey);
    switch (chipKey) {
      case 'all':
        setFilterOptions((prev) => ({
          ...prev,
          categoryId: 'all',
          openNow: false,
          openLate: false,
          crowdStatus: [],
          sortBy: 'distance',
        }));
        break;
      case 'empty':
        setFilterOptions((prev) => ({
          ...prev,
          crowdStatus: ['empty'],
        }));
        break;
      case 'open_now':
        setFilterOptions((prev) => ({
          ...prev,
          openNow: true,
          crowdStatus: [],
        }));
        break;
      case 'open_late':
        setFilterOptions((prev) => ({
          ...prev,
          openLate: true,
          crowdStatus: [],
        }));
        break;
      case 'outlets':
        setFilterOptions((prev) => ({
          ...prev,
          amenityIds: [2],
        }));
        break;
      case 'top_rated':
        setFilterOptions((prev) => ({
          ...prev,
          sortBy: 'rating',
        }));
        break;
      default:
        break;
    }
  };

  const chips = [
    { key: 'all', label: 'Tất cả' },
    { key: 'empty', label: '🟢 Vắng vẻ' },
    { key: 'open_now', label: 'Đang mở cửa' },
    { key: 'open_late', label: 'Mở muộn / 24/7' },
    { key: 'outlets', label: 'Nhiều ổ điện' },
    { key: 'top_rated', label: '⭐ Đánh giá cao' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="flex-1 flex flex-col md:flex-row p-3 md:p-4 gap-4 max-w-[1920px] mx-auto w-full relative"
    >
      {/* LEFT SIDEBAR (Desktop 420px fixed width, flex scroll) */}
      <aside className="hidden md:flex flex-col w-[420px] bg-white border border-border rounded-2xl h-[calc(100vh-80px)] z-10 shadow-soft overflow-hidden flex-shrink-0">
        {/* Search & Sort Header */}
        <div className="p-4 border-b border-border space-y-3 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tên quán, phố Chùa Láng, Huỳnh Thúc Kháng..."
              value={filterOptions.query || ''}
              onChange={(e) =>
                setFilterOptions((prev) => ({ ...prev, query: e.target.value }))
              }
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-border text-sm placeholder-gray-400 focus:bg-white focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy transition-all"
            />
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => handleChipClick(chip.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeChip === chip.key
                    ? 'bg-burgundy text-white shadow-sm'
                    : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Filter Bar: Count + Filter Drawer Trigger + Sort Dropdown */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="font-semibold text-gray-600 flex items-center gap-1.5">
              <span>{places.length} địa điểm</span>
              {isRefreshing && (
                <RefreshCw className="w-3 h-3 text-burgundy animate-spin" />
              )}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-gray-700 hover:border-burgundy hover:text-burgundy font-medium transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-burgundy" />
                Bộ lọc
              </button>

              <select
                value={filterOptions.sortBy || 'distance'}
                onChange={(e) =>
                  setFilterOptions((prev) => ({
                    ...prev,
                    sortBy: e.target.value as PlaceFilterOptions['sortBy'],
                  }))
                }
                className="px-2 py-1.5 rounded-lg border border-border bg-white text-gray-700 font-medium focus:outline-none focus:border-burgundy text-xs"
              >
                <option value="distance">Gần FTU nhất</option>
                <option value="rating">Đánh giá cao</option>
                <option value="crowd">Vắng vẻ nhất</option>
                <option value="views">Lượt xem nhiều</option>
              </select>
            </div>
          </div>
        </div>

        {/* Place Cards Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-page">
          {places.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Compass className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="font-bold text-gray-700 text-sm">Không tìm thấy địa điểm nào</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-[240px] mx-auto">
                Hãy thử nới lỏng bộ lọc hoặc tìm kiếm với từ khóa khác quanh FTU.
              </p>
              <button
                onClick={() => handleChipClick('all')}
                className="mt-3 text-xs font-semibold text-burgundy bg-burgundy-light px-3 py-1.5 rounded-lg"
              >
                Xóa tất cả bộ lọc
              </button>
            </div>
          ) : (
            places.map((place) => (
              <div
                key={place.id}
                ref={(el) => {
                  cardRefs.current[place.id] = el;
                }}
              >
                <PlaceCard
                  place={place}
                  isSelected={place.id === selectedPlaceId}
                  onSelect={() => handleSelectFromCard(place)}
                />
              </div>
            ))
          )}
        </div>
      </aside>

      {/* RIGHT SIDE: LEAFLET OPENSTREETMAP MAP */}
      <div className="w-full h-[calc(100vh-80px)] sticky top-[70px] rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-inner flex-1 relative">
        <StudyMap
          places={places}
          selectedPlaceId={selectedPlaceId}
          targetCoords={paramLat && paramLng ? { lat: paramLat, lng: paramLng } : null}
          onSelectPlace={handleSelectFromMap}
        />

        {/* Mobile floating filter button */}
        <div className="md:hidden absolute top-4 left-4 right-4 z-20 flex gap-2">
          <div className="flex-1 relative shadow-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm quán quanh FTU..."
              value={filterOptions.query || ''}
              onChange={(e) =>
                setFilterOptions((prev) => ({ ...prev, query: e.target.value }))
              }
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white text-xs border border-border focus:outline-none shadow-sm"
            />
          </div>
          <button
            onClick={() => setIsFilterOpen(true)}
            className="p-2.5 bg-burgundy text-white rounded-xl shadow-md flex items-center justify-center flex-shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Draggable Bottom Sheet */}
        <div
          className={`md:hidden absolute left-0 right-0 bottom-16 bg-white rounded-t-2xl shadow-elevated border-t border-border z-20 transition-all duration-300 flex flex-col ${
            isMobileSheetExpanded ? 'h-[75vh]' : 'h-40'
          }`}
        >
          {/* Drag Handle */}
          <button
            onClick={() => setIsMobileSheetExpanded(!isMobileSheetExpanded)}
            className="w-full pt-2.5 pb-2 flex flex-col items-center cursor-pointer flex-shrink-0 hover:bg-slate-50 rounded-t-2xl"
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mb-1"></div>
            <div className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
              <span>{places.length} địa điểm quanh Ngoại thương</span>
              <ChevronUp
                className={`w-3.5 h-3.5 transition-transform ${
                  isMobileSheetExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {/* Cards list in bottom sheet */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                isSelected={place.id === selectedPlaceId}
                onSelect={() => {
                  handleSelectFromCard(place);
                  setIsMobileSheetExpanded(false);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Advanced Filter Drawer */}
      <PlaceFilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        categories={categories}
        amenities={amenities}
        filterOptions={filterOptions}
        onChangeFilter={(newFilters) => setFilterOptions(newFilters)}
      />
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[500px] text-gray-500 text-sm gap-2">
          <div className="w-7 h-7 border-3 border-burgundy border-t-transparent rounded-full animate-spin"></div>
          <span>Đang tải STUDYSPOT FTU...</span>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
