'use client';

import Link from 'next/link';

interface LevelCardProps {
  level: string;
  title: string;
  description: string;
  icon: string;
  colorClass: string;
  delay: number;
}

function LevelCard({ level, title, description, icon, colorClass, delay }: LevelCardProps) {
  return (
    <Link href="/signup" className="block group">
      <div
        className={`
          relative p-6 rounded-2xl bg-white border-2
          transition-all duration-300 ease-out
          hover:-translate-y-2 hover:shadow-lg
          animate-fade-in stagger-${delay}
          ${colorClass}
        `}
        style={{ animationFillMode: 'both' }}
      >
        {/* Icon with floating animation on hover */}
        <div className="text-4xl mb-4 transition-transform duration-300 group-hover:animate-float">
          {icon}
        </div>

        {/* Title with level badge */}
        <h3
          className="text-xl font-semibold mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h3>

        {/* Description */}
        <p
          className="text-sm opacity-80"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--wizard-text-secondary)' }}
        >
          {description}
        </p>

        {/* Hover arrow indicator */}
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-lg">→</span>
        </div>
      </div>
    </Link>
  );
}

const levels = [
  {
    level: 'n3',
    title: 'National 3',
    description: 'Build your foundation',
    icon: '🌱',
    colorClass: 'border-[var(--level-n3)] hover:bg-[var(--level-n3-bg)] text-[var(--level-n3-dark)]',
  },
  {
    level: 'n4',
    title: 'National 4',
    description: 'Develop your skills',
    icon: '📚',
    colorClass: 'border-[var(--level-n4)] hover:bg-[var(--level-n4-bg)] text-[var(--level-n4-dark)]',
  },
  {
    level: 'n5',
    title: 'National 5',
    description: 'Get exam ready',
    icon: '🎯',
    colorClass: 'border-[var(--level-n5)] hover:bg-[var(--level-n5-bg)] text-[var(--level-n5-dark)]',
  },
  {
    level: 'higher',
    title: 'Higher',
    description: 'Challenge yourself',
    icon: '🔥',
    colorClass: 'border-[var(--level-higher)] hover:bg-[var(--level-higher-bg)] text-[var(--level-higher-dark)]',
  },
  {
    level: 'adv-higher',
    title: 'Advanced Higher',
    description: 'Master your subject',
    icon: '🏆',
    colorClass: 'border-[var(--level-adv-higher)] hover:bg-[var(--level-adv-higher-bg)] text-[var(--level-adv-higher-dark)]',
  },
];

export function SQALevels() {
  return (
    <section
      className="py-20 px-4"
      style={{ background: 'var(--wizard-bg)' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--wizard-text)' }}
          >
            Choose Your Level
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--wizard-text-secondary)' }}
          >
            From National 3 to Advanced Higher, we&apos;ve got content tailored to your SQA course
          </p>
        </div>

        {/* Level Cards - Horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-4 overflow-x-auto pb-4 md:overflow-visible md:grid md:grid-cols-5 md:gap-6 snap-x snap-mandatory md:snap-none">
          {levels.map((level, index) => (
            <div
              key={level.level}
              className="flex-shrink-0 w-[240px] md:w-auto snap-center"
            >
              <LevelCard
                {...level}
                delay={index + 1}
              />
            </div>
          ))}
        </div>

        {/* Mobile scroll hint */}
        <div className="md:hidden text-center mt-4">
          <p
            className="text-sm"
            style={{ color: 'var(--wizard-text-light)' }}
          >
            Swipe to see all levels →
          </p>
        </div>
      </div>
    </section>
  );
}
