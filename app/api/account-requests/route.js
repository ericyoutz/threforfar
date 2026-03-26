import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { ensureInitialAdmin } from '@/lib/bootstrap';

export async function POST(request) {
  await ensureInitialAdmin();
  const body = await request.json();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: 'That email already has an approved account.' }, { status: 409 });
  }

  const existingRequest = await prisma.accountRequest.findUnique({ where: { email } });
  if (existingRequest) {
    return NextResponse.json({ error: 'That email already has a pending request.' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  await prisma.accountRequest.create({
    data: {
      name,
      email,
      passwordHash,
      status: 'PENDING'
    }
  });

  return NextResponse.json({ ok: true });
}
