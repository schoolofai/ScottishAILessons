"use client";

/**
 * WizardCelebration - Session completion celebration screen
 *
 * Displays celebratory animations, session statistics, and navigation
 * back to the dashboard or to continue practicing.
 */

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Star,
  Target,
  Clock,
  Zap,
  Home,
  RotateCcw,
  Share2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export interface SessionStats {
  total_questions: number;
  correct_answers: number;
  total_xp_earned: number;
  blocks_completed: number;
  total_blocks: number;
  final_mastery: number;
  session_duration_minutes?: number;
  longest_streak?: number;
  hints_used?: number;
}

interface WizardCelebrationProps {
  stats: SessionStats;
  lessonTitle?: string;
  onPracticeMore?: () => void;
}

// Confetti particle component
function ConfettiParticle({ delay, x }: { delay: number; x: number }) {
  const colors = [
    "#58CC02", // green
    "#1CB0F6", // blue
    "#FFC800", // gold
    "#FF4B4B", // red
    "#CE82FF", // purple
    "#FF9600", // orange
  ];

  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const randomRotation = Math.random() * 360;
  const randomSize = 8 + Math.random() * 8;

  return (
    <motion.div
      initial={{
        y: -20,
        x: x,
        rotate: 0,
        opacity: 1,
      }}
      animate={{
        y: 600,
        x: x + (Math.random() - 0.5) * 200,
        rotate: randomRotation + 720,
        opacity: 0,
      }}
      transition={{
        duration: 3 + Math.random() * 2,
        delay: delay,
        ease: "linear",
      }}
      style={{
        position: "absolute",
        top: 0,
        width: randomSize,
        height: randomSize,
        backgroundColor: randomColor,
        borderRadius: Math.random() > 0.5 ? "50%" : "2px",
      }}
    />
  );
}

