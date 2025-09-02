import { NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/appwrite/client';
import { getSessionFromCookie, deleteSessionCookie } from '@/lib/appwrite/server';

export async function POST() {
  try {
    const session = await getSessionFromCookie();
    
    if (session) {
      const { account } = createSessionClient(session);
      
      try {
        await account.deleteSession('current');
      } catch (error) {
        console.error('Error deleting session:', error);
      }
    }
    
    await deleteSessionCookie();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}