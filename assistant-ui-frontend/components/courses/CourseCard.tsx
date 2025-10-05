'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { BookOpen, CheckCircle, Clock, Target } from 'lucide-react';

interface CourseCardProps {
  course: {
    courseId: string;
    subject: string;
    level: string;
    description?: string;
    outcomes?: any[];
  };
  enrolled?: boolean;
  onClick?: () => void;
  onEnroll?: () => void;
}

export function CourseCard({ course, enrolled = false, onClick, onEnroll }: CourseCardProps) {
  const levelColors: Record<string, string> = {
    'national-3': 'bg-green-100 text-green-800',
    'national-4': 'bg-blue-100 text-blue-800',
    'national-5': 'bg-purple-100 text-purple-800',
    'higher': 'bg-orange-100 text-orange-800',
    'advanced-higher': 'bg-red-100 text-red-800',
  };

  const levelColor = levelColors[course.level?.toLowerCase()] || 'bg-gray-100 text-gray-800';

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
      <CardHeader onClick={onClick}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2 line-clamp-2">
              {course.subject}
            </CardTitle>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${levelColor}`}>
              {course.level}
            </span>
          </div>
          <BookOpen className="h-6 w-6 text-blue-600 flex-shrink-0" />
        </div>
      </CardHeader>

      <CardContent onClick={onClick} className="flex-1">
        <p className="text-sm text-gray-600 line-clamp-3 mb-4">
          {course.description || 'Scottish Curriculum Framework aligned course with personalized AI teaching.'}
        </p>

        {/* Course meta info */}
        <div className="space-y-2 text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span>{course.outcomes?.length || 'Multiple'} Learning Outcomes</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Self-paced learning</span>
          </div>
        </div>
      </CardContent>

      {/* Action button */}
      <div className="p-4 pt-0">
        {enrolled ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Enrolled - View Course
          </Button>
        ) : (
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={(e) => {
              e.stopPropagation();
              onEnroll ? onEnroll() : onClick?.();
            }}
          >
            View Details
          </Button>
        )}
      </div>
    </Card>
  );
}
