'use client';

interface FeatureProps {
  icon: string;
  title: string;
  description: string;
  delay: number;
}

function FeatureCard({ icon, title, description, delay }: FeatureProps) {
  return (
    <div
      className={`
        p-6 rounded-2xl bg-white
        border-2 border-[var(--wizard-border)]
        transition-all duration-300 ease-out
        hover:-translate-y-2 hover:shadow-lg hover:border-[var(--wizard-green)]
        animate-fade-in stagger-${delay}
      `}
      style={{ animationFillMode: 'both' }}
    >
      {/* Icon */}
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 text-2xl"
        style={{ background: 'var(--wizard-green-bg)' }}
      >
        {icon}
      </div>

      {/* Title */}
      <h3
        className="text-lg font-semibold mb-2"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--wizard-text)' }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className="text-sm leading-relaxed"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--wizard-text-secondary)' }}
      >
        {description}
      </p>
    </div>
  );
}

const features = [
  {
    icon: '💬',
    title: 'AI Chat Tutor',
    description: 'Ask any question, get instant explanations in plain English. No jargon, just answers.',
  },
  {
    icon: '🎮',
    title: 'Gamified Learning',
    description: 'Earn XP, level up, and track your streak. Learning should feel like winning.',
  },
  {
    icon: '📊',
    title: 'Progress Dashboard',
    description: 'See your strengths, weaknesses, and improvement over time. Know exactly where to focus.',
  },
  {
    icon: '🎯',
    title: 'SQA-Aligned',
    description: 'Content mapped to the Scottish curriculum. Every question matches what you\'ll see in exams.',
  },
  {
    icon: '🔒',
    title: 'Safe & Private',
    description: 'Your data stays yours. No selling to third parties. Built with student safety in mind.',
  },
  {
    icon: '📱',
    title: 'Works Everywhere',
    description: 'Phone, tablet, laptop - study wherever you are. Your progress syncs automatically.',
  },
];

export function Features() {
  return (
    <section
      className="py-20 px-4"
      style={{ background: 'var(--wizard-bg-secondary)' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--wizard-text)' }}
          >
            Why Students Love Us
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--wizard-text-secondary)' }}
          >
            Everything you need to succeed in your SQA exams, all in one place
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
