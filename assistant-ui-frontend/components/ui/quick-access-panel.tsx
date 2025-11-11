"use client";

import React, { useState } from "react";
import { Button } from "./button";
import { ChevronLeft, ChevronRight, Grid3x3, Zap, Atom, Dna } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAccessItem {
  id: string;
  name: string;
  icon: string;
  category: 'math' | 'circuits' | 'chemistry' | 'biology';
  description: string;
  libraryItemId?: string; // Reference to library item ID
}

interface QuickAccessPanelProps {
  onInsertItem: (itemId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Popular library items organized by subject for quick access
 */
const QUICK_ACCESS_ITEMS: QuickAccessItem[] = [
  // Mathematics - Search terms that match library items
  {
    id: 'coordinate-graph',
    name: 'Coordinate Graph',
    icon: '📐',
    category: 'math',
    description: 'X/Y axis system',
  },
  {
    id: 'venn',
    name: 'Venn Diagram',
    icon: '⭕',
    category: 'math',
    description: 'Two-circle Venn',
  },
  {
    id: 'number line',
    name: 'Number Line',
    icon: '↔️',
    category: 'math',
    description: 'Horizontal scale',
  },
  {
    id: 'graph',
    name: 'Graph Paper',
    icon: '🟦',
    category: 'math',
    description: 'Grid template',
  },

  // Circuits/Physics - Common component names
  {
    id: 'resistor',
    name: 'Resistor',
    icon: '⚡',
    category: 'circuits',
    description: 'Basic resistor',
  },
  {
    id: 'battery',
    name: 'Battery',
    icon: '🔋',
    category: 'circuits',
    description: 'Power source',
  },
  {
    id: 'led',
    name: 'LED',
    icon: '💡',
    category: 'circuits',
    description: 'Light emitter',
  },
  {
    id: 'switch',
    name: 'Switch',
    icon: '🔘',
    category: 'circuits',
    description: 'Circuit switch',
  },
  {
    id: 'and gate',
    name: 'AND Gate',
    icon: '🚪',
    category: 'circuits',
    description: 'Logic gate',
  },

  // Chemistry - From periodic table and lab equipment
  {
    id: 'hydrogen',
    name: 'Hydrogen (H)',
    icon: '⚛️',
    category: 'chemistry',
    description: 'Element H',
  },
  {
    id: 'oxygen',
    name: 'Oxygen (O)',
    icon: '⚛️',
    category: 'chemistry',
    description: 'Element O',
  },
  {
    id: 'carbon',
    name: 'Carbon (C)',
    icon: '⚛️',
    category: 'chemistry',
    description: 'Element C',
  },

  // Biology - From biology library
  {
    id: 'cell',
    name: 'Cell',
    icon: '🦠',
    category: 'biology',
    description: 'Basic cell',
  },
  {
    id: 'bacteria',
    name: 'Bacteria',
    icon: '🦠',
    category: 'biology',
    description: 'Bacteria diagram',
  },
  {
    id: 'heart',
    name: 'Heart',
    icon: '❤️',
    category: 'biology',
    description: 'Heart anatomy',
  },
];

const CATEGORY_CONFIG = {
  math: {
    label: 'Math',
    icon: Grid3x3,
    color: 'blue',
  },
  circuits: {
    label: 'Circuits',
    icon: Zap,
    color: 'yellow',
  },
  chemistry: {
    label: 'Chemistry',
    icon: Atom,
    color: 'purple',
  },
  biology: {
    label: 'Biology',
    icon: Dna,
    color: 'green',
  },
};

/**
 * Floating Quick Access Panel Component
 *
 * Provides one-click access to popular library items organized by subject.
 * Panel is collapsible and positioned on the right side of the canvas.
 */
export function QuickAccessPanel({ onInsertItem, isOpen, onToggle }: QuickAccessPanelProps) {
  const [activeCategory, setActiveCategory] = useState<'math' | 'circuits' | 'chemistry' | 'biology'>('math');

  const categoryItems = QUICK_ACCESS_ITEMS.filter(item => item.category === activeCategory);
  const categoryConfig = CATEGORY_CONFIG[activeCategory];
  const CategoryIcon = categoryConfig.icon;

  return (
    <div className={cn(
      "absolute right-0 top-0 bottom-0 z-10 flex items-stretch transition-transform duration-300 ease-in-out pointer-events-none",
      isOpen ? "translate-x-0" : "translate-x-[calc(100%-40px)]" // Keep toggle button visible
    )}>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="flex-shrink-0 w-10 bg-white border border-r-0 border-gray-300 hover:bg-gray-50 transition-colors shadow-lg flex items-center justify-center pointer-events-auto"
        aria-label={isOpen ? "Close quick access" : "Open quick access"}
        style={{
          borderTopLeftRadius: '0.5rem',
          borderBottomLeftRadius: '0.5rem',
        }}
      >
        {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Panel Content */}
      <div className="h-full w-64 bg-white border-l border-gray-300 shadow-xl flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <CategoryIcon className="w-4 h-4" />
            Quick Access
          </h3>
          <p className="text-xs text-gray-600 mt-0.5">Click to insert</p>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map((category) => {
            const config = CATEGORY_CONFIG[category];
            const Icon = config.icon;
            const isActive = activeCategory === category;

            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "flex-1 py-2 px-1 text-xs font-medium transition-colors relative",
                  isActive
                    ? "text-blue-600 bg-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
                aria-label={config.label}
                title={config.label}
              >
                <Icon className="w-4 h-4 mx-auto" />
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {categoryItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onInsertItem(item.id)}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group"
            >
              <div className="flex items-start gap-2">
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {item.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer Tip */}
        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-600">
            💡 <strong>Tip:</strong> Access all items via Library button
          </p>
        </div>
      </div>
    </div>
  );
}
