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
  const description = String(body.description || '').trim();
  const memberIds = Array.isArray(body.memberIds) ? body.memberIds.map(Number).filter(Boolean) : [];

  if (!title) {
    return NextResponse.json({ error: 'Room title is required.' }, { status: 400 });
  }

  const activeUsers = await prisma.user.findMany({
    where: {
      id: { in: memberIds },
      status: 'ACTIVE'
    },
    select: { id: true }
  });

  const uniqueMembers = Array.from(new Set([admin.id, ...activeUsers.map((user) => user.id)]));

  await prisma.$transaction(async (tx) => {
    const chat = await tx.chat.create({
      data: {
        title,
        description,
        createdById: admin.id
      }
    });

    await tx.chatMember.createMany({
      data: uniqueMembers.map((userId) => ({ chatId: chat.id, userId }))
    });

    await tx.message.create({
      data: {
        chatId: chat.id,
        senderId: admin.id,
        body: 'Thread created by administrator. Access granted to assigned members only.'
      }
    });
  });

  const data = await getDashboardData(admin.id);
  return NextResponse.json({ ok: true, data });
}
