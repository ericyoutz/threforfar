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
  const chatId = Number(body.chatId);
  const userId = Number(body.userId);

  if (!chatId || !userId) {
    return NextResponse.json({ error: 'Chat id and user id are required.' }, { status: 400 });
  }

  const [chat, user] = await Promise.all([
    prisma.chat.findUnique({ where: { id: chatId } }),
    prisma.user.findUnique({ where: { id: userId } })
  ]);

  if (!chat) {
    return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
  }
  if (!user || user.role === 'ADMIN' || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  if (userId === admin.id) {
    const data = await getDashboardData(admin.id);
    return NextResponse.json({ ok: true, data });
  }

  const existing = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } }
  });

  if (existing) {
    await prisma.chatMember.delete({ where: { id: existing.id } });
  } else {
    await prisma.chatMember.create({
      data: { chatId, userId }
    });
  }

  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() }
  });

  const data = await getDashboardData(admin.id);
  return NextResponse.json({ ok: true, data });
}
