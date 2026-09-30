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
  ReviewReport
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
import { getOpeningStatus } from '@/lib/utils/hours';
import { matchesSearch } from '@/lib/utils/text';
import { supabase } from '@/lib/supabase/client';

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
        const storedPlaces = localStorage.getItem('studyspot_places_v2');
        if (storedPlaces) this.places = JSON.parse(storedPlaces);

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

  private persist() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('studyspot_places_v2', JSON.stringify(this.places));
        localStorage.setItem('studyspot_checkins_v2', JSON.stringify(this.checkins));
        localStorage.setItem('studyspot_reviews_v2', JSON.stringify(this.reviews));
        localStorage.setItem('studyspot_notifs_v2', JSON.stringify(this.notifications));
        localStorage.setItem('studyspot_reports_v2', JSON.stringify(this.reviewReports));
        localStorage.setItem('studyspot_users_v2', JSON.stringify(this.users));
        localStorage.setItem('studyspot_helpful_v2', JSON.stringify(Array.from(this.helpfulVotes)));
        
        const favsObj: { [k: string]: string[] } = {};
        for (const [k, v] of Object.entries(this.favorites)) {
          favsObj[k] = Array.from(v);
        }
        localStorage.setItem('studyspot_favs_v2', JSON.stringify(favsObj));

        if (this.currentUser) {
          localStorage.setItem('studyspot_current_user_v2', JSON.stringify(this.currentUser));
        } else {
          localStorage.removeItem('studyspot_current_user_v2');
        }
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }
  }

  // --- Auth methods ---
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

    // Default system admin: admin123@ftu.edu.vn / 123456
    if (cleanEmail === 'admin123@ftu.edu.vn' && pass === '123456') {
      this.currentUser = INITIAL_USERS[0];
      this.persist();
      return { success: true, user: this.currentUser };
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
    role: string = 'student'
  ): { success: boolean; user?: UserProfile; message?: string } {
    const cleanEmail = email.trim().toLowerCase();
    const existing = this.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return {
        success: false,
        message: 'Email này đã tồn tại trong hệ thống. Vui lòng đăng nhập!',
      };
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
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
      // Parallelize queries across all 4 tables in a single roundtrip batch
      const [usersRes, placesRes, reviewsRes, checkinsRes] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('places').select('*'),
        supabase.from('reviews').select('*, user:users(full_name, avatar_url)').order('created_at', { ascending: false }),
        supabase.from('checkins').select('*, user:users(full_name, avatar_url)').order('created_at', { ascending: false }),
      ]);

      if (usersRes.data && usersRes.data.length > 0) {
        this.users = usersRes.data;
      }

      if (placesRes.data && placesRes.data.length > 0) {
        this.places = placesRes.data.map((dp: any) => ({
          ...dp,
          opening_hours: typeof dp.opening_hours === 'string' ? JSON.parse(dp.opening_hours) : (dp.opening_hours || INITIAL_PLACES[0].opening_hours),
          price_level: dp.price_level || 2,
          images: dp.images || [],
          view_count: dp.view_count || 0,
        }));
      }

      if (reviewsRes.data && reviewsRes.data.length > 0) {
        this.reviews = reviewsRes.data;
      }

      if (checkinsRes.data && checkinsRes.data.length > 0) {
        this.checkins = checkinsRes.data;
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

    return this.places.map((place) => {
      const placeCheckins = this.checkins.filter((c) => c.place_id === place.id);
      const crowd = calculateCrowdStatus(placeCheckins);
      const distance = calculateDistance(place.lat, place.lng, targetLat, targetLng);
      const hours = getOpeningStatus(place.opening_hours);
      const placeReviews = this.reviews.filter((r) => r.place_id === place.id && !r.is_hidden);
      const avgRating =
        placeReviews.length > 0
          ? Math.round(
              (placeReviews.reduce((sum, r) => sum + r.rating, 0) / placeReviews.length) * 10
            ) / 10
          : 4.8;
      const cat = this.categories.find((c) => c.id === place.category_id);
      const creator = place.created_by ? this.users.find((u) => u.id === place.created_by) : null;

      return {
        ...place,
        category: cat,
        creator: creator || null,
        distance_meters: distance,
        crowd_score: crowd.score ?? undefined,
        crowd_status: crowd.status,
        crowd_label: crowd.label,
        is_open: hours.isOpen,
        is_late_night: hours.isLateNight,
        average_rating: avgRating,
        review_count: placeReviews.length,
      };
    });
  }

  filterPlaces(options: PlaceFilterOptions = {}, userLat?: number, userLng?: number): Place[] {
    const all = this.getEnrichedPlaces(userLat, userLng);

    return all.filter((p) => {
      if (p.status !== 'approved' && this.currentUser?.role !== 'admin') {
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
      return true;
    }
    return false;
  }

  removePlaceImage(placeId: string, imageIndex: number): boolean {
    const p = this.places.find((x) => x.id === placeId);
    if (p && p.images && imageIndex >= 0 && imageIndex < p.images.length) {
      p.images.splice(imageIndex, 1);
      this.persist();
      return true;
    }
    return false;
  }

  updatePlace(placeId: string, data: Partial<Place>): Place | null {
    const p = this.places.find((x) => x.id === placeId);
    if (!p) return null;
    Object.assign(p, data);
    this.persist();
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

    // Persist directly to Supabase Database
    try {
      supabase.from('checkins').insert({
        place_id: placeId,
        user_id: userId,
        level,
        note: note ? note.slice(0, 100) : null,
      }).select().single().then(({ data }) => {
        if (data?.id) {
          newCheckin.id = data.id;
          this.persist();
        }
      });
    } catch (e) {
      console.warn('Supabase checkin insert notice:', e);
    }

    return {
      success: true,
      message: 'Báo độ đông thành công! Cảm ơn bạn đã đóng góp cho cộng đồng FTU.',
      checkin: newCheckin,
    };
  }

  getCheckinsForPlace(placeId: string): Checkin[] {
    return this.checkins.filter((c) => c.place_id === placeId);
  }

  /**
   * Calculates hourly crowd histogram (07:00 to 22:00)
   */
  getHourlyCrowdData(placeId: string): { hour: number; label: string; score: number; level: CrowdStatus }[] {
    const placeCheckins = this.getCheckinsForPlace(placeId);
    const hourlyScores: { [h: number]: number[] } = {};

    for (let h = 7; h <= 22; h++) {
      hourlyScores[h] = [];
    }

    // Default realistic baseline if place doesn't have hundreds of logs
    const baseCurve: { [h: number]: number } = {
      7: 1.1, 8: 1.3, 9: 1.8, 10: 2.2, 11: 2.4, 12: 1.9,
      13: 1.5, 14: 1.3, 15: 1.4, 16: 1.6, 17: 1.9, 18: 2.3,
      19: 2.7, 20: 2.6, 21: 2.1, 22: 1.4
    };

    for (const c of placeCheckins) {
      const d = new Date(c.created_at);
      const h = d.getHours();
      if (hourlyScores[h]) {
        hourlyScores[h].push(c.level);
      }
    }

    const result = [];
    for (let h = 7; h <= 22; h++) {
      const logs = hourlyScores[h];
      let score = baseCurve[h] || 1.5;
      if (logs.length > 0) {
        score = logs.reduce((a, b) => a + b, 0) / logs.length;
      }
      
      let level: CrowdStatus = 'empty';
      if (score > 2.33) level = 'full';
      else if (score >= 1.67) level = 'medium';

      result.push({
        hour: h,
        label: `${h}:00`,
        score: Math.round(score * 10) / 10,
        level,
      });
    }

    return result;
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
    } else {
      this.helpfulVotes.add(key);
      rev.helpful_count += 1;
      isNowHelpful = true;
    }
    this.persist();
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
      return true;
    }
    return false;
  }

  // --- Notifications ---
  getNotifications(userId?: string): Notification[] {
    const uid = userId || this.currentUser?.id;
    if (!uid) return [];
    return this.notifications.filter((n) => n.user_id === uid);
  }

  getUnreadNotificationCount(userId?: string): number {
    return this.getNotifications(userId).filter((n) => !n.is_read).length;
  }

  markAllNotificationsRead(userId?: string): void {
    const uid = userId || this.currentUser?.id;
    if (!uid) return;
    for (const n of this.notifications) {
      if (n.user_id === uid) n.is_read = true;
    }
    this.persist();
  }

  markNotificationRead(notificationId: string): void {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.is_read = true;
      this.persist();
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
      id: `p-${Date.now()}`,
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
    this.createNotification(
      'a0000000-0000-0000-0000-000000000001',
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
      
      // Notify creator
      if (p.created_by) {
        this.createNotification(
          p.created_by,
          `Đề xuất địa điểm "${p.name}" của bạn đã được Admin phê duyệt và xuất bản!`,
          `/dia-diem/${p.id}`
        );
      }
      this.persist();
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
      return true;
    }
    return false;
  }

  deletePlace(placeId: string): boolean {
    const idx = this.places.findIndex((x) => x.id === placeId);
    if (idx !== -1) {
      this.places.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  savePlace(place: Place): void {
    const idx = this.places.findIndex((x) => x.id === place.id);
    if (idx !== -1) {
      this.places[idx] = place;
    } else {
      this.places.unshift(place);
    }
    this.persist();
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
      return true;
    }
    return false;
  }

  syncUsersFromSupabase(dbUsers: UserProfile[]): void {
    if (!dbUsers || dbUsers.length === 0) return;
    this.users = dbUsers;
    this.persist();
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
    } else {
      this.categories.push({ ...cat, id: Date.now() });
    }
    this.persist();
  }

  deleteCategory(catId: number) {
    this.categories = this.categories.filter((c) => c.id !== catId);
    this.persist();
  }

  getAmenities(): Amenity[] {
    return this.amenities;
  }

  saveAmenity(am: Amenity) {
    const idx = this.amenities.findIndex((a) => a.id === am.id);
    if (idx !== -1) {
      this.amenities[idx] = am;
    } else {
      this.amenities.push({ ...am, id: Date.now() });
    }
    this.persist();
  }

  deleteAmenity(amId: number) {
    this.amenities = this.amenities.filter((a) => a.id !== amId);
    this.persist();
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
