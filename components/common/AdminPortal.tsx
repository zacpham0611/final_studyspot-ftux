'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface AdminPortalProps {
  children: React.ReactNode;
  isOpen?: boolean;
}

// Global active modal counter to properly manage document.body overflow lock with multiple/nested modals
let activeModalCount = 0;

export function AdminPortal({ children, isOpen = true }: AdminPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    activeModalCount++;
    if (activeModalCount === 1) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen, mounted]);

  if (!mounted || !isOpen) return null;

  return createPortal(children, document.body);
}
