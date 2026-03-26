import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getApiAdmin } from '@/lib/auth';
import { getDashboardData } from '@/lib/queries';

export async function POST(request) {
  const admin = await getApiAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const title = String(body.title || '').trim();
  const message = String(body.body || '').trim();

  if (!title || !message) {
    return NextResponse.json({ error: 'Title and message are required.' }, { status: 400 });
  }

  await prisma.announcement.create({
    data: {
      title,
      body: message,
      createdById: admin.id
    }
  });

  const data = await getDashboardData(admin.id);
  return NextResponse.json({ ok: true, data });
}
