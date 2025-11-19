'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WelcomeStep } from './WelcomeStep';
import { ProfileStep } from './ProfileStep';
import { CourseCatalogStep } from './CourseCatalogStep';
import { Loader2 } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  optional: boolean;
}

interface OnboardingData {
  name?: string;
  accommodations?: string[];
  firstCourseId?: string;
}

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome',
      description: 'Get started with Scottish AI Lessons',
      component: WelcomeStep,
      optional: false
    },
    {
      id: 'profile',
      title: 'Profile',
      description: 'Tell us about yourself',
      component: ProfileStep,
      optional: true
    },
    {
      id: 'course',
      title: 'First Course',
      description: 'Choose your first course',
      component: CourseCatalogStep,
      optional: true
    }
  ];

  const currentStep = steps[currentStepIndex];
  const StepComponent = currentStep.component;

  const handleNext = async (stepData?: any) => {
    setError(null);

    // Merge step data into onboarding data
    const updatedData = { ...onboardingData, ...stepData };
    setOnboardingData(updatedData);

    // If on profile step, update student record with accommodations
    if (currentStep.id === 'profile' && stepData?.name) {
      try {
        setProcessing(true);
        await updateStudentProfile(stepData);
      } catch (err) {
        setError('Failed to save profile. Please try again.');
        setProcessing(false);
        return;
      } finally {
        setProcessing(false);
      }
    }

    // If finishing with course selection, enroll student
    if (currentStep.id === 'course' && stepData?.firstCourseId) {
      try {
        setProcessing(true);
        await enrollInFirstCourse(stepData.firstCourseId);
        // Redirect to dashboard after enrollment
        router.push('/dashboard');
        return;
      } catch (err) {
        setError('Failed to enroll in course. Please try again from the course catalog.');
        setProcessing(false);
        return;
      } finally {
        setProcessing(false);
      }
    }

    // Move to next step or complete onboarding
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Onboarding complete - redirect to dashboard (or catalog if no course selected)
      if (updatedData.firstCourseId) {
        router.push('/dashboard');
      } else {
        router.push('/courses/catalog');
      }
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      setError(null);
    }
  };

  const handleSkip = () => {
    if (currentStep.optional) {
      handleNext();
    }
  };

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">
            {currentStep.id === 'course' ? 'Enrolling you in the course...' : 'Saving your profile...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-3xl w-full">
        {/* Progress indicator */}
        <div className="mb-8 bg-white rounded-lg shadow-sm p-4">
          <div className="flex justify-between mb-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`text-sm ${
                  index === currentStepIndex
                    ? 'text-blue-600 font-semibold'
                    : index < currentStepIndex
                    ? 'text-green-600'
                    : 'text-gray-400'
                }`}
              >
                <span className="hidden sm:inline">
                  Step {index + 1}: {step.title}
                </span>
                <span className="sm:hidden">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((currentStepIndex + 1) / steps.length) * 100}%`
              }}
            />
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Step content */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <StepComponent
            onNext={handleNext}
            onBack={handleBack}
            onSkip={currentStep.optional ? handleSkip : undefined}
          />
        </div>

        {/* Footer note */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>
            You can always update your profile and browse more courses from your dashboard
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper: Update student profile with accommodations
async function updateStudentProfile(data: { name: string; accommodations: string[] }) {
  const { Client, Account, Databases, Query } = await import('appwrite');

  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

  const account = new Account(client);
  const databases = new Databases(client);

  const user = await account.get();

  // Find student record by userId
  const studentsResult = await databases.listDocuments('default', 'students',
    [Query.equal('userId', user.$id)]
  );

  if (studentsResult.documents.length > 0) {
    // Update existing student record
    const student = studentsResult.documents[0];
    await databases.updateDocument(
      'default',
      'students',
      student.$id,
      {
        name: data.name,
        accommodations: JSON.stringify(data.accommodations)
      }
    );

    console.log('[Onboarding] Student profile updated:', {
      studentId: student.$id,
      name: data.name,
      accommodationCount: data.accommodations.length
    });
  }
}

// Helper: Enroll in first course via API (consistent with catalog page)
async function enrollInFirstCourse(courseId: string) {
  console.log('[Onboarding] Enrolling in first course via API:', courseId);

  // Use the same API as the catalog page for consistent behavior
  const response = await fetch('/api/student/enroll', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',  // Include auth cookies
    body: JSON.stringify({ courseId }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    // Handle specific error cases
    if (response.status === 401) {
      throw new Error('Not authenticated. Please log in.');
    }
    if (response.status === 409) {
      // Already enrolled - not an error for onboarding, just continue
      console.log('[Onboarding] Already enrolled in course, continuing...');
      return;
    }
    throw new Error(result.error || 'Failed to enroll in course');
  }

  console.log('[Onboarding] Successfully enrolled in first course:', {
    courseId,
    enrollment: result.enrollment?.$id
  });
}
