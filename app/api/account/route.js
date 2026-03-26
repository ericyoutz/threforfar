import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getApiUser } from '@/lib/auth';
import { getDashboardData } from '@/lib/queries';

export async function PUT(request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const name  = body.name  !== undefined ? String(body.name).trim()  : undefined;
  const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;

  if (name !== undefined && !name) {
    return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 });
  }

  if (email !== undefined) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    // Make sure the email isn't already taken by someone else
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: 'That email address is already in use.' }, { status: 409 });
    }
  }

  const updateData = {};
  if (name  !== undefined) updateData.name  = name;
  if (email !== undefined) updateData.email = email;

  await prisma.user.update({
    where: { id: user.id },
    data: updateData
  });

  const data = await getDashboardData(user.id);
  return NextResponse.json({ ok: true, data });
}
