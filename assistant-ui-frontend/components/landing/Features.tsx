'use client';

import { BookOpen, MessageSquare, TrendingUp, Users, Shield, Clock } from 'lucide-react';

const features = [
  {
    icon: MessageSquare,
    title: 'Interactive Chat',
    description: 'Engage in natural conversations with our AI assistant for seamless learning.',
  },
  {
    icon: BookOpen,
    title: 'Comprehensive Knowledge',
    description: 'Access a vast knowledge base covering diverse subjects and topics.',
  },
  {
    icon: TrendingUp,
    title: 'Track Progress',
    description: 'Monitor your learning journey with personalized insights and metrics.',
  },
  {
    icon: Users,
    title: 'Student & Teacher Modes',
    description: 'Tailored experiences for different learning and teaching needs.',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Your data is protected with enterprise-grade security measures.',
  },
  {
    icon: Clock,
    title: 'Learn Anytime',
    description: 'Available 24/7 to support your learning whenever you need it.',
  },
];

export function Features() {
  return (
    <section className="py-20 px-4 bg-gray-50">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Why Choose Our Platform?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Designed to make learning engaging, effective, and accessible for everyone.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}