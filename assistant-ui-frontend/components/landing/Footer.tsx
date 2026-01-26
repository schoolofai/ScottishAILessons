'use client';

import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#' },
    { label: 'For Schools', href: '#' },
    { label: 'For Parents', href: '#' },
  ],
  subjects: [
    { label: 'Mathematics', href: '#' },
    { label: 'English', href: '#' },
    { label: 'Sciences', href: '#' },
    { label: 'All Subjects', href: '#' },
  ],
  company: [
    { label: 'About Us', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Cookie Policy', href: '#' },
  ],
};

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3
        className="font-semibold mb-4"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--wizard-text)' }}
      >
        {title}
      </h3>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm transition-colors duration-200 hover:text-[var(--wizard-green)]"
              style={{ fontFamily: 'var(--font-body)', color: 'var(--wizard-text-secondary)' }}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer style={{ background: 'var(--wizard-bg-secondary)' }}>
      {/* CTA Section */}
      <div
        className="py-16 px-4"
        style={{ background: 'linear-gradient(135deg, var(--wizard-green-bg) 0%, var(--wizard-blue-bg) 100%)' }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--wizard-text)' }}
          >
            Ready to ace your SQA exams?
          </h2>
          <p
            className="text-lg mb-8 max-w-xl mx-auto"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--wizard-text-secondary)' }}
          >
            Join thousands of Scottish students already improving their grades with AI-powered learning.
          </p>
          <Link href="/signup">
            <button
              className="px-8 py-4 rounded-2xl text-white font-bold text-lg transition-all duration-300 hover:-translate-y-1 active:translate-y-0.5"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'linear-gradient(to bottom, var(--wizard-green-light), var(--wizard-green))',
                boxShadow: '0 4px 0 var(--wizard-green-dark), 0 4px 12px rgba(88, 204, 2, 0.3)',
              }}
            >
              Get Started
            </button>
          </Link>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: 'var(--wizard-green-bg)' }}
                >
                  <GraduationCap
                    className="h-6 w-6"
                    style={{ color: 'var(--wizard-green)' }}
                  />
                </div>
                <span
                  className="text-lg font-bold"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--wizard-text)' }}
                >
                  Scottish AI
                </span>
              </Link>
              <p
                className="text-sm mb-4"
                style={{ fontFamily: 'var(--font-body)', color: 'var(--wizard-text-secondary)' }}
              >
                AI-powered learning designed for Scottish students preparing for SQA qualifications.
              </p>
              {/* Scottish flag emoji as a fun touch */}
              <span className="text-2xl">🏴󠁧󠁢󠁳󠁣󠁴󠁿</span>
            </div>

            {/* Link Columns */}
            <FooterColumn title="Product" links={footerLinks.product} />
            <FooterColumn title="Subjects" links={footerLinks.subjects} />
            <FooterColumn title="Company" links={footerLinks.company} />
            <FooterColumn title="Legal" links={footerLinks.legal} />
          </div>

          {/* Bottom Bar */}
          <div
            className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4"
            style={{ borderColor: 'var(--wizard-border)' }}
          >
            <p
              className="text-sm"
              style={{ fontFamily: 'var(--font-body)', color: 'var(--wizard-text-light)' }}
            >
              © {new Date().getFullYear()} Scottish AI Lessons. All rights reserved.
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              <span
                className="text-sm"
                style={{ color: 'var(--wizard-text-light)' }}
              >
                Follow us:
              </span>
              <div className="flex gap-3">
                {['𝕏', 'in', 'ig'].map((social) => (
                  <a
                    key={social}
                    href="#"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 hover:scale-110"
                    style={{
                      background: 'var(--wizard-bg-tertiary)',
                      color: 'var(--wizard-text-secondary)',
                    }}
                  >
                    {social}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
