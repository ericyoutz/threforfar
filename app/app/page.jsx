import { requireUser } from '@/lib/auth';
import { getDashboardData } from '@/lib/queries';
import DashboardClient from '@/components/DashboardClient';

export default async function AppPage() {
  const user = await requireUser();
  const initialData = await getDashboardData(user.id);
  return <DashboardClient initialData={initialData} />;
}
