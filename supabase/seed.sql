-- STUDYSPOT FTU - Seed Data
-- Seed Categories
INSERT INTO public.categories (id, name, icon) VALUES
(1, 'Quán Cà Phê Học Tập', 'Coffee'),
(2, 'Thư Viện & Co-working', 'BookOpen'),
(3, 'Trà Sữa & Đồ Uống', 'CupSoda'),
(4, 'Không Gian Yên Tĩnh', 'Sparkles')
ON CONFLICT (id) DO NOTHING;

-- Seed Amenities
INSERT INTO public.amenities (id, name, icon) VALUES
(1, 'Wifi Tốc Độ Cao', 'Wifi'),
(2, 'Nhiều Ổ Điện', 'Zap'),
(3, 'Bàn Lớn Học Nhóm', 'Users'),
(4, 'Yên Tĩnh Tuyệt Đối', 'VolumeX'),
(5, 'Điều Hòa Mát Lạnh', 'Wind'),
(6, 'Chỗ Gửi Xe Miễn Phí', 'Bike'),
(7, 'Đồ Uống Giá Sinh Viên', 'Tag'),
(8, 'Mở Muộn / 24/7', 'Moon')
ON CONFLICT (id) DO NOTHING;
