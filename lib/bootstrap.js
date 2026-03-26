import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function ensureInitialAdmin() {
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existingAdmin) return existingAdmin;

  const email = (process.env.INITIAL_ADMIN_EMAIL || 'admin@ee.com').trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD || '1234';
  const name = process.env.INITIAL_ADMIN_NAME || 'Admin';

  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      profile: {
        create: {
          characterName: null,
          faction: null,
          styleNotes: null,
          avatarUrl: null
        }
      }
    },
    include: { profile: true }
  });

  const countAnnouncements = await prisma.announcement.count();
  if (countAnnouncements === 0) {
    await prisma.announcement.createMany({
      data: [
        {
          title: 'Canon update',
          body: 'The administrator updated the archive rules for shared lore threads.',
          createdById: admin.id
        },
        {
          title: 'New scene room',
          body: 'A new private room can now be created for side stories and small group scenes.',
          createdById: admin.id
        }
      ]
    });
  }

  return admin;
}
