/**
 * Quill Editor Configuration for KaTeX Integration
 *
 * This configuration enables LaTeX formula rendering in Quill using KaTeX.
 * KaTeX is already installed in the project (v0.16.22) and CSS is imported in app/layout.tsx.
 *
 * Usage: Import this file before using ReactQuill to ensure KaTeX is available.
 */

import katex from 'katex';

// Make KaTeX available globally for Quill's formula module
if (typeof window !== 'undefined') {
  (window as any).katex = katex;
}

/**
 * Quill Formula Blot Configuration
 *
 * The 'formula' toolbar button in Quill allows users to insert LaTeX equations.
 * When clicked, it prompts for LaTeX input and renders it using KaTeX.
 *
 * Example LaTeX inputs:
 * - E = mc^2
 * - \frac{1}{2}
 * - \int_{a}^{b} f(x) dx
 * - x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
 */

export default katex;
