import React from 'react';
import { OrphanClient } from './OrphanClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return <OrphanClient />;
}
