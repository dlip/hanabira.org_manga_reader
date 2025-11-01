import { BrokenReferencesClient } from './BrokenReferencesClient';

export const metadata = {
  title: 'Broken References | Mokuro Reader',
  description: 'Database cleanup - remove series with missing files',
};

export default function BrokenReferencesPage() {
  return <BrokenReferencesClient />;
}
