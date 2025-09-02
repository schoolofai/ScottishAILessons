import { SignupForm } from '@/components/auth/SignupForm';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <Link href="/" className="flex items-center justify-center gap-2 mb-8">
            <GraduationCap className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold">Scottish AI Lessons</span>
          </Link>
          
          <h1 className="text-2xl font-bold text-center mb-2">Create Account</h1>
          <p className="text-gray-600 text-center mb-8">
            Start your AI-powered learning journey today
          </p>
          
          <SignupForm />
        </div>
      </div>
    </div>
  );
}