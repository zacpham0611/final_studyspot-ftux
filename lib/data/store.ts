import { 
  Place, 
  Review, 
  Checkin, 
  UserProfile, 
  Category, 
  Amenity, 
  PlaceFilterOptions,
  CrowdLevel,
  CrowdStatus,
  Notification,
  ReviewReport,
  OpeningHours
} from '@/lib/types/database';
import { 
  INITIAL_PLACES, 
  INITIAL_CATEGORIES, 
  INITIAL_AMENITIES, 
  INITIAL_USERS, 
  INITIAL_CHECKINS, 
  INITIAL_REVIEWS,
  INITIAL_NOTIFICATIONS,
  INITIAL_REPORTS
} from './mockData';
import { calculateCrowdStatus } from '@/lib/utils/crowd';
import { calculateDistance, formatDistance, FTU_COORDINATES } from '@/lib/utils/distance';
import { getOpeningStatus, getValidHourlySlots } from '@/lib/utils/hours';
import { matchesSearch } from '@/lib/utils/text';
import { PRICE_RANGE_OPTIONS, getPriceRangesFromPlace, normalizePriceRange, calculatePriceLevel } from '@/lib/utils/price';
import { supabase } from '@/lib/supabase/client';

export const isUuid = (str?: string | null): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

class StudySpotStore {
  private places: Place[] = [...INITIAL_PLACES];
  private categories: Category[] = [...INITIAL_CATEGORIES];
  private amenities: Amenity[] = [...INITIAL_AMENITIES];
  private users: UserProfile[] = [...INITIAL_USERS];
  private checkins: Checkin[] = [...INITIAL_CHECKINS];
  private reviews: Review[] = [...INITIAL_REVIEWS];
  private notifications: Notification[] = [...INITIAL_NOTIFICATIONS];
  private reviewReports: ReviewReport[] = [...INITIAL_REPORTS];
  private helpfulVotes: Set<string> = new Set(['rev-1_user-student-2', 'rev-3_user-student-2']);
  private favorites: { [userId: string]: Set<string> } = {
    'user-student-1': new Set(['p-1', 'p-3']),
  };
  private currentUser: UserProfile | null = null; // Default: Guest / Unauthenticated
  private listeners: Set<() => void> = new Set();
  private deletedPlaceIds: Set<string> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('Store listener error:', e);
      }
    });
  }

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const storedDeleted = localStorage.getItem('studyspot_deleted_places_v2');
        if (storedDeleted) {
          try {
            this.deletedPlaceIds = new Set(JSON.parse(storedDeleted));
          } catch (e) {}
        }

        const storedPlaces = localStorage.getItem('studyspot_places_v2');
        if (storedPlaces) {
          try {
            const parsed = JSON.parse(storedPlaces);
            this.places = parsed.filter((p: Place) => !this.deletedPlaceIds.has(p.id));
          } catch (e) {}
        }

        const storedCheckins = localStorage.getItem('studyspot_checkins_v2');
        if (storedCheckins) this.checkins = JSON.parse(storedCheckins);

        const storedReviews = localStorage.getItem('studyspot_reviews_v2');
        if (storedReviews) this.reviews = JSON.parse(storedReviews);

        const storedNotifs = localStorage.getItem('studyspot_notifs_v2');
        if (storedNotifs) this.notifications = JSON.parse(storedNotifs);

        const storedReports = localStorage.getItem('studyspot_reports_v2');
        if (storedReports) this.reviewReports = JSON.parse(storedReports);

        const storedUsers = localStorage.getItem('studyspot_users_v2');
        if (storedUsers) this.users = JSON.parse(storedUsers);

        const storedCategories = localStorage.getItem('studyspot_categories_v2');
        if (storedCategories) {
          try {
            const parsed = JSON.parse(storedCategories);
            if (Array.isArray(parsed) && parsed.length > 0) this.categories = parsed;
          } catch (e) {}
        }

        const storedHelpful = localStorage.getItem('studyspot_helpful_v2');
        if (storedHelpful) this.helpfulVotes = new Set(JSON.parse(storedHelpful));

        const storedFavs = localStorage.getItem('studyspot_favs_v2');
        if (storedFavs) {
          const parsed = JSON.parse(storedFavs);
          this.favorites = {};
          for (const [k, v] of Object.entries(parsed)) {
            this.favorites[k] = new Set(v as string[]);
          }
        }

        const storedUser = localStorage.getItem('studyspot_current_user_v2');
        if (storedUser) {
          try {
            this.currentUser = JSON.parse(storedUser);
          } catch (e) {
            this.currentUser = null;
          }
        }
      } catch (e) {
        console.warn('LocalStorage load error:', e);
      }
    }
  }

  private persist(entity: 'all' | 'places' | 'categories' | 'checkins' | 'reviews' | 'notifications' | 'reports' | 'users' | 'helpful' | 'favorites' | 'currentUser' = 'all') {
    if (typeof window !== 'undefined') {
      try {
        if (entity === 'all' || entity === 'places') {
          localStorage.setItem('studyspot_deleted_places_v2', JSON.stringify(Array.from(this.deletedPlaceIds)));
          localStorage.setItem('studyspot_places_v2', JSON.stringify(this.places));
        }
        if (entity === 'all' || entity === 'categories') {
          localStorage.setItem('studyspot_categories_v2', JSON.stringify(this.categories));
        }
        if (entity === 'all' || entity === 'checkins') {
          localStorage.setItem('studyspot_checkins_v2', JSON.stringify(this.checkins));
        }
        if (entity === 'all' || entity === 'reviews') {
          localStorage.setItem('studyspot_reviews_v2', JSON.stringify(this.reviews));
        }
        if (entity === 'all' || entity === 'notifications') {
          localStorage.setItem('studyspot_notifs_v2', JSON.stringify(this.notifications));
        }
        if (entity === 'all' || entity === 'reports') {
          localStorage.setItem('studyspot_reports_v2', JSON.stringify(this.reviewReports));
        }
        if (entity === 'all' || entity === 'users') {
          localStorage.setItem('studyspot_users_v2', JSON.stringify(this.users));
        }
        if (entity === 'all' || entity === 'helpful') {
          localStorage.setItem('studyspot_helpful_v2', JSON.stringify(Array.from(this.helpfulVotes)));
        }
        if (entity === 'all' || entity === 'favorites') {
          const favsObj: { [k: string]: string[] } = {};
          for (const [k, v] of Object.entries(this.favorites)) {
            favsObj[k] = Array.from(v);
          }
          localStorage.setItem('studyspot_favs_v2', JSON.stringify(favsObj));
        }
        if (entity === 'all' || entity === 'currentUser') {
          if (this.currentUser) {
            localStorage.setItem('studyspot_current_user_v2', JSON.stringify(this.currentUser));
          } else {
            localStorage.removeItem('studyspot_current_user_v2');
          }
        }
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }
  }

  // --- Auth methods ---
  getUsers(): UserProfile[] {
    return this.users;
  }

  getUserById(id: string): UserProfile | undefined {
    return this.users.find((u) => u.id === id);
  }

  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  setCurrentUser(user: UserProfile | null) {
    this.currentUser = user;
    if (user) {
      const idx = this.users.findIndex((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
      if (idx !== -1) {
        this.users[idx] = { ...this.users[idx], ...user };
      }
    }
    this.persist();
  }

  loginWithEmail(email: string, pass: string): { success: boolean; user?: UserProfile; message?: string } {
    const cleanEmail = email.trim().toLowerCase();
    
    // Check locked status
    const existing = this.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing && existing.is_locked) {
      return { success: false, message: 'Tài khoản của bạn đã bị khóa bởi Ban Quản Trị.' };
    }

    if (existing) {
      this.currentUser = existing;
      this.persist();
      return { success: true, user: this.currentUser };
    }

    // Unregistered accounts cannot log in
    return {
      success: false,
      message: 'Tài khoản chưa được đăng ký hoặc mật khẩu không chính xác. Vui lòng đăng ký tài khoản mới!',
    };
  }

  registerUser(
    email: string,
    pass: string,
    fullName: string,
    role: string = 'student',
    id?: string
  ): { success: boolean; user?: UserProfile; message?: string } {
    const cleanEmail = email.trim().toLowerCase();
    const existing = this.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      if (id && existing.id !== id) {
        existing.id = id;
        this.persist();
      }
      return {
        success: false,
        message: 'Email này đã tồn tại trong hệ thống. Vui lòng đăng nhập!',
      };
    }

    const newUser: UserProfile = {
      id: id || `user-${Date.now()}`,
      full_name: fullName.trim(),
      email: cleanEmail,
      role: role === 'admin' ? 'admin' : 'student',
      is_locked: false,
      created_at: new Date().toISOString(),
    };

    this.users.push(newUser);
    this.persist();
    this.notify();
    return { success: true, user: newUser };
  }

  logout() {
    this.currentUser = null;
    this.persist();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('studyspot_current_user_v2');
      document.cookie = 'studyspot_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'studyspot_user_email=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      try {
        supabase.auth.signOut().then();
      } catch (e) {}
    }
  }

  async loadFromSupabase() {
    if (typeof window === 'undefined') return;
    try {
      // Parallelize queries across all 10 persistent tables in a single batch
      const [
        usersRes,
        placesRes,
        reviewsRes,
        checkinsRes,
        favoritesRes,
        notificationsRes,
        categoriesRes,
        amenitiesRes,
        reportsRes,
        helpfulRes,
        placeAmenitiesRes,
      ] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('places').select('*'),
        supabase.from('reviews').select('*, user:users!reviews_user_id_fkey(full_name, avatar_url)').order('created_at', { ascending: false }),
        supabase.from('checkins').select('*, user:users(full_name, avatar_url)').order('created_at', { ascending: false }),
        supabase.from('favorites').select('*'),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('id', { ascending: true }),
        supabase.from('amenities').select('*').order('id', { ascending: true }),
        supabase.from('review_reports').select('*, review:reviews(*), user:users(*)').order('created_at', { ascending: false }),
        supabase.from('review_helpful').select('*'),
        supabase.from('place_amenities').select('*'),
      ]);

      if (usersRes.data && usersRes.data.length > 0) {
        this.users = usersRes.data;
      }

      // --- Authoritative Places Sync (Single Source of Truth) ---
      let rawPlaces: any[] | null = null;
      if (placesRes.data && placesRes.data.length > 0) {
        const amList = amenitiesRes.data || this.amenities;
        const amMap = new Map<number, Amenity>();
        for (const am of amList) {
          amMap.set(Number(am.id), am);
        }
        const paMap: Record<string, Amenity[]> = {};
        if (placeAmenitiesRes?.data) {
          for (const pa of placeAmenitiesRes.data) {
            const matched = amMap.get(Number(pa.amenity_id));
            if (matched) {
              if (!paMap[pa.place_id]) paMap[pa.place_id] = [];
              paMap[pa.place_id].push(matched);
            }
          }
        }
        rawPlaces = placesRes.data.map((dp: any) => ({
          ...dp,
          amenities: paMap[dp.id] || dp.amenities || [],
        }));
      } else {
        // Fallback to /api/places?all=1 only if direct query was empty/failed
        try {
          const apiRes = await fetch('/api/places?all=1', { cache: 'no-store' });
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (Array.isArray(apiData.places)) {
              rawPlaces = apiData.places;
            }
          }
        } catch (apiErr) {
          console.warn('Authoritative /api/places?all=1 fetch notice:', apiErr);
        }
      }

      if (rawPlaces !== null) {
        // Supabase is the single source of truth:
        // REPLACE this.places completely with Supabase data, filtering out any deleted places
        this.places = rawPlaces
          .filter((dp: any) => !this.deletedPlaceIds.has(dp.id))
          .map((dp: any) => {
            const parsedHours = typeof dp.opening_hours === 'string' ? JSON.parse(dp.opening_hours) : (dp.opening_hours || INITIAL_PLACES[0].opening_hours);
            const computedPriceRanges = getPriceRangesFromPlace({
              ...dp,
              opening_hours: parsedHours,
            });
            return {
              ...dp,
              opening_hours: parsedHours,
              price_ranges: computedPriceRanges,
              price_level: dp.price_level || (computedPriceRanges.length > 0 ? calculatePriceLevel(computedPriceRanges) : 2),
              images: dp.images || [],
              view_count: dp.view_count || 0,
              amenities: Array.isArray(dp.amenities) ? dp.amenities : [],
            };
          });

        // Immediately overwrite localStorage so stale deleted places are completely purged
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('studyspot_places_v2', JSON.stringify(this.places));
          } catch (e) {}
        }
      }

      // Authoritative Reviews Sync (Single Source of Truth)
      if (reviewsRes.data && reviewsRes.data.length > 0) {
        this.reviews = reviewsRes.data;
      } else {
        // Fallback to /api/reviews only if direct query was empty/failed
        try {
          const revApiRes = await fetch('/api/reviews', { cache: 'no-store' });
          if (revApiRes.ok) {
            const revApiJson = await revApiRes.json();
            if (Array.isArray(revApiJson.reviews) && revApiJson.reviews.length > 0) {
              this.reviews = revApiJson.reviews;
            }
          }
        } catch (rErr) {}

        if (!this.reviews || this.reviews.length === 0) {
          // Resilient fallback if relationship embedding encounters schema notice
          try {
            const { data: fallbackReviews } = await supabase
              .from('reviews')
              .select('*')
              .order('created_at', { ascending: false });
            if (fallbackReviews && fallbackReviews.length > 0) {
              const userIds = Array.from(new Set(fallbackReviews.map((r: any) => r.user_id).filter(Boolean)));
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
              this.reviews = fallbackReviews.map((r: any) => ({
                ...r,
                user: userMap[r.user_id] || null,
              }));
            }
          } catch (e) {}
        }
      }

      if (checkinsRes.data) {
        const validPlaceIds = new Set(this.places.map((p) => p.id));
        this.checkins = checkinsRes.data.filter((c: any) => validPlaceIds.has(c.place_id));
      }

      if (favoritesRes.data) {
        this.favorites = {};
        for (const f of favoritesRes.data) {
          if (!this.favorites[f.user_id]) {
            this.favorites[f.user_id] = new Set();
          }
          this.favorites[f.user_id].add(f.place_id);
        }
      }

      let supaNotifs: Notification[] | null = null;
      try {
        const notifRes = await fetch('/api/notifications', { cache: 'no-store' });
        if (notifRes.ok) {
          const notifJson = await notifRes.json();
          if (Array.isArray(notifJson.notifications)) {
            supaNotifs = notifJson.notifications;
          }
        }
      } catch (nErr) {}

      if (!supaNotifs && notificationsRes.data) {
        supaNotifs = notificationsRes.data;
      }

      if (supaNotifs !== null) {
        this.notifications = supaNotifs;
      }

      let supaCategories: Category[] | null = null;
      try {
        const catRes = await fetch('/api/categories', { cache: 'no-store' });
        if (catRes.ok) {
          const catJson = await catRes.json();
          if (Array.isArray(catJson.categories) && catJson.categories.length > 0) {
            supaCategories = catJson.categories;
          }
        }
      } catch (cErr) {}

      if (!supaCategories && categoriesRes.data && categoriesRes.data.length > 0) {
        supaCategories = categoriesRes.data;
      }

      if (supaCategories !== null && supaCategories.length > 0) {
        this.categories = supaCategories;
      }

      let supaAmenities: Amenity[] | null = null;
      try {
        const amRes = await fetch('/api/amenities', { cache: 'no-store' });
        if (amRes.ok) {
          const amJson = await amRes.json();
          if (Array.isArray(amJson.amenities)) {
            supaAmenities = amJson.amenities;
          }
        }
      } catch (aErr) {}

      if (!supaAmenities && amenitiesRes.data) {
        supaAmenities = amenitiesRes.data;
      }

      if (supaAmenities !== null) {
        this.amenities = supaAmenities;
      }

      if (reportsRes.data) {
        this.reviewReports = reportsRes.data;
      }

      if (helpfulRes.data) {
        this.helpfulVotes = new Set(helpfulRes.data.map((h: any) => `${h.review_id}_${h.user_id}`));
      }

      this.persist();
      this.notify();
    } catch (e) {
      console.warn('Supabase store load notice:', e);
    }
  }

  // --- Places ---
  getEnrichedPlaces(userLat?: number, userLng?: number): Place[] {
    const targetLat = userLat ?? FTU_COORDINATES.lat;
    const targetLng = userLng ?? FTU_COORDINATES.lng;

    return this.places
      .filter((place) => !this.deletedPlaceIds.has(place.id))
      .map((place) => {
      const placeCheckins = this.checkins.filter((c) => c.place_id === place.id);
      const crowd = calculateCrowdStatus(placeCheckins);
      const distance = calculateDistance(place.lat, place.lng, targetLat, targetLng);
      const hours = getOpeningStatus(place.opening_hours);
      const isOpen = hours.isOpen;
      const placeReviews = this.reviews.filter((r) => r.place_id === place.id && !r.is_hidden);
      const avgRating =
        placeReviews.length > 0
          ? Math.round(
              (placeReviews.reduce((sum, r) => sum + r.rating, 0) / placeReviews.length) * 10
            ) / 10
          : 4.8;
      const cat = this.categories.find((c) => c.id === place.category_id);
      const creator = place.created_by ? this.users.find((u) => u.id === place.created_by) : null;

      const priceRanges = getPriceRangesFromPlace(place);
      const priceLevel = place.price_level || (priceRanges.length > 0 ? calculatePriceLevel(priceRanges) : 2);

      return {
        ...place,
        price_ranges: priceRanges,
        price_level: priceLevel,
        category: cat,
        creator: creator || null,
        distance_meters: distance,
        crowd_score: isOpen ? (crowd.score ?? undefined) : undefined,
        crowd_status: isOpen ? crowd.status : 'unknown',
        crowd_label: isOpen ? crowd.label : undefined,
        is_open: isOpen,
        is_late_night: hours.isLateNight,
        average_rating: avgRating,
        review_count: placeReviews.length,
      };
    });
  }

  filterPlaces(options: PlaceFilterOptions = {}, userLat?: number, userLng?: number): Place[] {
    const all = this.getEnrichedPlaces(userLat, userLng);

    return all.filter((p) => {
      // ONLY approved places can EVER appear on public main page & public map
      if (p.status !== 'approved') {
        return false;
      }

      if (options.query) {
        const matchesNameOrAddr =
          matchesSearch(p.name, options.query) ||
          matchesSearch(p.address, options.query) ||
          matchesSearch(p.description, options.query);
        if (!matchesNameOrAddr) return false;
      }

      if (options.categoryId && options.categoryId !== 'all') {
        if (p.category_id !== options.categoryId) return false;
      }

      if (options.amenityIds && options.amenityIds.length > 0) {
        const placeAmenityIds = p.amenities?.map((a) => a.id) || [];
        const hasAll = options.amenityIds.every((id) => placeAmenityIds.includes(id));
        if (!hasAll) return false;
      }

      if (options.priceRanges && options.priceRanges.length > 0) {
        const placeRanges = getPriceRangesFromPlace(p);
        const normalizedOptionRanges = options.priceRanges.map(normalizePriceRange);
        if (placeRanges.length > 0) {
          const hasMatch = normalizedOptionRanges.some((r) => placeRanges.includes(r));
          if (!hasMatch) return false;
        } else {
          // Backward compatibility for legacy places with only price_level:
          const selectedLevels = normalizedOptionRanges.map((r) => {
            const found = PRICE_RANGE_OPTIONS.find((opt) => opt.value === r);
            return found ? found.level : 2;
          });
          if (!selectedLevels.includes(p.price_level)) return false;
        }
      }

      if (options.priceLevels && options.priceLevels.length > 0) {
        if (!options.priceLevels.includes(p.price_level)) return false;
      }

      if (options.openNow && !p.is_open) return false;
      if (options.openLate && !p.is_late_night) return false;

      if (options.crowdStatus && options.crowdStatus.length > 0) {
        if (!options.crowdStatus.includes(p.crowd_status || 'unknown')) return false;
      }

      if (options.maxDistanceKm && p.distance_meters) {
        if (p.distance_meters > options.maxDistanceKm * 1000) return false;
      }

      return true;
    }).sort((a, b) => {
      if (options.sortBy === 'rating') {
        return (b.average_rating || 0) - (a.average_rating || 0);
      }
      if (options.sortBy === 'crowd') {
        return (a.crowd_score || 99) - (b.crowd_score || 99);
      }
      if (options.sortBy === 'views') {
        return b.view_count - a.view_count;
      }
      return (a.distance_meters || 0) - (b.distance_meters || 0);
    });
  }

  getPlaceById(id: string): Place | undefined {
    const list = this.getEnrichedPlaces();
    return list.find((p) => p.id === id);
  }

  getSimilarPlaces(currentPlaceId: string, limit: number = 3): Place[] {
    const current = this.getPlaceById(currentPlaceId);
    if (!current) return [];

    const all = this.getEnrichedPlaces().filter(
      (p) => p.id !== currentPlaceId && p.status === 'approved'
    );

    // Prioritize same category first, then closest distance
    return all.sort((a, b) => {
      if (a.category_id === current.category_id && b.category_id !== current.category_id) return -1;
      if (b.category_id === current.category_id && a.category_id !== current.category_id) return 1;
      return (a.distance_meters || 0) - (b.distance_meters || 0);
    }).slice(0, limit);
  }

  incrementView(id: string) {
    const p = this.places.find((x) => x.id === id);
    if (p) {
      p.view_count += 1;
      this.persist();
    }
  }

  // --- Image Controls for Places ---
  addImageToPlace(placeId: string, imageUrl: string): boolean {
    const p = this.places.find((x) => x.id === placeId);
    if (p) {
      p.images = p.images || [];
      p.images.push(imageUrl);
      this.persist();
      this.notify();
      if (typeof window !== 'undefined' && isUuid(placeId)) {
        supabase.from('places').update({ images: p.images }).eq('id', placeId).then();
      }
      return true;
    }
    return false;
  }

  setPlaceFeaturedImage(placeId: string, imageIndex: number): boolean {
    const p = this.places.find((x) => x.id === placeId);
    if (p && p.images && imageIndex >= 0 && imageIndex < p.images.length) {
      const selected = p.images[imageIndex];
      p.images.splice(imageIndex, 1);
      p.images.unshift(selected);
      this.persist();
      this.notify();
      if (typeof window !== 'undefined' && isUuid(placeId)) {
        supabase.from('places').update({ images: p.images }).eq('id', placeId).then();
      }
      return true;
    }
    return false;
  }

  removePlaceImage(placeId: string, imageIndex: number): boolean {
    const p = this.places.find((x) => x.id === placeId);
    if (p && p.images && imageIndex >= 0 && imageIndex < p.images.length) {
      p.images.splice(imageIndex, 1);
      this.persist();
      this.notify();
      if (typeof window !== 'undefined' && isUuid(placeId)) {
        supabase.from('places').update({ images: p.images }).eq('id', placeId).then();
      }
      return true;
    }
    return false;
  }

  updatePlace(placeId: string, data: Partial<Place>): Place | null {
    const p = this.places.find((x) => x.id === placeId);
    if (!p) return null;
    Object.assign(p, data);

    if (data.price_ranges) {
      p.price_ranges = data.price_ranges;
      if (p.opening_hours && typeof p.opening_hours === 'object') {
        p.opening_hours.price_ranges = data.price_ranges;
      }
    }
    const computedRanges = getPriceRangesFromPlace(p);
    p.price_ranges = computedRanges;
    p.price_level = data.price_level !== undefined ? data.price_level : (computedRanges.length > 0 ? calculatePriceLevel(computedRanges) : (p.price_level || 2));

    this.persist();
    this.notify();

    if (typeof window !== 'undefined' && isUuid(placeId)) {
      const updatePayload: any = {};
      if (data.name !== undefined) updatePayload.name = data.name;
      if (data.category_id !== undefined) updatePayload.category_id = data.category_id;
      if (data.address !== undefined) updatePayload.address = data.address;
      if (data.lat !== undefined) updatePayload.lat = data.lat;
      if (data.lng !== undefined) updatePayload.lng = data.lng;
      if (data.description !== undefined) updatePayload.description = data.description;
      if (data.price_level !== undefined) updatePayload.price_level = data.price_level;
      if (data.images !== undefined) updatePayload.images = data.images;
      if (data.status !== undefined) updatePayload.status = data.status;
      if (data.reject_reason !== undefined) updatePayload.reject_reason = data.reject_reason;
      if (data.opening_hours !== undefined) {
        updatePayload.opening_hours = data.opening_hours;
        if (p.price_ranges && typeof updatePayload.opening_hours === 'object' && updatePayload.opening_hours !== null) {
          updatePayload.opening_hours.price_ranges = p.price_ranges;
        }
      }

      supabase.from('places').update(updatePayload).eq('id', placeId).then(({ error }) => {
        if (error) console.warn('Supabase updatePlace notice:', error.message);
      });

      if (data.amenities && Array.isArray(data.amenities)) {
        supabase.from('place_amenities').delete().eq('place_id', placeId).then(() => {
          const rows = data.amenities!.map((a: any) => ({
            place_id: placeId,
            amenity_id: typeof a === 'object' ? a.id : Number(a),
          })).filter((r: any) => !isNaN(r.amenity_id));
          if (rows.length > 0) {
            supabase.from('place_amenities').insert(rows).then();
          }
        });
      }
    }
    return p;
  }

  // --- Checkins ---
  addCheckin(placeId: string, level: CrowdLevel, note?: string, userOverride?: UserProfile): { success: boolean; message: string; checkin?: Checkin } {
    const user = userOverride || this.currentUser;
    if (!user) {
      return {
        success: false,
        message: 'Vui lòng đăng nhập để check-in báo độ đông!',
      };
    }
    if (user.is_locked) {
      return {
        success: false,
        message: 'Tài khoản của bạn đã bị khóa bởi Ban Quản Trị.',
      };
    }

    const userId = user.id;
    const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;

    const recent = this.checkins.find(
      (c) => c.place_id === placeId && c.user_id === userId && new Date(c.created_at).getTime() > thirtyMinsAgo
    );

    if (recent) {
      return {
        success: false,
        message: 'CHECKIN_COOLDOWN: Bạn chỉ có thể check-in tại quán này sau 30 phút.',
      };
    }

    const newCheckin: Checkin = {
      id: `chk-${Date.now()}`,
      place_id: placeId,
      user_id: userId,
      level,
      note,
      created_at: new Date().toISOString(),
      user: {
        full_name: user.full_name || 'Sinh viên FTU',
        avatar_url: user.avatar_url,
      },
    };

    this.checkins.unshift(newCheckin);
    this.persist();
    this.notify();

    // Persist directly to Supabase Database
    try {
      let targetPlaceId = placeId;
      if (!isUuid(targetPlaceId)) {
        const p = this.places.find((x) => x.id === placeId);
        if (p && isUuid(p.id)) targetPlaceId = p.id;
      }

      if (isUuid(targetPlaceId) && isUuid(userId)) {
        supabase.from('checkins').insert({
          place_id: targetPlaceId,
          user_id: userId,
          level,
          note: note ? note.slice(0, 100) : null,
        }).select().single().then(({ data, error }) => {
          if (data?.id) {
            newCheckin.id = data.id;
            this.persist();
          }
          if (error) {
            console.warn('Supabase checkin insert notice:', error.message);
          }
        });
      }
    } catch (e) {
      console.warn('Supabase checkin insert notice:', e);
    }

    return {
      success: true,
      message: 'Báo độ đông thành công! Cảm ơn bạn đã đóng góp cho cộng đồng FTU.',
      checkin: newCheckin,
    };
  }

  getAllCheckins(): Checkin[] {
    const validPlaceIds = new Set(this.places.map((p) => p.id));
    return this.checkins.filter((c) => validPlaceIds.has(c.place_id));
  }

  getCheckinsForPlace(placeId: string): Checkin[] {
    return this.checkins.filter((c) => c.place_id === placeId);
  }

  /**
   * Calculates hourly crowd histogram according to place's opening hours (or default slots) purely from checkins.
   * Returns empty array if no check-ins exist for the place.
   */
  getHourlyCrowdData(
    placeId: string, 
    customCheckins?: Checkin[],
    openingHours?: OpeningHours
  ): { hour: number; label: string; score: number; level: CrowdStatus; count: number }[] {
    const placeCheckins = customCheckins !== undefined ? customCheckins : this.getCheckinsForPlace(placeId);
    if (!placeCheckins || placeCheckins.length === 0) {
      return [];
    }

    const placeHours = openingHours || this.getPlaceById(placeId)?.opening_hours;
    const validSlots = getValidHourlySlots(placeHours);
    if (!validSlots || validSlots.length === 0) {
      return [];
    }

    const hourlyScores: { [h: number]: number[] } = {};
    for (const h of validSlots) {
      hourlyScores[h] = [];
    }

    for (const c of placeCheckins) {
      const d = new Date(c.created_at);
      // Determine hour in Vietnam time (UTC+7)
      const vnFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: 'numeric',
        hour12: false,
      });
      const h = parseInt(vnFormatter.format(d), 10);
      if (hourlyScores[h] !== undefined) {
        hourlyScores[h].push(c.level);
      }
    }

    const hasAnyCheckinInHours = Object.values(hourlyScores).some((logs) => logs.length > 0);
    if (!hasAnyCheckinInHours) {
      return [];
    }

    const result = [];
    for (const h of validSlots) {
      const logs = hourlyScores[h];
      if (logs.length > 0) {
        const score = logs.reduce((a, b) => a + b, 0) / logs.length;
        let level: CrowdStatus = 'empty';
        if (score > 2.33) level = 'full';
        else if (score >= 1.67) level = 'medium';

        result.push({
          hour: h,
          label: `${h}:00`,
          score: Math.round(score * 10) / 10,
          level,
          count: logs.length,
        });
      } else {
        result.push({
          hour: h,
          label: `${h}:00`,
          score: 0,
          level: 'unknown' as CrowdStatus,
          count: 0,
        });
      }
    }

    return result;
  }

  syncPlaceCheckins(placeId: string, newCheckins: Checkin[]) {
    this.checkins = this.checkins.filter((c) => c.place_id !== placeId).concat(newCheckins);
    this.persist('checkins');
    this.notify();
  }

  syncPlaceReviews(placeId: string, newReviews: Review[]) {
    this.reviews = this.reviews.filter((r) => r.place_id !== placeId).concat(newReviews);
    this.persist('reviews');
    this.notify();
  }

  setHourlyCrowdData(placeId: string, hourlyLevels: { hour: number; level: number }[]) {
    const now = new Date();
    // Get YYYY-MM-DD in Asia/Ho_Chi_Minh
    const vnDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const newCheckins: Checkin[] = hourlyLevels.map(({ hour, level }) => {
      const hourPad = hour.toString().padStart(2, '0');
      const isoVn = `${vnDateStr}T${hourPad}:00:00+07:00`;
      return {
        id: `chk-admin-${placeId}-${hour}`,
        place_id: placeId,
        user_id: this.currentUser?.id || 'admin-override',
        level: level as CrowdLevel,
        note: 'Admin thiết lập',
        created_at: isoVn,
      };
    });

    // Replace previous admin checkins for this place, keeping user checkins intact
    this.checkins = this.checkins
      .filter((c) => !(c.place_id === placeId && (c.id?.startsWith('chk-admin-') || c.note?.startsWith('Admin'))))
      .concat(newCheckins);
    this.persist();
    this.notify();
  }

  // --- Reviews ---
  getReviewsForPlace(placeId: string): Review[] {
    const userId = this.currentUser?.id;
    return this.reviews
      .filter((r) => r.place_id === placeId && (!r.is_hidden || this.currentUser?.role === 'admin'))
      .map((r) => {
        const isHelpfulByMe = userId ? this.helpfulVotes.has(`${r.id}_${userId}`) : false;
        return {
          ...r,
          helpful_count: r.helpful_count || 0,
          is_helpful_by_me: isHelpfulByMe,
        };
      });
  }

  addReview(reviewData: Omit<Review, 'id' | 'created_at' | 'user' | 'is_hidden' | 'user_id'> & { user_id?: string }): { success: boolean; message: string; review?: Review } {
    if (!this.currentUser && !reviewData.user_id) {
      return {
        success: false,
        message: 'Vui lòng đăng nhập để viết đánh giá!',
      };
    }
    if (this.currentUser?.is_locked) {
      return {
        success: false,
        message: 'Tài khoản của bạn đã bị khóa bởi Ban Quản Trị.',
      };
    }

    const userId = reviewData.user_id || this.currentUser!.id;
    const existing = this.reviews.find((r) => r.place_id === reviewData.place_id && r.user_id === userId);

    if (existing) {
      return {
        success: false,
        message: 'Bạn đã viết đánh giá cho địa điểm này rồi. Hãy dùng tính năng Sửa đánh giá.',
      };
    }

    const newReview: Review = {
      ...reviewData,
      id: `rev-${Date.now()}`,
      user_id: userId,
      is_hidden: false,
      created_at: new Date().toISOString(),
      helpful_count: 0,
      user: {
        full_name: this.currentUser?.full_name || 'Sinh viên FTU',
        avatar_url: this.currentUser?.avatar_url,
      },
    };

    this.reviews.unshift(newReview);
    this.persist();

    // Persist directly to Supabase Database
    try {
      supabase.from('reviews').insert({
        place_id: reviewData.place_id,
        user_id: userId,
        rating: reviewData.rating,
        wifi_rating: reviewData.wifi_rating,
        outlet_rating: reviewData.outlet_rating,
        quiet_rating: reviewData.quiet_rating,
        price_rating: reviewData.price_rating,
        space_rating: reviewData.space_rating,
        content: reviewData.content,
        images: reviewData.images || [],
        is_hidden: false,
      }).select().single().then(({ data }) => {
        if (data?.id) {
          newReview.id = data.id;
          this.persist();
        }
      });
    } catch (e) {
      console.warn('Supabase review insert notice:', e);
    }

    return {
      success: true,
      message: 'Đăng đánh giá thành công!',
      review: newReview,
    };
  }

  updateReview(reviewId: string, content: string, rating: number): boolean {
    const rev = this.reviews.find((r) => r.id === reviewId);
    if (rev) {
      rev.content = content;
      rev.rating = rating;
      this.persist();
      try {
        supabase.from('reviews').update({ content, rating }).eq('id', reviewId).then();
      } catch (e) {}
      return true;
    }
    return false;
  }

  deleteReview(reviewId: string): boolean {
    const idx = this.reviews.findIndex((r) => r.id === reviewId);
    if (idx !== -1) {
      this.reviews.splice(idx, 1);
      this.persist();
      try {
        supabase.from('reviews').delete().eq('id', reviewId).then();
      } catch (e) {}
      return true;
    }
    return false;
  }

  // --- Helpful & Reports for Reviews ---
  toggleHelpfulReview(reviewId: string): { helpful: boolean; count: number } {
    const userId = this.currentUser?.id || 'guest';
    const key = `${reviewId}_${userId}`;
    const rev = this.reviews.find((r) => r.id === reviewId);
    if (!rev) return { helpful: false, count: 0 };

    rev.helpful_count = rev.helpful_count || 0;

    let isNowHelpful = false;
    if (this.helpfulVotes.has(key)) {
      this.helpfulVotes.delete(key);
      rev.helpful_count = Math.max(0, rev.helpful_count - 1);
      isNowHelpful = false;
      if (typeof window !== 'undefined' && isUuid(reviewId) && isUuid(userId)) {
        supabase.from('review_helpful').delete().match({ review_id: reviewId, user_id: userId }).then();
      }
    } else {
      this.helpfulVotes.add(key);
      rev.helpful_count += 1;
      isNowHelpful = true;
      if (typeof window !== 'undefined' && isUuid(reviewId) && isUuid(userId)) {
        supabase.from('review_helpful').upsert({ review_id: reviewId, user_id: userId }).then();
      }
    }
    this.persist();
    this.notify();
    return { helpful: isNowHelpful, count: rev.helpful_count };
  }

  reportReview(reviewId: string, reason: string): { success: boolean; message: string } {
    const userId = this.currentUser?.id || 'guest';
    const rev = this.reviews.find((r) => r.id === reviewId);
    if (!rev) return { success: false, message: 'Không tìm thấy đánh giá cần báo cáo' };

    const newReport: ReviewReport = {
      id: `rep-${Date.now()}`,
      review_id: reviewId,
      user_id: userId,
      reason,
      status: 'pending',
      created_at: new Date().toISOString(),
      review: rev,
      user: this.currentUser || undefined,
    };

    this.reviewReports.unshift(newReport);
    this.persist();
    this.notify();

    if (typeof window !== 'undefined' && isUuid(reviewId) && isUuid(userId)) {
      supabase.from('review_reports').insert({
        review_id: reviewId,
        user_id: userId,
        reason,
        status: 'pending',
      }).select().single().then(({ data, error }) => {
        if (data?.id) {
          newReport.id = data.id;
          this.persist();
        }
        if (error) console.warn('Supabase review report notice:', error.message);
      });
    }

    return { success: true, message: 'Báo cáo vi phạm đã được gửi tới Ban Quản Trị FTU.' };
  }

  getReviewReports(): ReviewReport[] {
    return this.reviewReports.map((rep) => ({
      ...rep,
      review: this.reviews.find((r) => r.id === rep.review_id),
      user: this.users.find((u) => u.id === rep.user_id),
    }));
  }

  dismissReport(reportId: string): boolean {
    const rep = this.reviewReports.find((r) => r.id === reportId);
    if (rep) {
      rep.status = 'dismissed';
      this.persist();
      this.notify();
      if (typeof window !== 'undefined' && isUuid(reportId)) {
        supabase.from('review_reports').update({ status: 'dismissed' }).eq('id', reportId).then();
      }
      return true;
    }
    return false;
  }

  // --- Notifications ---
  getNotifications(userId?: string): Notification[] {
    const user = this.currentUser;
    const uid = userId || user?.id;
    if (!uid) return [];

    const isAdminUser = 
      user?.role === 'admin' || 
      (user?.email && user.email.toLowerCase() === 'admin123@ftu.edu.vn') || 
      uid === 'a0000000-0000-0000-0000-000000000001';

    if (isAdminUser) {
      return this.notifications.filter((n) => 
        n.user_id === uid || 
        n.link?.startsWith('/admin') || 
        n.noi_dung?.toLowerCase().includes('đề xuất')
      );
    }

    return this.notifications.filter((n) => n.user_id === uid);
  }

  getUnreadNotificationCount(userId?: string): number {
    return this.getNotifications(userId).filter((n) => !n.is_read).length;
  }

  markAllNotificationsRead(userId?: string): void {
    const uid = userId || this.currentUser?.id;
    if (!uid) return;
    for (const n of this.notifications) {
      if (n.user_id === uid || n.link?.startsWith('/admin')) n.is_read = true;
    }
    this.persist();
    this.notify();
    if (typeof window !== 'undefined') {
      if (isUuid(uid)) {
        supabase.from('notifications').update({ is_read: true }).eq('user_id', uid).then();
      }
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, markAll: true }),
      }).catch(() => {});
    }
  }

  syncNotifications(notifs: Notification[]): void {
    if (!Array.isArray(notifs)) return;
    let hasNew = false;
    for (const n of notifs) {
      if (!this.notifications.some((x) => x.id === n.id)) {
        this.notifications.unshift(n);
        hasNew = true;
      }
    }
    if (hasNew) {
      this.persist('notifications');
    }
  }

  markNotificationRead(notificationId: string): void {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.is_read = true;
      this.persist();
      this.notify();
      if (typeof window !== 'undefined') {
        if (isUuid(notificationId)) {
          supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).then();
        }
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationId }),
        }).catch(() => {});
      }
    }
  }

  createNotification(userId: string, noi_dung: string, link?: string): Notification {
    const newNotif: Notification = {
      id: `notif-${Date.now()}`,
      user_id: userId,
      noi_dung,
      link,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    this.notifications.unshift(newNotif);
    this.persist();
    this.notify();

    // Persist to Supabase public.notifications
    if (typeof window !== 'undefined') {
      if (isUuid(userId) && userId !== 'a0000000-0000-0000-0000-000000000001') {
        supabase.from('notifications').insert({
          user_id: userId,
          noi_dung,
          link: link || null,
          is_read: false,
        }).select().single().then(({ data, error }) => {
          if (data?.id) {
            newNotif.id = data.id;
            this.persist();
          }
          if (error) console.warn('Supabase notification client insert notice:', error.message);
        });
      }

      // Also call server API route with service role permissions to bypass client RLS & resolve real admin UUID
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, noi_dung, link }),
      }).then(async (res) => {
        if (res.ok) {
          const json = await res.json();
          if (json.notification?.id) {
            newNotif.id = json.notification.id;
            newNotif.user_id = json.notification.user_id;
            this.persist();
          }
        }
      }).catch((e) => {
        console.warn('API notification error:', e);
      });
    }

    return newNotif;
  }

  // --- Favorites ---
  isFavorite(placeId: string, userIdOverride?: string): boolean {
    const userId = userIdOverride || this.currentUser?.id || 'guest';
    return !!this.favorites[userId]?.has(placeId);
  }

  toggleFavorite(placeId: string, userIdOverride?: string): boolean {
    const userId = userIdOverride || this.currentUser?.id || 'guest';
    if (!this.favorites[userId]) {
      this.favorites[userId] = new Set();
    }
    const favSet = this.favorites[userId];
    let isNowFav = false;
    if (favSet.has(placeId)) {
      favSet.delete(placeId);
      isNowFav = false;
    } else {
      favSet.add(placeId);
      isNowFav = true;
    }
    this.persist();
    this.notify();

    // Persist to Supabase public.favorites via server API & client
    if (typeof window !== 'undefined' && isUuid(userId) && isUuid(placeId)) {
      fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, placeId, isFavorite: isNowFav }),
      }).catch(() => {});

      if (isNowFav) {
        supabase.from('favorites').upsert({ user_id: userId, place_id: placeId }).then(({ error }) => {
          if (error) console.warn('Supabase add favorite notice:', error.message);
        });
      } else {
        supabase.from('favorites').delete().match({ user_id: userId, place_id: placeId }).then(({ error }) => {
          if (error) console.warn('Supabase remove favorite notice:', error.message);
        });
      }
    }

    return isNowFav;
  }

  getUserFavorites(userIdOverride?: string): Place[] {
    const userId = userIdOverride || this.currentUser?.id || 'guest';
    const favIds = this.favorites[userId] || new Set();
    const enriched = this.getEnrichedPlaces();
    return enriched.filter((p) => favIds.has(p.id));
  }

  // --- Place Proposals & Admin Review ---
  proposePlace(placeData: Partial<Place>, userOverride?: UserProfile): Place {
    const user = userOverride || this.currentUser;
    const newPlace: Place = {
      id: placeData.id || `p-${Date.now()}`,
      name: placeData.name || 'Địa điểm mới',
      category_id: placeData.category_id || 1,
      address: placeData.address || 'Gần ĐH Ngoại thương',
      lat: placeData.lat || FTU_COORDINATES.lat,
      lng: placeData.lng || FTU_COORDINATES.lng,
      description: placeData.description || '',
      opening_hours: placeData.opening_hours || {
        monday: { open: '08:00', close: '22:30' },
      },
      price_level: placeData.price_level || 2,
      images: placeData.images && placeData.images.length > 0
        ? placeData.images
        : ['https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1000&q=80'],
      status: 'pending',
      view_count: 0,
      created_by: user?.id,
      created_at: new Date().toISOString(),
      amenities: placeData.amenities || [],
    };

    this.places.unshift(newPlace);
    
    // Notify admin
    const adminUser = this.users.find(
      (u) => u.role === 'admin' || u.email.toLowerCase() === 'admin123@ftu.edu.vn'
    );
    const adminTargetId = adminUser?.id || 'a0000000-0000-0000-0000-000000000001';
    this.createNotification(
      adminTargetId,
      `Có đề xuất địa điểm mới: "${newPlace.name}" đang chờ duyệt.`,
      '/admin/de-xuat'
    );

    this.persist();
    return newPlace;
  }

  approveProposal(placeId: string): boolean {
    const p = this.places.find((x) => x.id === placeId);
    if (p) {
      p.status = 'approved';
      p.approved_at = new Date().toISOString();
      p.reject_reason = undefined;
      
      // Notify creator
      if (p.created_by) {
        this.createNotification(
          p.created_by,
          `Đề xuất địa điểm "${p.name}" của bạn đã được Admin phê duyệt và xuất bản!`,
          `/dia-diem/${p.id}`
        );
      }
      this.persist();
      this.notify();

      if (typeof window !== 'undefined') {
        supabase.from('places').update({
          status: 'approved',
          approved_at: p.approved_at,
          reject_reason: null,
        }).eq('id', placeId).then(({ error }) => {
          if (error) console.warn('Supabase approve proposal error:', error.message);
        });
      }
      return true;
    }
    return false;
  }

  rejectProposal(placeId: string, reason: string): boolean {
    const p = this.places.find((x) => x.id === placeId);
    if (p) {
      p.status = 'rejected';
      p.reject_reason = reason;

      if (p.created_by) {
        this.createNotification(
          p.created_by,
          `Đề xuất địa điểm "${p.name}" của bạn đã bị từ chối. Lý do: ${reason}`,
          '/ho-so'
        );
      }
      this.persist();
      this.notify();

      if (typeof window !== 'undefined') {
        supabase.from('places').update({
          status: 'rejected',
          reject_reason: reason,
        }).eq('id', placeId).then(({ error }) => {
          if (error) console.warn('Supabase reject proposal error:', error.message);
        });
      }
      return true;
    }
    return false;
  }

  // --- Admin General Operations ---
  getAllPlacesAdmin(): Place[] {
    return this.getEnrichedPlaces();
  }

  updatePlaceStatus(placeId: string, status: Place['status'], rejectReason?: string): boolean {
    const p = this.places.find((x) => x.id === placeId);
    if (p) {
      p.status = status;
      if (rejectReason !== undefined) p.reject_reason = rejectReason;
      if (status === 'approved' && !p.approved_at) p.approved_at = new Date().toISOString();
      this.persist();
      this.notify();

      if (typeof window !== 'undefined') {
        const payload: any = { status };
        if (rejectReason !== undefined) payload.reject_reason = rejectReason;
        if (status === 'approved' && p.approved_at) payload.approved_at = p.approved_at;
        supabase.from('places').update(payload).eq('id', placeId).then(({ error }) => {
          if (error) console.warn('Supabase updatePlaceStatus error:', error.message);
        });
      }
      return true;
    }
    return false;
  }

  deletePlace(placeId: string): boolean {
    this.deletedPlaceIds.add(placeId);
    this.places = this.places.filter((x) => x.id !== placeId);
    this.persist();
    this.notify();

    if (typeof window !== 'undefined') {
      if (isUuid(placeId)) {
        supabase.from('places').delete().eq('id', placeId).then(({ error }) => {
          if (error) console.warn('Supabase deletePlace error:', error.message);
        });
      }
      fetch(`/api/places?id=${encodeURIComponent(placeId)}`, { method: 'DELETE' }).catch((err) => {
        console.warn('API deletePlace error:', err);
      });
    }
    return true;
  }

  savePlace(place: Place): void {
    if (this.deletedPlaceIds.has(place.id)) {
      this.deletedPlaceIds.delete(place.id);
    }
    const ranges = getPriceRangesFromPlace(place);
    const enrichedPlace: Place = {
      ...place,
      price_ranges: ranges,
      price_level: place.price_level || (ranges.length > 0 ? calculatePriceLevel(ranges) : 2),
    };
    const idx = this.places.findIndex((x) => x.id === enrichedPlace.id);
    if (idx !== -1) {
      this.places[idx] = enrichedPlace;
    } else {
      this.places.unshift(enrichedPlace);
    }
    this.persist();
    this.notify();
  }

  getAllUsers(): UserProfile[] {
    return this.users.map((u) => ({
      ...u,
      review_count: this.reviews.filter((r) => r.user_id === u.id).length,
    }));
  }

  setUserLocked(userId: string, isLocked: boolean): boolean {
    const u = this.users.find((x) => x.id === userId);
    if (u) {
      u.is_locked = isLocked;
      this.persist();
      this.notify();
      if (typeof window !== 'undefined' && isUuid(userId)) {
        supabase.from('users').update({ is_locked: isLocked }).eq('id', userId).then();
      }
      return true;
    }
    return false;
  }

  toggleLockUser(userId: string, explicitStatus?: boolean): boolean {
    const u = this.users.find((x) => x.id === userId);
    if (u) {
      u.is_locked = explicitStatus !== undefined ? explicitStatus : !u.is_locked;
      this.persist();
      this.notify();
      if (typeof window !== 'undefined' && isUuid(userId)) {
        supabase.from('users').update({ is_locked: u.is_locked }).eq('id', userId).then();
      }
      return true;
    }
    return false;
  }

  syncUsersFromSupabase(dbUsers: UserProfile[]): void {
    if (!dbUsers || dbUsers.length === 0) return;
    const hasChanged =
      this.users.length !== dbUsers.length ||
      dbUsers.some((u, i) => {
        const cur = this.users[i];
        return (
          !cur ||
          cur.id !== u.id ||
          cur.role !== u.role ||
          cur.is_locked !== u.is_locked ||
          cur.email !== u.email ||
          cur.full_name !== u.full_name ||
          cur.avatar_url !== u.avatar_url
        );
      });
    if (!hasChanged) return;
    this.users = dbUsers;
    this.persist('users');
    this.notify();
  }

  updateUserAvatar(userId: string, avatarUrl: string): void {
    const idx = this.users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      this.users[idx].avatar_url = avatarUrl;
    }
    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser.avatar_url = avatarUrl;
    }
    this.persist();
    this.notify();
    if (typeof window !== 'undefined' && isUuid(userId)) {
      supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', userId).then();
    }
  }

  getAllReviewsAdmin(): Review[] {
    return this.reviews.map((r) => ({
      ...r,
      user: this.users.find((u) => u.id === r.user_id) || r.user,
    }));
  }

  toggleHideReview(reviewId: string): boolean {
    const r = this.reviews.find((x) => x.id === reviewId);
    if (r) {
      r.is_hidden = !r.is_hidden;
      this.persist();
      this.notify();
      try {
        supabase.from('reviews').update({ is_hidden: r.is_hidden }).eq('id', reviewId).then();
      } catch (e) {}
      return true;
    }
    return false;
  }

  getCategories(): Category[] {
    return this.categories;
  }

  saveCategory(cat: Category) {
    const idx = this.categories.findIndex((c) => c.id === cat.id);
    if (idx !== -1) {
      this.categories[idx] = cat;
      if (typeof window !== 'undefined') {
        supabase.from('categories').update({ name: cat.name, icon: cat.icon }).eq('id', cat.id).then();
      }
    } else {
      const tempId = typeof cat.id === 'number' && cat.id < 1000000000 ? cat.id : undefined;
      if (typeof window !== 'undefined') {
        const payload: any = { name: cat.name, icon: cat.icon };
        if (tempId) payload.id = tempId;
        supabase.from('categories').insert(payload).select().single().then(({ data }) => {
          if (data) {
            this.categories = this.categories.map((c) => (c.name === cat.name ? data : c));
            this.persist();
            this.notify();
          }
        });
      }
      this.categories.push({ ...cat, id: tempId || Date.now() });
    }
    this.persist();
    this.notify();
  }

  deleteCategory(catId: number) {
    this.categories = this.categories.filter((c) => c.id !== catId);
    this.persist();
    this.notify();
    if (typeof window !== 'undefined') {
      supabase.from('categories').delete().eq('id', catId).then();
    }
  }

  getAmenities(): Amenity[] {
    return this.amenities;
  }

  saveAmenity(am: Amenity) {
    const idx = this.amenities.findIndex((a) => a.id === am.id);
    if (idx !== -1) {
      this.amenities[idx] = am;
      if (typeof window !== 'undefined') {
        supabase.from('amenities').update({ name: am.name, icon: am.icon }).eq('id', am.id).then();
      }
    } else {
      const tempId = typeof am.id === 'number' && am.id < 1000000000 ? am.id : undefined;
      if (typeof window !== 'undefined') {
        const payload: any = { name: am.name, icon: am.icon };
        if (tempId) payload.id = tempId;
        supabase.from('amenities').insert(payload).select().single().then(({ data }) => {
          if (data) {
            this.amenities = this.amenities.map((a) => (a.name === am.name ? data : a));
            this.persist();
            this.notify();
          }
        });
      }
      this.amenities.push({ ...am, id: tempId || Date.now() });
    }
    this.persist();
    this.notify();
  }

  deleteAmenity(amId: number) {
    this.amenities = this.amenities.filter((a) => Number(a.id) !== Number(amId));
    this.persist();
    this.notify();
    if (typeof window !== 'undefined') {
      supabase.from('amenities').delete().eq('id', amId).then();
    }
  }

  getAdminStats() {
    const today = new Date().toDateString();
    const todayCheckins = this.checkins.filter(
      (c) => new Date(c.created_at).toDateString() === today
    ).length;

    const pendingProposals = this.places.filter((p) => p.status === 'pending').length;
    const pendingReports = this.reviewReports.filter((r) => r.status === 'pending').length;
    const totalViews = this.places.reduce((acc, p) => acc + p.view_count, 0);

    return {
      totalPlaces: this.places.length,
      approvedPlaces: this.places.filter((p) => p.status === 'approved').length,
      totalReviews: this.reviews.length,
      todayCheckins,
      pendingProposals,
      pendingReports,
      totalViews,
      totalUsers: this.users.length,
    };
  }

  /**
   * 14 days activity stats for checkins & reviews
   */
  getLast14DaysActivity() {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;

      const checkinsCount = this.checkins.filter((c) => c.created_at.startsWith(dateStr)).length;
      const reviewsCount = this.reviews.filter((r) => r.created_at.startsWith(dateStr)).length;

      // Realistic mock base if few items
      const baseCheckins = Math.floor(Math.sin(i * 0.8 + 2) * 5 + 8);
      const baseReviews = Math.floor(Math.cos(i * 0.6 + 1) * 3 + 4);

      days.push({
        date: dateStr,
        label: dayLabel,
        checkins: checkinsCount > 0 ? checkinsCount : baseCheckins,
        reviews: reviewsCount > 0 ? reviewsCount : baseReviews,
      });
    }
    return days;
  }

  getTopPlaces(limit: number = 5): Place[] {
    const enriched = this.getEnrichedPlaces();
    return enriched
      .filter((p) => p.status === 'approved')
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, limit);
  }
}

export const store = new StudySpotStore();
