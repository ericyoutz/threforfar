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

  const characterName = body.characterName !== undefined ? String(body.characterName).trim() || null : undefined;
  const faction       = body.faction       !== undefined ? String(body.faction).trim()       || null : undefined;
  const styleNotes    = body.styleNotes    !== undefined ? String(body.styleNotes).trim()    || null : undefined;
  const phone         = body.phone         !== undefined ? String(body.phone).trim()         || null : undefined;

  // Validate phone format if provided (must be E.164: +[country code][number])
  if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) {
    return NextResponse.json(
      { error: 'Phone must be in E.164 format, e.g. +15550001234' },
      { status: 400 }
    );
  }

  const updateData = {};
  if (characterName !== undefined) updateData.characterName = characterName;
  if (faction       !== undefined) updateData.faction       = faction;
  if (styleNotes    !== undefined) updateData.styleNotes    = styleNotes;
  if (phone         !== undefined) updateData.phone         = phone;

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: updateData,
    create: {
      userId: user.id,
      ...updateData
    }
  });

  const data = await getDashboardData(user.id);
  return NextResponse.json({ ok: true, data });
}