export function WizardCelebration({
  stats,
  lessonTitle,
  onPracticeMore,
}: WizardCelebrationProps) {
  const router = useRouter();
  const [showConfetti, setShowConfetti] = useState(true);

  const accuracy =
    stats.total_questions > 0
      ? Math.round((stats.correct_answers / stats.total_questions) * 100)
      : 0;

  const isPerfect = accuracy === 100 && stats.total_questions > 0;
  const isGreat = accuracy >= 80;

  // Stop confetti after a few seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleGoHome = () => {
    router.push("/dashboard");
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-purple-50 via-white to-blue-50 overflow-hidden">
      {/* Confetti Layer */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {Array.from({ length: 50 }).map((_, i) => (
            <ConfettiParticle
              key={i}
              delay={i * 0.05}
              x={Math.random() * (typeof window !== "undefined" ? window.innerWidth : 1000)}
            />
          ))}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Trophy Section */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          className="text-center mb-8"
        >
          <div className="relative inline-block">
            <motion.div
              animate={{
                rotate: [0, -5, 5, -5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
              }}
              className={`
                w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center
                ${
                  isPerfect
                    ? "bg-gradient-to-br from-yellow-400 to-amber-500 shadow-xl shadow-amber-200"
                    : isGreat
                    ? "bg-gradient-to-br from-emerald-400 to-green-500 shadow-xl shadow-emerald-200"
                    : "bg-gradient-to-br from-blue-400 to-cyan-500 shadow-xl shadow-blue-200"
                }
              `}
            >
              <Trophy className="w-16 h-16 text-white" />
            </motion.div>

            {/* Stars for perfect score */}
            {isPerfect && (
              <>
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="absolute -top-2 -left-4"
                >
                  <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                </motion.div>
                <motion.div
                  initial={{ scale: 0, rotate: 30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.6, type: "spring" }}
                  className="absolute -top-2 -right-4"
                >
                  <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                </motion.div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.7, type: "spring" }}
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2"
                >
                  <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                </motion.div>
              </>
            )}
          </div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-4xl font-bold text-gray-800 mb-2"
          >
            {isPerfect
              ? "Perfect Score!"
              : isGreat
              ? "Great Job!"
              : "Session Complete!"}
          </motion.h1>

          {lessonTitle && (
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-gray-500 text-lg"
            >
              {lessonTitle}
            </motion.p>
          )}
        </motion.div>

        {/* XP Banner */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, type: "spring" }}
          className="bg-gradient-to-r from-purple-500 to-violet-500 rounded-3xl p-6 mb-8 text-center text-white shadow-xl"
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap className="w-6 h-6 text-yellow-300" />
            <span className="text-sm font-medium opacity-90">XP Earned</span>
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
            className="text-5xl font-bold"
          >
            +{stats.total_xp_earned}
          </motion.div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-2 gap-4 mb-8"
        >
          {/* Accuracy */}
          <div className="wizard-card p-5 text-center">
            <Target className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <div className="text-3xl font-bold text-gray-800">{accuracy}%</div>
            <div className="text-sm text-gray-500">Accuracy</div>
            <div className="text-xs text-gray-400 mt-1">
              {stats.correct_answers}/{stats.total_questions} correct
            </div>
          </div>

          {/* Mastery */}
          <div className="wizard-card p-5 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-500" />
            <div className="text-3xl font-bold text-gray-800">
              {Math.round(stats.final_mastery * 100)}%
            </div>
            <div className="text-sm text-gray-500">Mastery</div>
            <div className="text-xs text-gray-400 mt-1">
              {stats.blocks_completed}/{stats.total_blocks} blocks
            </div>
          </div>

          {/* Duration */}
          {stats.session_duration_minutes && (
            <div className="wizard-card p-5 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <div className="text-3xl font-bold text-gray-800">
                {stats.session_duration_minutes}
              </div>
              <div className="text-sm text-gray-500">Minutes</div>
            </div>
          )}

          {/* Streak */}
          {stats.longest_streak && stats.longest_streak > 1 && (
            <div className="wizard-card p-5 text-center">
              <Zap className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              <div className="text-3xl font-bold text-gray-800">
                {stats.longest_streak}
              </div>
              <div className="text-sm text-gray-500">Best Streak</div>
            </div>
          )}
        </motion.div>

        {/* Mastery Progress Bar */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="wizard-card p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-700">Overall Mastery</span>
            <span className="font-bold text-purple-600">
              {Math.round(stats.final_mastery * 100)}%
            </span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.final_mastery * 100}%` }}
              transition={{ delay: 1, duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full"
            />
          </div>
          {stats.final_mastery >= 1.0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2 }}
              className="mt-3 text-center text-emerald-600 font-medium"
            >
              Congratulations! You've mastered this lesson!
            </motion.div>
          )}
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="space-y-3"
        >
          {onPracticeMore && (
            <Button
              onClick={onPracticeMore}
              className="w-full py-6 text-lg font-bold rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-lg"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Practice More
            </Button>
          )}

          <Button
            onClick={handleGoHome}
            variant="outline"
            className="w-full py-6 text-lg font-semibold rounded-2xl border-2 border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            <Home className="w-5 h-5 mr-2" />
            Return to Dashboard
          </Button>

          {/* Share Button (optional future feature) */}
          {isPerfect && (
            <Button
              variant="ghost"
              className="w-full py-4 text-purple-600 hover:bg-purple-50"
              onClick={() => {
                // Future: Implement share functionality
                console.log("Share achievement");
              }}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Achievement
            </Button>
          )}
        </motion.div>

        {/* Encouragement Message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-center text-gray-400 text-sm mt-8"
        >
          {isPerfect
            ? "You're on fire! Keep up the amazing work!"
            : isGreat
            ? "Great progress! Keep practicing to achieve mastery."
            : "Every practice session makes you stronger. Keep going!"}
        </motion.p>
      </div>
    </div>
  );
}

export default WizardCelebration;
