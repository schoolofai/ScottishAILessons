'use client';

import Link from 'next/link';

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  accentColor: string;
  delay: number;
}

function FeatureCard({
  icon,
  title,
  description,
  badge,
  badgeColor = 'var(--wizard-green)',
  accentColor,
  delay,
}: FeatureCardProps) {
  return (
    <Link href="/signup" className="block group">
      <div
        className={`
          relative p-8 rounded-3xl bg-white
          border-2 border-[var(--wizard-border)]
          transition-all duration-300 ease-out
          hover:-translate-y-3 hover:shadow-xl
          animate-fade-in stagger-${delay}
          overflow-hidden
        `}
        style={{ animationFillMode: 'both' }}
      >
        {/* Accent gradient overlay on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"
          style={{ background: `linear-gradient(135deg, ${accentColor}, transparent)` }}
        />

        {/* Badge */}
        {badge && (
          <div
            className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold text-white animate-pop"
            style={{
              background: badgeColor,
              fontFamily: 'var(--font-body)',
              animationDelay: `${delay * 0.05 + 0.3}s`,
              animationFillMode: 'both',
            }}
          >
            {badge}
          </div>
        )}

        {/* Icon */}
        <div
          className="text-5xl mb-6 transition-transform duration-500 group-hover:scale-110"
        >
          {icon}
        </div>

        {/* Title */}
        <h3
          className="text-2xl font-bold mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--wizard-text)' }}
        >
          {title}
        </h3>

        {/* Description */}
        <p
          className="text-base leading-relaxed"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--wizard-text-secondary)' }}
        >
          {description}
        </p>

        {/* CTA hint */}
        <div
          className="mt-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-2"
          style={{ color: accentColor }}
        >
          <span
            className="text-sm font-semibold"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Learn more
          </span>
          <span className="text-lg">→</span>
        </div>
      </div>
    </Link>
  );
}

const features = [
  {
    icon: '📜',
    title: 'Past Papers',
    description: 'Work through real SQA exam questions with step-by-step solutions. See exactly how marks are awarded.',
    badge: 'Coming Soon',
    badgeColor: 'var(--wizard-gold)',
    accentColor: 'var(--wizard-gold)',
  },
  {
    icon: '📝',
    title: 'Mock Exams',
    description: 'Timed practice exams that feel like the real thing. Get instant AI marking and feedback on where to improve.',
    badge: 'New',
    badgeColor: 'var(--level-n5)',
    accentColor: 'var(--level-n5)',
  },
  {
    icon: '♾️',
    title: 'Infinite Practice',
    description: "Never run out of questions. Our AI generates unlimited practice problems matched to your level and weak spots.",
    badge: 'Popular',
    badgeColor: 'var(--wizard-green)',
    accentColor: 'var(--wizard-green)',
  },
];

export function NewFeatures() {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--wizard-text)' }}
          >
            Power Up Your Revision
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--wizard-text-secondary)' }}
          >
            Tools designed specifically for Scottish students preparing for SQA exams
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              {...feature}
              delay={index + 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
