"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LessonDriver, SessionDriver, EvidenceDriver, useAppwrite, type LessonSnapshot } from "@/lib/appwrite";

interface LessonRunnerProps {
  sessionId: string;
}

export function LessonRunner({ sessionId }: LessonRunnerProps) {
  const router = useRouter();
  const { createDriver } = useAppwrite();
  
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [lessonSnapshot, setLessonSnapshot] = useState<LessonSnapshot | null>(null);
  const [currentCard, setCurrentCard] = useState<any>(null);
  const [progress, setProgress] = useState({ currentCard: 0, totalCards: 0, completed: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userResponse, setUserResponse] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadSession();
  }, [sessionId]);
  
  const loadSession = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const sessionDriver = createDriver(SessionDriver);
      const sessionState = await sessionDriver.getSessionState(sessionId);
      const currentCardData = await sessionDriver.getCurrentCard(sessionId);
      
      setCurrentSession(sessionState.session);
      setLessonSnapshot(sessionState.parsedSnapshot);
      setCurrentCard(currentCardData.card);
      setProgress(sessionState.progress);
      
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load session';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const submitResponse = async () => {
    if (!currentSession || !lessonSnapshot || !currentCard || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      
      // Record evidence using the driver
      const evidenceDriver = createDriver(EvidenceDriver);
      await evidenceDriver.recordEvidence({
        sessionId: currentSession.$id,
        itemId: currentCard.cfu.id,
        response: userResponse,
        correct: checkAnswer(currentCard.cfu, userResponse)
      });
      
      // Simple client-side marking for MVP
      const correct = checkAnswer(currentCard.cfu, userResponse);
      setIsCorrect(correct);
      
      if (correct) {
        setFeedback("Correct! Well done.");
        // Move to next card after a delay
        setTimeout(() => {
          if (progress.currentCard < progress.totalCards - 1) {
            // This would trigger refresh in a more complete implementation
            router.push(`/session/${currentSession.$id}`);
          } else {
            setFeedback("Lesson complete! Great job.");
            setTimeout(() => {
              router.push('/dashboard');
            }, 2000);
          }
        }, 2000);
      } else {
        setFeedback(getFeedback(currentCard.cfu, userResponse));
      }
      
    } catch (err) {
      console.error('Failed to submit response:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkAnswer = (cfu: any, response: string): boolean => {
    if (cfu.type === "numeric") {
      const numResponse = parseFloat(response.replace(/[£,]/g, ''));
      const expected = typeof cfu.expected === 'number' ? cfu.expected : parseFloat(String(cfu.expected));
      const tolerance = cfu.tolerance || 0;
      return Math.abs(numResponse - expected) <= tolerance;
    } else if (cfu.type === "mcq") {
      const selectedIndex = cfu.options?.indexOf(response) ?? -1;
      return selectedIndex === cfu.answerIndex;
    }
    return false;
  };

  const getFeedback = (cfu: any, response: string): string => {
    if (cfu.type === "numeric") {
      return `Not quite right. Remember to round money to 2 decimal places. Try again.`;
    } else if (cfu.type === "mcq") {
      return `That's not correct. Think about the unit price (cost per 100g). Try again.`;
    }
    return "Try again.";
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading lesson...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">Error: {error}</div>
          <button 
            onClick={() => router.push('/dashboard')}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!currentSession || !lessonSnapshot || !currentCard) {
    return <div>Session not found</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">{lessonSnapshot.title}</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Exit Lesson
          </button>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress.currentCard / progress.totalCards * 100}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Card {progress.currentCard + 1} of {progress.totalCards}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {currentCard.title}
        </h2>
        
        <div className="prose max-w-none mb-6">
          <p className="text-gray-700 mb-4">{currentCard.explainer}</p>
          
          {currentCard.example && (
            <div className="bg-blue-50 border-l-4 border-blue-200 p-4 mb-4">
              <h4 className="font-medium text-blue-900 mb-2">Example:</h4>
              {currentCard.example.map((ex, idx) => (
                <p key={idx} className="text-blue-800 font-mono text-sm">{ex}</p>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-medium text-gray-900 mb-3">Check for Understanding</h3>
          <p className="text-gray-700 mb-4">{currentCard.cfu.stem}</p>
          
          {currentCard.cfu.type === "numeric" ? (
            <div className="space-y-3">
              <input
                type="text"
                value={userResponse}
                onChange={(e) => setUserResponse(e.target.value)}
                placeholder="Enter your answer..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {currentCard.cfu.options?.map((option, idx) => (
                <label key={idx} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mcq"
                    value={option}
                    checked={userResponse === option}
                    onChange={(e) => setUserResponse(e.target.value)}
                    className="text-blue-600 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          )}
          
          <button
            onClick={submitResponse}
            disabled={!userResponse.trim() || isSubmitting}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Checking...' : 'Submit'}
          </button>
          
          {feedback && (
            <div className={`mt-4 p-3 rounded ${
              isCorrect === true 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : isCorrect === false
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {feedback}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}