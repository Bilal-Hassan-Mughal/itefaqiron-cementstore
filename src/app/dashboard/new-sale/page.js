import { redirect } from 'next/navigation';

export default function NewSalePage() {
  // Server-side redirect to sales page
  redirect('/dashboard/sales');
}

