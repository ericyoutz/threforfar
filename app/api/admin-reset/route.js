/**
 * ONE-TIME admin password reset route.
 *
 * HOW TO USE:
 *   1. Add RESET_SECRET=any-long-random-string to your Vercel env vars and redeploy.
 *   2. Visit: https://your-app.vercel.app/api/admin-reset?secret=YOUR_RESET_SECRET&password=NEW_PASSWORD
 *   3. You'll see { ok: true } — then log in with the new password.
 *   4. Delete this file, commit, and redeploy to remove the route.
 *
 * SECURITY: The route does nothing unless RESET_SECRET is set AND the correct
 * secret is passed in the query string. It is safe to deploy but should be
 * removed after use.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function GET(request) {
  const resetSecret = process.env.RESET_SECRET;

  if (!resetSecret) {
    return NextResponse.json(
      { error: 'RESET_SECRET environment variable is not set. Add it in Vercel and redeploy.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const secret   = searchParams.get('secret')   || '';
  const password = searchParams.get('password') || '';
  const email    = searchParams.get('email')    || 'admin@ee.com';

  if (secret !== resetSecret) {
    return NextResponse.json({ error: 'Invalid reset secret.' }, { status: 403 });
  }

  if (password.length < 4) {
    return NextResponse.json({ error: 'Password must be at least 4 characters.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, status: 'ACTIVE' }
  });

  return NextResponse.json({
    ok: true,
    message: `Password for ${user.email} has been reset. Delete this route (app/api/admin-reset/route.js) and redeploy after logging in.`
  });
}
