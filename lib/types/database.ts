// TypeScript Database Definitions for STUDYSPOT FTU

export type UserRole = 'user' | 'admin' | 'student';
export type PlaceStatus = 'pending' | 'approved' | 'rejected' | 'hidden';
export type CrowdLevel = 1 | 2 | 3; // 1: Vắng, 2: Vừa, 3: Đông
export type CrowdStatus = 'empty' | 'medium' | 'full' | 'unknown';
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  role: UserRole;
  is_locked: boolean;
  review_count?: number;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface Amenity {
  id: number;
  name: string;
  icon: string;
}

export interface DailyHours {
  open: string;  // "07:00"
  close: string; // "23:00"
  is_closed?: boolean;
}

export interface OpeningHours {
  monday?: DailyHours;
  tuesday?: DailyHours;
  wednesday?: DailyHours;
  thursday?: DailyHours;
  friday?: DailyHours;
  saturday?: DailyHours;
  sunday?: DailyHours;
  is_24h?: boolean;
}

export interface Place {
  id: string;
  name: string;
  category_id: number;
  category?: Category;
  address: string;
  lat: number;
  lng: number;
  description: string;
  opening_hours: OpeningHours;
  price_level: number; // 1: <30k, 2: 30k-50k, 3: 50k-70k, 4: >70k
  images: string[];
  status: PlaceStatus;
  reject_reason?: string | null;
  view_count: number;
  created_by?: string | null;
  creator?: UserProfile | null;
  approved_at?: string | null;
  created_at: string;
  amenities?: Amenity[];
  // Calculated client-side fields
  distance_meters?: number;
  crowd_score?: number;
  crowd_status?: CrowdStatus;
  crowd_label?: string;
  is_open?: boolean;
  is_late_night?: boolean;
  average_rating?: number;
  review_count?: number;
}

export interface Review {
  id: string;
  place_id: string;
  user_id: string;
  rating: number; // 1-5
  wifi_rating?: number;
  outlet_rating?: number;
  quiet_rating?: number;
  price_rating?: number;
  space_rating?: number;
  content: string;
  images?: string[];
  is_hidden: boolean;
  created_at: string;
  user?: {
    full_name: string;
    avatar_url?: string | null;
  };
  helpful_count?: number;
  is_helpful_by_me?: boolean;
}

export interface Checkin {
  id: string;
  place_id: string;
  user_id: string;
  level: CrowdLevel;
  note?: string;
  created_at: string;
  user?: {
    full_name: string;
    avatar_url?: string | null;
  };
}

export interface Favorite {
  user_id: string;
  place_id: string;
  created_at: string;
}

export interface ReviewHelpful {
  review_id: string;
  user_id: string;
}

export interface ReviewReport {
  id: string;
  review_id: string;
  user_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  review?: Review;
  user?: UserProfile;
}

export interface Notification {
  id: string;
  user_id: string;
  noi_dung: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface PlaceFilterOptions {
  query?: string;
  categoryId?: number | 'all';
  amenityIds?: number[];
  priceLevels?: number[];
  openNow?: boolean;
  openLate?: boolean;
  crowdStatus?: CrowdStatus[];
  sortBy?: 'distance' | 'rating' | 'crowd' | 'views';
  maxDistanceKm?: number;
}
