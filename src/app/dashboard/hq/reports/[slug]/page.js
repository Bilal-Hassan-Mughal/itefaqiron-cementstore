'use client';

import { useParams } from 'next/navigation';
import HqReportPage from '../../components/hq-report-page';

export default function HqReportSlugPage() {
  const params = useParams();
  return <HqReportPage slug={params?.slug} />;
}
