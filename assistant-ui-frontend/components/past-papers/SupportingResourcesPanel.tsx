'use client';

import React, { useState } from 'react';
import {
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Image,
  File,
  Loader2,
  FolderOpen,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export interface SupportingResource {
  file_id: string;
  filename: string;
  resource_type: 'data' | 'spreadsheet' | 'pdf' | 'image' | 'other';
  description?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getResourceIcon(type: SupportingResource['resource_type']) {
  switch (type) {
    case 'data':
    case 'spreadsheet':
      return FileSpreadsheet;
    case 'pdf':
      return FileText;
    case 'image':
      return Image;
    default:
      return File;
  }
}

function getTypeBadgeClasses(type: SupportingResource['resource_type']): string {
  switch (type) {
    case 'data':
    case 'spreadsheet':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'pdf':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'image':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function formatResourceType(type: SupportingResource['resource_type']): string {
  switch (type) {
    case 'data':
      return 'Data';
    case 'spreadsheet':
      return 'Spreadsheet';
    case 'pdf':
      return 'PDF';
    case 'image':
      return 'Image';
    default:
      return 'File';
  }
}

// =============================================================================
// ResourceItem Component
// =============================================================================

interface ResourceItemProps {
  resource: SupportingResource;
}

function ResourceItem({ resource }: ResourceItemProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const Icon = getResourceIcon(resource.resource_type);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const url = `/api/past-papers/resources/${encodeURIComponent(resource.file_id)}?filename=${encodeURIComponent(resource.filename)}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to download resource');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = resource.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      logger.info('Resource downloaded successfully', {
        fileId: resource.file_id,
        filename: resource.filename,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed';
      logger.error('Failed to download resource', { error: message, fileId: resource.file_id });
      alert(`Download failed: ${message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-3 p-3 rounded-lg',
        'bg-white border border-teal-100',
        'hover:border-teal-300 hover:shadow-sm',
        'transition-all duration-200'
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
        <Icon className="h-5 w-5 text-teal-600" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 break-words">
          {resource.filename}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge
            variant="outline"
            className={cn('text-xs px-1.5 py-0', getTypeBadgeClasses(resource.resource_type))}
          >
            {formatResourceType(resource.resource_type)}
          </Badge>
          {resource.description && (
            <span className="text-xs text-gray-500 break-words">
              {resource.description}
            </span>
          )}
        </div>
      </div>

      {/* Download Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={isDownloading}
        className={cn(
          'flex-shrink-0 h-11 w-11 p-0',
          'text-teal-600 hover:text-teal-700 hover:bg-teal-100',
          'transition-colors'
        )}
        aria-label={`Download ${resource.filename}`}
      >
        {isDownloading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Download className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}

// =============================================================================
// SupportingResourcesDrawer Component (Desktop)
// =============================================================================

interface SupportingResourcesDrawerProps {
  /** Array of supporting resources for the paper */
  resources: SupportingResource[];
  /** Whether the drawer is open (controlled) */
  isOpen: boolean;
  /** Callback when drawer should close */
  onClose: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SupportingResourcesDrawer - Side drawer for supporting resources.
 *
 * Controlled component - open state managed by parent.
 * Uses sticky positioning to stay fixed while main content scrolls.
 * The panel itself can scroll internally when focused.
 */
export function SupportingResourcesDrawer({
  resources,
  isOpen,
  onClose,
  className,
}: SupportingResourcesDrawerProps) {
  if (!resources || resources.length === 0) {
    return null;
  }

  return (
    <aside
      className={cn(
        'flex-shrink-0 transition-all duration-300 ease-in-out',
        isOpen ? 'w-80' : 'w-0',
        'overflow-hidden self-start', // self-start needed for sticky to work in flex
        'sticky top-0', // Stays fixed at top while main content scrolls
        className
      )}
    >
      {/* Panel content */}
      <div
        className={cn(
          'w-80',
          'h-[calc(100vh-4rem)]', // Full viewport height minus header
          'bg-teal-50 border-l-2 border-teal-200',
          'flex flex-col'
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 bg-teal-50 border-b border-teal-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-teal-700" />
              </div>
              <div>
                <h3 className="font-semibold text-teal-800">Supporting Material</h3>
                <p className="text-sm text-teal-600">
                  {resources.length} {resources.length === 1 ? 'file' : 'files'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-teal-600 hover:text-teal-700 hover:bg-teal-100"
              aria-label="Close supporting material"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Resource List - scrolls independently when content overflows */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {resources.map((resource) => (
            <ResourceItem key={resource.file_id} resource={resource} />
          ))}
        </div>
      </div>
    </aside>
  );
}

// =============================================================================
// SupportingResourcesPanel Component (Mobile - Collapsible)
// =============================================================================

interface SupportingResourcesPanelProps {
  resources: SupportingResource[];
  defaultOpen?: boolean;
  className?: string;
}

/**
 * SupportingResourcesPanel - Mobile-friendly collapsible panel.
 * Used below content on mobile viewports.
 */
export function SupportingResourcesPanel({
  resources,
  defaultOpen = false,
  className,
}: SupportingResourcesPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!resources || resources.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-teal-200 bg-teal-50/50',
        'transition-all duration-200',
        className
      )}
    >
      {/* Header / Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between p-4',
          'text-left',
          isOpen ? 'rounded-t-xl' : 'rounded-xl',
          'hover:bg-teal-100/50 transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2'
        )}
        aria-label={isOpen ? 'Collapse supporting resources' : 'Expand supporting resources'}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
            <FolderOpen className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <h3 className="font-semibold text-teal-800">Supporting Resources</h3>
            <p className="text-sm text-teal-600">
              {resources.length} {resources.length === 1 ? 'file' : 'files'} available
            </p>
          </div>
        </div>
        <ChevronRight
          className={cn(
            'h-5 w-5 text-teal-600',
            'transition-transform duration-300',
            isOpen && 'rotate-90'
          )}
        />
      </button>

      {/* Content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 pb-4 space-y-2">
          {resources.map((resource) => (
            <ResourceItem key={resource.file_id} resource={resource} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default SupportingResourcesPanel;
