'use client';

import { Input } from '../ui/input';
import { Search, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CourseFilters {
  level: string;
  subject: string;
  search: string;
}

interface CourseFilterBarProps {
  filters: CourseFilters;
  onChange: (filters: CourseFilters) => void;
}

export function CourseFilterBar({ filters, onChange }: CourseFilterBarProps) {
  const updateFilter = (key: keyof CourseFilters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-5 w-5 text-gray-600" />
        <h3 className="font-semibold">Filter Courses</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search courses..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Level filter */}
        <Select
          value={filters.level}
          onValueChange={(value) => updateFilter('level', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="national-3">National 3</SelectItem>
            <SelectItem value="national-4">National 4</SelectItem>
            <SelectItem value="national-5">National 5</SelectItem>
            <SelectItem value="higher">Higher</SelectItem>
            <SelectItem value="advanced-higher">Advanced Higher</SelectItem>
          </SelectContent>
        </Select>

        {/* Subject filter */}
        <Select
          value={filters.subject}
          onValueChange={(value) => updateFilter('subject', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            <SelectItem value="mathematics">Mathematics</SelectItem>
            <SelectItem value="english">English</SelectItem>
            <SelectItem value="science">Science</SelectItem>
            <SelectItem value="physics">Physics</SelectItem>
            <SelectItem value="chemistry">Chemistry</SelectItem>
            <SelectItem value="biology">Biology</SelectItem>
            <SelectItem value="computing">Computing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active filters display */}
      {(filters.level !== 'all' || filters.subject !== 'all' || filters.search) && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Active filters:</span>
          {filters.level !== 'all' && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
              Level: {filters.level}
            </span>
          )}
          {filters.subject !== 'all' && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
              Subject: {filters.subject}
            </span>
          )}
          {filters.search && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
              Search: {filters.search}
            </span>
          )}
          <button
            onClick={() => onChange({ level: 'all', subject: 'all', search: '' })}
            className="text-blue-600 hover:underline ml-2"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
