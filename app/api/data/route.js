import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/auth';
import { getDashboardData } from '@/lib/queries';

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getDashboardData(user.id);
  return NextResponse.json({ ok: true, data });
}
