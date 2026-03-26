import { getCurrentUser } from '@/lib/auth';
import { ensureInitialAdmin } from '@/lib/bootstrap';
import { redirect } from 'next/navigation';
import LoginView from '@/components/LoginView';

export default async function LoginPage() {
  await ensureInitialAdmin();
  const user = await getCurrentUser();
  if (user) {
    redirect('/app');
  }
  return <LoginView />;
}
