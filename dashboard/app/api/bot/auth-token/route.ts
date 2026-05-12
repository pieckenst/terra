import { auth } from '@/lib/auth';
import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';

/**
 * Short-lived HS256 JWT for the bot API (REST + WebSocket).
 * Same secret and payload shape as requireRole /ws expect: { user: { id } }.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'NEXTAUTH_SECRET is not set' }, { status: 500 });
  }

  const exp = Math.floor(Date.now() / 1000) + 15 * 60;
  const token = await new SignJWT({
    user: { id: session.user.id }
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token, expiresAt: exp * 1000 });
}
