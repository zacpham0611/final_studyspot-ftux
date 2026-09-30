import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { Header } from '@/components/common/Header';
import { BottomNav } from '@/components/common/BottomNav';
import { ToastProvider } from '@/components/common/Toast';
import { AuthProvider } from '@/components/auth/AuthContext';

export const metadata: Metadata = {
  title: 'STUDYSPOT FTU - Bản đồ địa điểm học tập quanh ĐH Ngoại thương',
  description: 'Khám phá quán cà phê, thư viện, không gian học tập yên tĩnh, cập nhật độ đông thời gian thực quanh FTU Hà Nội.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen flex flex-col bg-page">
        <AuthProvider>
          <ToastProvider>
            <Header />
            <main className="flex-1 flex flex-col">{children}</main>
            <BottomNav />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
