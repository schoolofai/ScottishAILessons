import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, ID } from '@/lib/appwrite/client';
import { createSessionCookie, syncUserToStudentsCollection } from '@/lib/appwrite/server';
import { getErrorMessage } from '@/lib/appwrite/auth';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    const { account } = createAdminClient();

    try {
      const user = await account.create(
        ID.unique(),
        email,
        password,
        name
      );

      const session = await account.createEmailPasswordSession(email, password);
      
      await createSessionCookie(session.secret);
      
      await syncUserToStudentsCollection(user.$id, user.name, 'student');

      return NextResponse.json({ success: true, userId: user.$id });
    } catch (error) {
      return NextResponse.json(
        { error: getErrorMessage(error) },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}