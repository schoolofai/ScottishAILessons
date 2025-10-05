'use client';

import { useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Award, Download, X } from 'lucide-react';
import { getMasteryLabel } from '@/lib/services/progress-service';

interface CompletionModalProps {
  courseName: string;
  averageMastery: number;
  onClose: () => void;
}

export function CompletionModal({ courseName, averageMastery, onClose }: CompletionModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap and ESC key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    // Focus the modal when it opens
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);
  const handleDownloadCertificate = async () => {
    // Generate certificate PDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Certificate design
    doc.setFontSize(32);
    doc.setTextColor(59, 130, 246); // blue-600
    doc.text('Certificate of Completion', 148, 50, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('This is to certify that', 148, 80, { align: 'center' });

    doc.setFontSize(24);
    doc.setTextColor(59, 130, 246);
    doc.text('Student', 148, 100, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('has successfully completed', 148, 120, { align: 'center' });

    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text(courseName, 148, 140, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont(undefined, 'normal');
    doc.text(`Average Mastery: ${averageMastery.toFixed(2)} (${getMasteryLabel(averageMastery)})`, 148, 160, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 148, 180, { align: 'center' });

    doc.save(`certificate-${courseName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-modal-title"
      aria-describedby="completion-modal-description"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 relative"
        tabIndex={-1}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close completion modal"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>

        {/* Celebration content */}
        <div className="text-center">
          {/* Trophy emoji */}
          <div className="text-6xl mb-4" aria-hidden="true">🎉</div>

          <h2 id="completion-modal-title" className="text-2xl font-bold mb-2">
            Course Completed!
          </h2>

          <p id="completion-modal-description" className="text-gray-600 mb-6">
            Congratulations on completing <strong>{courseName}</strong>!
          </p>

          {/* Stats */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Award className="h-5 w-5 text-blue-600" aria-hidden="true" />
              <span className="font-semibold">Final Mastery</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              {averageMastery.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {getMasteryLabel(averageMastery)}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleDownloadCertificate}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Download Certificate
            </Button>

            <Button
              variant="outline"
              onClick={onClose}
              className="w-full"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
