'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { User, Accessibility } from 'lucide-react';

interface ProfileStepProps {
  onNext: (data: { name: string; accommodations: string[] }) => void;
  onBack: () => void;
  onSkip?: () => void;
}

export function ProfileStep({ onNext, onBack, onSkip }: ProfileStepProps) {
  const [name, setName] = useState('');
  const [accommodations, setAccommodations] = useState<string[]>([]);
  const [error, setError] = useState('');

  const availableAccommodations = [
    {
      id: 'text-to-speech',
      label: 'Text-to-speech',
      description: 'Have content read aloud to you'
    },
    {
      id: 'extra-time',
      label: 'Extra time for assessments',
      description: 'Additional time for practice questions'
    },
    {
      id: 'large-text',
      label: 'Larger text size',
      description: 'Increase font size for better readability'
    },
    {
      id: 'high-contrast',
      label: 'High contrast mode',
      description: 'Enhanced contrast for visual clarity'
    },
    {
      id: 'simplified-language',
      label: 'Simplified language',
      description: 'Use simpler vocabulary and shorter sentences'
    }
  ];

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    onNext({ name: name.trim(), accommodations });
  };

  const toggleAccommodation = (id: string) => {
    setAccommodations(prev =>
      prev.includes(id)
        ? prev.filter(a => a !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <User className="h-8 w-8 text-blue-600" />
        <div>
          <h2 className="text-xl font-semibold">Your Profile</h2>
          <p className="text-sm text-gray-600">
            Help us personalize your learning experience
          </p>
        </div>
      </div>

      {/* Name input */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Your Name <span className="text-red-500">*</span>
        </label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={e => {
            setName(e.target.value);
            setError('');
          }}
          placeholder="Enter your full name"
          className="w-full"
          autoFocus
        />
        {error && (
          <p className="text-red-600 text-sm mt-1">{error}</p>
        )}
      </div>

      {/* Accommodations section */}
      <div className="border-t pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Accessibility className="h-6 w-6 text-purple-600" />
          <div>
            <h3 className="font-medium">
              Accessibility Accommodations
            </h3>
            <p className="text-sm text-gray-600">
              Optional - Select any that apply to you
            </p>
          </div>
        </div>

        <div className="space-y-4 bg-gray-50 rounded-lg p-4">
          {availableAccommodations.map(acc => (
            <div
              key={acc.id}
              className="flex items-start gap-3 p-3 bg-white rounded border hover:border-blue-300 transition-colors"
            >
              <Checkbox
                id={acc.id}
                checked={accommodations.includes(acc.id)}
                onCheckedChange={() => toggleAccommodation(acc.id)}
                className="mt-0.5"
              />
              <label
                htmlFor={acc.id}
                className="flex-1 cursor-pointer"
              >
                <div className="font-medium text-sm">{acc.label}</div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {acc.description}
                </div>
              </label>
            </div>
          ))}
        </div>

        {accommodations.length > 0 && (
          <p className="text-sm text-green-600 mt-3">
            ✓ {accommodations.length} accommodation{accommodations.length !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <p className="text-gray-700">
          <strong>Privacy:</strong> Your accommodations are private and will only be used to
          customize your learning experience. You can update these anytime in settings.
        </p>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>

        <div className="space-x-2">
          {onSkip && (
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          )}
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
