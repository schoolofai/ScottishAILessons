import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, getSessionFromCookie } from "@/lib/appwrite/server";

export async function GET(request: NextRequest) {
  try {
    // Check cookie directly from request
    const sessionFromCookie = request.cookies.get("appwrite-session")?.value;
    
    // Check using our helper function
    const sessionFromHelper = await getSessionFromCookie();
    
    let userInfo = null;
    if (sessionFromCookie) {
      try {
        const { account } = createSessionClient(sessionFromCookie);
        userInfo = await account.get();
      } catch (error) {
        userInfo = { error: error.message };
      }
    }
    
    return NextResponse.json({
      sessionFromCookie: sessionFromCookie ? "exists" : "missing",
      sessionFromHelper: sessionFromHelper ? "exists" : "missing",
      cookiesDebug: {
        all: request.cookies.getAll(),
        appwriteSession: request.cookies.get("appwrite-session")
      },
      userInfo
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}