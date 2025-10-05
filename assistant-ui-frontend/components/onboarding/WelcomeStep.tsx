'use client';

import { Button } from '../ui/button';
import { GraduationCap, Brain, Target } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div className="text-center mb-8">
        <GraduationCap className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">
          Welcome to Scottish AI Lessons!
        </h1>
        <p className="text-lg text-gray-600">
          Your personalized AI-powered learning journey starts here
        </p>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-6 my-8">
        <div className="text-center p-4">
          <Brain className="h-12 w-12 text-purple-600 mx-auto mb-3" />
          <h3 className="font-semibold mb-2">AI-Powered Teaching</h3>
          <p className="text-sm text-gray-600">
            Personalized lessons that adapt to your learning style
          </p>
        </div>

        <div className="text-center p-4">
          <Target className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <h3 className="font-semibold mb-2">Track Progress</h3>
          <p className="text-sm text-gray-600">
            Monitor your mastery of learning outcomes in real-time
          </p>
        </div>

        <div className="text-center p-4">
          <GraduationCap className="h-12 w-12 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold mb-2">Scottish Curriculum</h3>
          <p className="text-sm text-gray-600">
            Aligned with National qualifications and outcomes
          </p>
        </div>
      </div>

      {/* What to expect */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 my-6">
        <h3 className="font-semibold mb-3">What to expect next:</h3>
        <ol className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start">
            <span className="font-semibold text-blue-600 mr-2">1.</span>
            <span>Tell us a bit about yourself (optional)</span>
          </li>
          <li className="flex items-start">
            <span className="font-semibold text-blue-600 mr-2">2.</span>
            <span>Browse our course catalog</span>
          </li>
          <li className="flex items-start">
            <span className="font-semibold text-blue-600 mr-2">3.</span>
            <span>Enroll in your first course and start learning!</span>
          </li>
        </ol>
      </div>

      {/* CTA button */}
      <div className="flex justify-end pt-4">
        <Button
          size="lg"
          onClick={onNext}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Get Started →
        </Button>
      </div>
    </div>
  );
}
