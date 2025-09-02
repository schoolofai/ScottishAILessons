import { cookies } from 'next/headers';
import { createAdminClient, createSessionClient, appwriteConfig } from './client';

export const SESSION_COOKIE_NAME = 'appwrite-session';

export async function getSessionFromCookie() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  return sessionCookie?.value;
}

export async function createSessionCookie(secret: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser() {
  try {
    const session = await getSessionFromCookie();
    if (!session) return null;
    
    const { account } = createSessionClient(session);
    const user = await account.get();
    return user;
  } catch (error) {
    return null;
  }
}

export async function syncUserToStudentsCollection(userId: string, name: string, role: 'student' | 'teacher' = 'student') {
  const { databases } = createAdminClient();
  
  try {
    const existingDoc = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.studentsCollectionId,
      userId
    );
    return existingDoc;
  } catch (error) {
    try {
      const newDoc = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.studentsCollectionId,
        userId,
        {
          userId,
          name,
          role,
        },
        [`read("user:${userId}")`, `write("user:${userId}")`]
      );
      return newDoc;
    } catch (createError) {
      console.error('Error syncing user to students collection:', createError);
      return null;
    }
  }
}