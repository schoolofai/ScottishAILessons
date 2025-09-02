import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <Link href="/" className="flex items-center justify-center gap-2 mb-8">
            <GraduationCap className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold">Scottish AI Lessons</span>
          </Link>
          
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}