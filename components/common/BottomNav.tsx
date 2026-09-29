'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, Heart, PlusCircle, User } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();

  // Hide on admin routes
  if (pathname.startsWith('/admin')) {
    return null;
  }

  const navItems = [
    { label: 'Bản đồ', href: '/', icon: MapPin },
    { label: 'Yêu thích', href: '/yeu-thich', icon: Heart },
    { label: 'Đề xuất', href: '/de-xuat', icon: PlusCircle },
    { label: 'Hồ sơ', href: '/ho-so', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-elevated safe-area-pb">
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? 'text-burgundy font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-burgundy scale-110' : ''} transition-transform`} />
              <span className="text-[11px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
