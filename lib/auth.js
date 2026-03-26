import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

const SESSION_COOKIE = 'threforfar_session';
const encoder = new TextEncoder();

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is required');
  }
  return encoder.encode(secret);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSession(user) {
  return new SignJWT({
    userId: user.id,
    role: user.role,
    email: user.email,
    name: user.name
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function setSessionCookie(token) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0)
  });
}

export async function getSessionPayload() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, getSecret());
    return verified.payload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const payload = await getSessionPayload();
  if (!payload?.userId) return null;

  return prisma.user.findUnique({
    where: { id: Number(payload.userId) },
    include: { profile: true }
  });
}

export async function getApiUser() {
  const user = await getCurrentUser();
  if (!user || user.status !== 'ACTIVE') {
    return null;
  }
  return user;
}

export async function getApiAdmin() {
  const user = await getApiUser();
  if (!user || user.role !== 'ADMIN') {
    return null;
  }
  return user;
}

export async function requireUser() {
  const user = await getApiUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') {
    redirect('/app');
  }
  return user;
}
