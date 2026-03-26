import { prisma } from '@/lib/db';

function formatTime(date) {
  const value = new Date(date);
  return value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatRelative(date) {
  const value = new Date(date);
  const now = new Date();
  const sameDay = value.toDateString() === now.toDateString();
  if (sameDay) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (value.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function getDashboardData(userId) {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true }
  });

  if (!currentUser) {
    throw new Error('User not found');
  }

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    include: { profile: true }
  });

  const chats = await prisma.chat.findMany({
    where: {
      members: {
        some: { userId }
      }
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      members: {
        include: { user: true },
        orderBy: { user: { name: 'asc' } }
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { sender: true }
      }
    }
  });

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  const pendingUsers = currentUser.role === 'ADMIN'
    ? await prisma.accountRequest.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' }
      })
    : [];

  return {
    currentUser: {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      initials: currentUser.name.slice(0, 2).toUpperCase(),
      profile: currentUser.profile
        ? {
            character: currentUser.profile.characterName,
            faction: currentUser.profile.faction,
            style: currentUser.profile.styleNotes
          }
        : null
    },
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      initials: user.name.slice(0, 2).toUpperCase()
    })),
    pendingUsers: pendingUsers.map((request) => ({
      id: request.id,
      name: request.name,
      email: request.email,
      status: 'Pending approval'
    })),
    announcements: announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      time: formatRelative(announcement.createdAt)
    })),
    chats: chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      description: chat.description || '',
      members: chat.members.map((member) => member.userId),
      messages: chat.messages.map((message) => ({
        id: message.id,
        senderId: message.senderId,
        text: message.body,
        time: formatTime(message.createdAt)
      }))
    }))
  };
}
