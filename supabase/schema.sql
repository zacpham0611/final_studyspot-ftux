-- STUDYSPOT FTU - FULL DATABASE SCHEMA (PostgreSQL + Supabase)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1. BẢNG USERS
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto trigger new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Người dùng'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. DỮ LIỆU BẢNG KHÁC
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.amenities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id INT REFERENCES public.categories(id),
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  description TEXT,
  opening_hours JSONB,
  price_level INT CHECK (price_level BETWEEN 1 AND 4),
  images TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  reject_reason TEXT,
  view_count INT DEFAULT 0,
  created_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.place_amenities (
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
  amenity_id INT REFERENCES public.amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (place_id, amenity_id)
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  rating INT CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  wifi_rating INT, outlet_rating INT, quiet_rating INT, price_rating INT, space_rating INT,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(place_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  level INT CHECK (level IN (1, 2, 3)) NOT NULL,
  note VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger cooldown checkin 30 phút (bỏ qua cho Admin và độ đông theo giờ do Admin thiết lập)
CREATE OR REPLACE FUNCTION check_checkin_cooldown()
RETURNS TRIGGER AS $$
DECLARE last_checkin TIMESTAMPTZ;
BEGIN
  -- Bỏ qua cooldown cho Admin hoặc bản ghi thiết lập độ đông theo giờ của Admin
  IF NEW.note ILIKE 'Admin%' OR EXISTS (SELECT 1 FROM public.users WHERE id = NEW.user_id AND role = 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT created_at INTO last_checkin FROM public.checkins
  WHERE user_id = NEW.user_id AND place_id = NEW.place_id
  ORDER BY created_at DESC LIMIT 1;

  IF last_checkin IS NOT NULL AND (now() - last_checkin) < INTERVAL '30 minutes' THEN
    RAISE EXCEPTION 'CHECKIN_COOLDOWN';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_checkin_cooldown
  BEFORE INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION check_checkin_cooldown();

CREATE TABLE IF NOT EXISTS public.favorites (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);

CREATE TABLE IF NOT EXISTS public.review_helpful (
  review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (review_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  noi_dung TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpful ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public users select" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users update own profile" ON public.users FOR UPDATE USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Public places select" ON public.places FOR SELECT USING (status = 'approved' OR auth.uid() = created_by OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "User places insert" ON public.places FOR INSERT WITH CHECK (auth.uid() = created_by OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Public reviews select" ON public.reviews FOR SELECT USING (is_hidden = false OR auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Public checkins select" ON public.checkins FOR SELECT USING (true);
CREATE POLICY "User checkin insert" ON public.checkins FOR INSERT WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "User review insert/update" ON public.reviews FOR ALL USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "User favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User review_helpful" ON public.review_helpful FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User report review" ON public.review_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin review_reports" ON public.review_reports FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "User notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admin places full" ON public.places FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 3. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('places', 'places', true), ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Storage Select" ON storage.objects FOR SELECT USING (bucket_id IN ('places', 'avatars'));
CREATE POLICY "User Avatar Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "User Avatar Update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Admin Places Storage" ON storage.objects FOR ALL USING (bucket_id = 'places' AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 4. KHI TRUY CẬP TÀI KHOẢN ADMIN MẶC ĐỊNH (admin123@ftu.edu.vn / 123456)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'admin123@ftu.edu.vn',
  crypt('123456', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Admin StudySpot", "role": "admin"}',
  now(), now()
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.users (id, full_name, email, role)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Admin StudySpot',
  'admin123@ftu.edu.vn',
  'admin'
)
ON CONFLICT (id) DO UPDATE SET role = 'admin';
