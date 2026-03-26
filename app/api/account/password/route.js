import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getApiUser, verifyPassword, hashPassword } from '@/lib/auth';

export async function PUT(request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const currentPassword = String(body.currentPassword || '');
  const newPassword     = String(body.newPassword     || '').trim();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Both current and new password are required.' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }

  // Fetch the stored hash (not included in session payload)
  const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
  const valid = await verifyPassword(currentPassword, fullUser.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 403 });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });

  return NextResponse.json({ ok: true });
}
