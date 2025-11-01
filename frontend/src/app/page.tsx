import React, { Suspense } from 'react';
import MainLayout from '@/components/MainLayout';

export default function Home() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-600">Loading reader...</div>}>
      <MainLayout />
    </Suspense>
  );
}
