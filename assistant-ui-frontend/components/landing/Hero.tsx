'use client';

import Link from 'next/link';

interface StatProps {
  icon: string;
  value: string;
  label: string;
  delay: number;
}

function Stat({ icon, value, label, delay }: StatProps) {
  return (
    <div
      className={`flex items-center gap-3 animate-fade-in stagger-${delay}`}
      style={{ animationFillMode: 'both' }}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <div
          className="text-lg font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--wizard-text)' }}
        >
          {value}
        </div>
        <div
          className="text-sm"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--wizard-text-secondary)' }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative py-20 md:py-28 px-4 overflow-hidden">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: 'var(--bg-gradient-main)',
        }}
      />

      {/* Subtle animated shapes in background */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Floating circles */}
        <div
          className="absolute w-64 h-64 rounded-full opacity-20 animate-float"
          style={{
            background: 'var(--wizard-green-bg)',
            top: '10%',
            right: '10%',
            animationDuration: '6s',
          }}
        />
        <div
          className="absolute w-48 h-48 rounded-full opacity-20 animate-float"
          style={{
            background: 'var(--wizard-blue-bg)',
            bottom: '20%',
            left: '5%',
            animationDuration: '8s',
            animationDelay: '2s',
          }}
        />
        <div
          className="absolute w-32 h-32 rounded-full opacity-20 animate-float"
          style={{
            background: 'var(--wizard-gold-bg)',
            top: '40%',
            left: '20%',
            animationDuration: '7s',
            animationDelay: '4s',
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="text-center space-y-8">
          {/* Animated Scottish Badge */}
          <div className="animate-pop" style={{ animationFillMode: 'both' }}>
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
              style={{
                background: 'var(--wizard-blue-bg)',
                color: 'var(--wizard-blue-dark)',
                fontFamily: 'var(--font-body)',
                border: '2px solid var(--wizard-blue)',
              }}
            >
              <span className="text-base">🏴󠁧󠁢󠁳󠁣󠁴󠁿</span>
              Built for Scottish Students
            </span>
          </div>

          {/* Main Headline */}
          <div className="space-y-2 animate-fade-in stagger-1" style={{ animationFillMode: 'both' }}>
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--wizard-text)' }}
            >
              Ace Your SQA Exams
            </h1>
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-bold"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'linear-gradient(90deg, var(--wizard-green), var(--wizard-blue))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              With AI That Actually Gets It
            </h2>
          </div>

          {/* Subheadline */}
          <p
            className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed animate-fade-in stagger-2"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--wizard-text-secondary)',
              animationFillMode: 'both',
            }}
          >
            From National 3 to Advanced Higher. Practice questions, instant feedback, and explanations that make sense.
          </p>

          {/* CTA Buttons */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in stagger-3"
            style={{ animationFillMode: 'both' }}
          >
            {/* Primary CTA - 3D Button Style */}
            <Link href="/signup">
              <button
                className="
                  px-8 py-4 rounded-2xl text-white font-bold text-lg
                  transition-all duration-200
                  hover:-translate-y-1
                  active:translate-y-0.5
                "
                style={{
                  fontFamily: 'var(--font-display)',
                  background: 'linear-gradient(to bottom, var(--wizard-green-light), var(--wizard-green))',
                  boxShadow: '0 4px 0 var(--wizard-green-dark), 0 4px 12px rgba(88, 204, 2, 0.3)',
                }}
              >
                Get Started
              </button>
            </Link>

            {/* Secondary CTA */}
            <Link href="/login">
              <button
                className="
                  px-8 py-4 rounded-2xl font-bold text-lg
                  transition-all duration-200
                  hover:-translate-y-1
                  active:translate-y-0.5
                  border-2
                "
                style={{
                  fontFamily: 'var(--font-display)',
                  background: 'white',
                  color: 'var(--wizard-text)',
                  borderColor: 'var(--wizard-border)',
                  boxShadow: '0 2px 0 var(--wizard-border-dark)',
                }}
              >
                I Have an Account
              </button>
            </Link>
          </div>

          {/* Quick Stats */}
          <div
            className="flex flex-wrap justify-center gap-8 md:gap-12 pt-8 border-t mt-8"
            style={{ borderColor: 'var(--wizard-border-light)' }}
          >
            <Stat icon="🎯" value="10,000+" label="Practice Questions" delay={4} />
            <Stat icon="📈" value="92%" label="Pass Rate Improvement" delay={5} />
            <Stat icon="⚡" value="24/7" label="AI Tutor Available" delay={6} />
          </div>
        </div>
      </div>
    </section>
  );
}
