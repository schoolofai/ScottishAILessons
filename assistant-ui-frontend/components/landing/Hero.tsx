'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Bot, Brain, Sparkles } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative py-20 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 -z-10" />
      
      <div className="container mx-auto max-w-6xl">
        <div className="text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-sm font-medium text-blue-700">
            <Sparkles className="h-4 w-4" />
            AI-Powered Learning Platform
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Enhance Your Learning Journey
            <br />
            with Intelligent Chat
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Experience personalized education with our advanced AI assistant. 
            Get instant answers, detailed explanations, and guided learning tailored to your needs.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="group">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Login to Your Account
              </Button>
            </Link>
          </div>
          
          <div className="flex items-center justify-center gap-8 pt-8">
            <div className="flex items-center gap-2 text-gray-600">
              <Bot className="h-5 w-5" />
              <span className="text-sm">24/7 Available</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Brain className="h-5 w-5" />
              <span className="text-sm">Adaptive Learning</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm">Personalized Experience</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}