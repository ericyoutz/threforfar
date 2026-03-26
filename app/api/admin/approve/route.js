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
  const requestId = Number(body.requestId);

  if (!requestId) {
    return NextResponse.json({ error: 'Request id is required.' }, { status: 400 });
  }

  const pending = await prisma.accountRequest.findUnique({ where: { id: requestId } });
  if (!pending || pending.status !== 'PENDING') {
    return NextResponse.json({ error: 'Pending request not found.' }, { status: 404 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: pending.email } });
  if (existingUser) {
    await prisma.accountRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        approvedById: admin.id
      }
    });
    return NextResponse.json({ error: 'That email already has an approved account.' }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: pending.name,
        email: pending.email,
        passwordHash: pending.passwordHash,
        role: 'WRITER',
        status: 'ACTIVE'
      }
    });

    await tx.profile.create({
      data: {
        userId: createdUser.id,
        characterName: `${pending.name} Character`,
        faction: 'Unassigned',
        styleNotes: 'Open writing style'
      }
    });

    await tx.accountRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedById: admin.id
      }
    });
  });

  const data = await getDashboardData(admin.id);
  return NextResponse.json({ ok: true, data });
}
