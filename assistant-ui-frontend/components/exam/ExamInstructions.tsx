"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Calculator,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  PlayCircle,
} from "lucide-react";
import type { MockExam, CalculatorPolicy } from "@/lib/exam/types";

interface ExamInstructionsProps {
  exam: MockExam;
  onStart: () => void;
  onExit: () => void;
}

const calculatorLabels: Record<CalculatorPolicy, { label: string; allowed: boolean }> = {
  non_calc: { label: 'No Calculator', allowed: false },
  calc: { label: 'Calculator Required', allowed: true },
  mixed: { label: 'Mixed (check sections)', allowed: true },
  exam_conditions: { label: 'Exam Conditions', allowed: false },
};

/**
 * ExamInstructions - Pre-exam instructions screen
 *
 * Displays exam metadata, rules, and start button.
 * The student must acknowledge instructions before starting.
 */
export function ExamInstructions({
  exam,
  onStart,
  onExit,
}: ExamInstructionsProps) {
  const { metadata, sections } = exam;
  const totalQuestions = sections.reduce(
    (sum, section) => sum + section.questions.length,
    0
  );

  const calculatorInfo = calculatorLabels[metadata.calculator_policy];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {metadata.title}
        </h1>
        <div className="flex items-center justify-center gap-4 text-gray-600">
          <Badge variant="secondary" className="text-sm">
            {metadata.subject}
          </Badge>
          <Badge variant="outline" className="text-sm">
            {metadata.level}
          </Badge>
        </div>
      </div>

      {/* Exam Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Exam Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Clock className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold text-gray-900">{metadata.timeLimit}</p>
            <p className="text-sm text-gray-500">Minutes</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 mt-2">{totalQuestions}</p>
            <p className="text-sm text-gray-500">Questions</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 mt-2">{metadata.totalMarks}</p>
            <p className="text-sm text-gray-500">Total Marks</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Calculator className={`h-6 w-6 mx-auto mb-2 ${calculatorInfo.allowed ? 'text-green-600' : 'text-red-600'}`} />
            <p className="text-sm font-medium text-gray-700">{calculatorInfo.label}</p>
          </div>
        </CardContent>
      </Card>

      {/* Sections Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sections.map((section, index) => (
              <div
                key={section.section_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{section.section_label}</p>
                  {section.section_instructions && (
                    <p className="text-sm text-gray-500">{section.section_instructions}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{section.questions.length} questions</p>
                  <p className="text-sm text-gray-500">{section.section_marks} marks</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Important Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">1.</span>
              <span>
                You have <strong>{metadata.timeLimit} minutes</strong> to complete this exam.
                The timer will start when you click "Start Exam".
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">2.</span>
              <span>
                You can navigate between questions using the sidebar or navigation buttons.
                You may revisit and change your answers at any time before submitting.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">3.</span>
              <span>
                Use the <strong>flag</strong> button to mark questions you want to review later.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">4.</span>
              <span>
                When the timer runs out, your exam will be <strong>automatically submitted</strong>.
                Make sure to submit before time expires if you're ready.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">5.</span>
              <span>
                After submission, you will receive detailed feedback on each question
                and personalized learning recommendations.
              </span>
            </li>
            {metadata.instructions && (
              <li className="flex items-start gap-2 mt-4 p-3 bg-blue-50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-blue-800">{metadata.instructions}</span>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={onExit}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <Button
          onClick={onStart}
          size="lg"
          className="gap-2 bg-green-600 hover:bg-green-700"
        >
          <PlayCircle className="h-5 w-5" />
          Start Exam
        </Button>
      </div>
    </div>
  );
}
