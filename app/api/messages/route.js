import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getApiUser } from '@/lib/auth';
import { getDashboardData } from '@/lib/queries';
import { notifyNewMessage } from '@/lib/notify';

export async function POST(request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const chatId = Number(body.chatId);
  const message = String(body.message || '').trim();

  if (!chatId || !message) {
    return NextResponse.json({ error: 'Chat and message are required.' }, { status: 400 });
  }

  // Verify sender is a member of this chat
  const membership = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId: user.id } }
  });

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Save the message
  await prisma.message.create({
    data: {
      chatId,
      senderId: user.id,
      body: message
    }
  });

  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() }
  });

  // Fetch chat + members for notifications (fire-and-forget, never blocks response)
  prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      members: {
        include: {
          user: {
            include: { profile: true }
          }
        }
      }
    }
  }).then((chat) => {
    if (!chat) return;
    const members = chat.members.map((m) => m.user);
    notifyNewMessage({
      sender: user,
      chat: { id: chat.id, title: chat.title },
      messageText: message,
      members
    });
  }).catch(() => {});

  const data = await getDashboardData(user.id);
  return NextResponse.json({ ok: true, data });
}
