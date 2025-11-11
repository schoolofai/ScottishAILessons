# Scottish AI Lessons - SEO Strategy
## Rank First on Google & Optimize for LLM Search (ChatGPT, Claude)

**Objective**: Ship a fast, on-brand site that ranks for high-intent Scottish education keywords and drives student sign-ups.

**Outcome**: Organic traffic from students searching for "national 5 maths tutor", "ai tutor scotland", "sqa exam practice" leading to free trials and conversions.

---

## Table of Contents
1. [Overall Strategy Framework](#overall-strategy-framework)
2. [Technical SEO Foundation](#technical-seo-foundation)
3. [On-Page SEO Optimization](#on-page-seo-optimization)
4. [Content Strategy & Production](#content-strategy--production)
5. [Local SEO for Scottish Context](#local-seo-for-scottish-context)
6. [Link Building & Authority](#link-building--authority)
7. [Performance Optimization](#performance-optimization)
8. [Google Search Console Setup](#google-search-console-setup)
9. [LLM Optimization (ChatGPT, Claude, Perplexity)](#llm-optimization-chatgpt-claude-perplexity)
10. [Analytics & Iteration](#analytics--iteration)
11. [Timeline & Milestones](#timeline--milestones)

---

## Overall Strategy Framework

### Core SEO Approach
Following the proven framework for local/niche SEO success, adapted for educational SaaS:

**🎯 Target**: Scottish students (14-18) searching for SQA exam help, AI tutoring, and subject-specific revision.

**🔑 Keywords**: 50 keywords across 5 buckets → 19,500-38,500 monthly searches (see KEYWORD_RESEARCH.md)

**📄 Content Types**:
- **Course Landing Pages** - National 3/4/5 + subjects (high-intent qualification keywords)
- **Feature Pages** - AI capabilities, adaptive learning, accessibility (differentiator keywords)
- **Blog Posts** - Problem/solution content (pain point + long-tail keywords)
- **Authority Pages** - SQA curriculum guides, assessment standards (expertise content)
- **Comparison Pages** - AI vs. human tutors, platform comparisons (commercial investigation)

**⚡ Tech Stack**:
- Next.js 15 (App Router) - Already implemented ✅
- Vercel (hosting) - Fast global CDN
- TypeScript + React 19 - SEO-friendly rendering
- Tailwind CSS 4 - Optimized styling

---

## Technical SEO Foundation

### 1. Site Structure & URL Architecture

#### Current Tech Stack Analysis
- **Framework**: Next.js 15 with App Router ✅
- **Hosting**: TBD (recommend Vercel for performance)
- **Domain**: scottishailessons.com

#### Recommended URL Structure
```
scottishailessons.com/
├── /                                    # Homepage
├── /national-5-mathematics              # Course landing pages
├── /national-4-mathematics
├── /national-5-physics
├── /national-5-applications
├── /features/
│   ├── /ai-maths-tutor                 # Feature pages
│   ├── /adaptive-learning
│   ├── /interactive-diagrams
│   ├── /mastery-tracking
│   └── /accessibility
├── /sqa/
│   ├── /curriculum                     # Authority content
│   ├── /assessment-standards
│   ├── /course-codes
│   └── /qualifications
├── /blog/
│   ├── /struggling-national-5-maths    # Problem/solution
│   ├── /affordable-tutoring-scotland
│   ├── /ai-vs-human-tutor
│   └── /spaced-repetition-learning
├── /compare/
│   ├── /vs-bbc-bitesize               # Comparison pages
│   ├── /vs-seneca-learning
│   └── /vs-private-tutors
├── /about                              # Trust signals
├── /contact
└── /pricing
```

**URL Best Practices**:
- Use hyphens (not underscores)
- Keep URLs under 60 characters
- Include primary keyword in URL
- Avoid dynamic parameters where possible
- Use lowercase only

### 2. Meta Tags & Structured Data

#### Homepage Meta Tags
```html
<!-- Primary Meta Tags -->
<title>Scottish AI Lessons | SQA-Aligned AI Tutor for National 3/4/5</title>
<meta name="title" content="Scottish AI Lessons | SQA-Aligned AI Tutor for National 3/4/5">
<meta name="description" content="AI-powered tutoring for Scottish students. Get personalized help with National 5 Maths, Physics, and Applications. 24/7 adaptive learning aligned with SQA curriculum. Start free trial today.">
<meta name="keywords" content="ai tutor scotland, national 5 maths tutor, sqa exam practice, scottish ai lessons, adaptive learning">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://scottishailessons.com/">
<meta property="og:title" content="Scottish AI Lessons | SQA-Aligned AI Tutor">
<meta property="og:description" content="AI-powered tutoring for National 3/4/5. Personalized, accessible, and aligned with SQA curriculum.">
<meta property="og:image" content="https://scottishailessons.com/og-image.jpg">

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image">
<meta property="twitter:url" content="https://scottishailessons.com/">
<meta property="twitter:title" content="Scottish AI Lessons | SQA-Aligned AI Tutor">
<meta property="twitter:description" content="AI-powered tutoring for National 3/4/5. Personalized, accessible, and aligned with SQA curriculum.">
<meta property="twitter:image" content="https://scottishailessons.com/twitter-image.jpg">

<!-- Canonical URL -->
<link rel="canonical" href="https://scottishailessons.com/">
```

#### Course Landing Page Template (Example: National 5 Maths)
```html
<title>National 5 Maths Tutor | AI-Powered SQA Revision | Scottish AI Lessons</title>
<meta name="description" content="Master National 5 Maths with AI tutoring. Instant feedback, interactive diagrams, and personalized practice aligned with SQA assessment standards. Try free.">
<link rel="canonical" href="https://scottishailessons.com/national-5-mathematics">
```

#### Structured Data (Schema.org JSON-LD)

**Organization Schema** (Homepage):
```json
{
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "Scottish AI Lessons",
  "url": "https://scottishailessons.com",
  "logo": "https://scottishailessons.com/logo.png",
  "description": "AI-powered adaptive learning platform for Scottish students preparing for SQA National 3, 4, and 5 qualifications.",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "GB",
    "addressRegion": "Scotland"
  },
  "sameAs": [
    "https://twitter.com/scottishailessons",
    "https://linkedin.com/company/scottishailessons"
  ]
}
```

**Course Schema** (Course Landing Pages):
```json
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "National 5 Mathematics",
  "description": "AI-powered tutoring for SQA National 5 Mathematics covering all assessment standards with adaptive learning.",
  "provider": {
    "@type": "Organization",
    "name": "Scottish AI Lessons",
    "sameAs": "https://scottishailessons.com"
  },
  "educationalLevel": "National 5",
  "courseCode": "C844 74",
  "hasCourseInstance": {
    "@type": "CourseInstance",
    "courseMode": "online",
    "courseWorkload": "PT50H"
  },
  "teaches": [
    "Expressions and formulae",
    "Relationships",
    "Applications"
  ]
}
```

**FAQPage Schema** (Blog Posts & FAQ Pages):
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "How hard is National 5 Maths?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "National 5 Maths is challenging but achievable with proper preparation. It covers algebraic skills, geometry, trigonometry, and statistics. With adaptive AI tutoring, students can master concepts at their own pace."
    }
  }]
}
```

**Article Schema** (Blog Posts):
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Struggling with National 5 Maths? Here's How AI Can Help",
  "author": {
    "@type": "Organization",
    "name": "Scottish AI Lessons"
  },
  "datePublished": "2025-01-15",
  "dateModified": "2025-01-15",
  "image": "https://scottishailessons.com/blog/national-5-help.jpg",
  "publisher": {
    "@type": "Organization",
    "name": "Scottish AI Lessons",
    "logo": {
      "@type": "ImageObject",
      "url": "https://scottishailessons.com/logo.png"
    }
  }
}
```

### 3. Robots.txt & Sitemap

#### robots.txt
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /studio/

Sitemap: https://scottishailessons.com/sitemap.xml
```

#### XML Sitemap Structure
Generate dynamic sitemap with Next.js:
- Homepage (priority: 1.0, changefreq: weekly)
- Course pages (priority: 0.9, changefreq: weekly)
- Feature pages (priority: 0.8, changefreq: monthly)
- Blog posts (priority: 0.7, changefreq: monthly)
- Static pages (priority: 0.6, changefreq: yearly)

**Implementation**: Create `app/sitemap.ts` in Next.js App Router

```typescript
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://scottishailessons.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://scottishailessons.com/national-5-mathematics',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // ... dynamic generation for blog posts
  ]
}
```

---

## On-Page SEO Optimization

### 1. Title Tag Optimization

**Formula**: [Primary Keyword] | [Benefit/Modifier] | [Brand]

**Character Limit**: 50-60 characters (Google truncates at ~600px)

**Examples**:
- Homepage: `Scottish AI Lessons | SQA-Aligned AI Tutor for National 3/4/5` (59 chars)
- Course Page: `National 5 Maths Tutor | AI-Powered SQA Revision` (51 chars)
- Feature Page: `AI Maths Tutor | Instant Feedback & Interactive Diagrams` (56 chars)
- Blog Post: `How to Pass National 5 Maths: AI-Powered Study Guide` (54 chars)

**Best Practices**:
- Front-load primary keyword
- Include emotional trigger ("Master", "Ace", "Struggle-Free")
- Add modifiers for long-tail (year, location, "best", "free")
- Use pipes `|` or hyphens `-` for readability

### 2. Meta Description Optimization

**Character Limit**: 150-160 characters (Google truncates at ~920px)

**Formula**: [What] + [How/Benefit] + [CTA] + [Unique Value]

**Examples**:
```
Homepage:
"AI-powered tutoring for Scottish students. Get personalized help with National 5 Maths, Physics, and Applications. 24/7 adaptive learning aligned with SQA curriculum. Start free trial today." (159 chars)

National 5 Maths Page:
"Master National 5 Maths with AI tutoring. Instant feedback, interactive diagrams, and personalized practice aligned with SQA assessment standards. Try free." (158 chars)

Blog Post (Problem/Solution):
"Struggling with National 5 Maths? Learn how AI tutoring provides instant feedback, adaptive hints, and spaced repetition to boost your mastery. Read now." (155 chars)
```

**Best Practices**:
- Include primary keyword naturally
- Add clear CTA ("Start free trial", "Try free", "Learn how")
- Highlight unique value (SQA-aligned, 24/7, adaptive)
- Use active voice and power words

### 3. Header Tag Hierarchy (H1-H6)

**Rules**:
- One H1 per page (primary keyword + intent)
- H2s for main sections (secondary keywords)
- H3-H6 for subsections (long-tail keywords)
- Include semantic keywords in headers

**Example Structure** (National 5 Maths Course Page):
```html
<h1>National 5 Maths Tutor: AI-Powered SQA Revision</h1>

<h2>Why Choose AI Tutoring for National 5 Maths?</h2>
<h3>Instant Feedback on Every Practice Question</h3>
<h3>Interactive Diagrams for Visual Learning</h3>
<h3>Aligned with SQA Assessment Standards</h3>

<h2>What You'll Master in National 5 Maths</h2>
<h3>Unit 1: Expressions and Formulae</h3>
<h3>Unit 2: Relationships</h3>
<h3>Unit 3: Applications</h3>

<h2>How Scottish AI Lessons Works</h2>
<h3>Step 1: Take a Diagnostic Assessment</h3>
<h3>Step 2: Get Personalized Lesson Recommendations</h3>
<h3>Step 3: Practice with Adaptive Feedback</h3>

<h2>Student Success Stories</h2>

<h2>Frequently Asked Questions</h2>
<h3>How hard is National 5 Maths?</h3>
<h3>Can I use this alongside school work?</h3>
```

### 4. Content Optimization

#### Word Count Targets
- **Homepage**: 800-1,200 words (comprehensive but scannable)
- **Course Landing Pages**: 1,500-2,500 words (authoritative, in-depth)
- **Feature Pages**: 1,000-1,500 words (detailed explanations)
- **Blog Posts**: 1,200-2,000 words (thorough, actionable)
- **Comparison Pages**: 1,500-2,000 words (data-driven tables)

#### Keyword Density
- **Primary Keyword**: 1-2% (natural usage, avoid keyword stuffing)
- **Secondary Keywords**: 0.5-1% each
- **LSI Keywords**: Sprinkle semantic variations throughout

**LSI Keywords for "National 5 Maths"**:
- SQA mathematics
- Scottish qualifications
- SCQF level 5
- Higher maths preparation
- Curriculum for Excellence
- Assessment standards
- Exam practice
- Revision techniques

#### Content Quality Signals (E-E-A-T)
**Experience**:
- Student testimonials with specific outcomes ("improved from 0.42 to 0.89 mastery")
- Screenshots of actual platform features
- Video walkthroughs of lesson flow

**Expertise**:
- Reference official SQA documentation (link to SQA website)
- Cite learning science research (spaced repetition studies)
- Demonstrate technical knowledge (LangGraph architecture explanation)

**Authoritativeness**:
- Author bios with credentials
- Partnerships or endorsements (if available)
- Press mentions or case studies

**Trustworthiness**:
- Privacy policy and data protection (GDPR compliance)
- Accessibility statement (WCAG compliance)
- Transparent pricing
- Contact information and support options

### 5. Internal Linking Strategy

**Hub-Spoke Model**:
- **Hub Pages**: Course landing pages (National 5 Maths, National 4 Maths)
- **Spokes**: Blog posts linking back to relevant hub pages
- **Anchor Text**: Descriptive, keyword-rich (not "click here")

**Example Internal Links**:
```
Blog Post: "Struggling with National 5 Maths?"
→ Internal Link: "Try our <a href="/national-5-mathematics">National 5 Maths AI tutor</a> with instant feedback."

Blog Post: "The Science of Spaced Repetition"
→ Internal Link: "Our <a href="/features/mastery-tracking">mastery tracking system</a> uses spaced repetition to optimize retention."

National 5 Maths Page:
→ Internal Link: "Read our guide on <a href="/blog/how-to-pass-national-5">how to pass National 5 Maths</a>."
```

**Link Depth Rules**:
- Important pages should be ≤3 clicks from homepage
- Orphan pages (no internal links) = bad for SEO
- Broken links harm crawlability (use link checker)

### 6. Image Optimization

**File Naming**:
- Descriptive, keyword-rich: `national-5-maths-interactive-diagram.webp`
- Not: `IMG_1234.jpg`

**Alt Text**:
- Describe image for accessibility + SEO
- Include target keyword naturally
- Example: `alt="Interactive Pythagorean theorem diagram for National 5 Maths students"`

**Format & Compression**:
- Use WebP (better compression than JPEG/PNG)
- Lazy load below-the-fold images
- Serve responsive images (`srcset` for different screen sizes)
- Target: <200KB per image, <100KB for thumbnails

**Implementation**:
```tsx
import Image from 'next/image'

<Image
  src="/national-5-maths-diagram.webp"
  alt="Interactive National 5 Maths Pythagorean theorem diagram"
  width={800}
  height={600}
  loading="lazy"
  quality={85}
/>
```

---

## Content Strategy & Production

### Month 1-2: Foundation Pages (Quick Wins)

#### Week 1-2: Core Landing Pages
1. **Homepage** (`/`)
   - Primary Keyword: Scottish AI Lessons, AI Tutor Scotland
   - Target: 2,000 words
   - Content: Product overview, SQA alignment, feature highlights, social proof, CTA
   - CTA: "Start Free Trial" (above fold + bottom)

2. **National 5 Mathematics** (`/national-5-mathematics`)
   - Primary Keyword: national 5 maths tutor, national 5 maths revision
   - Target: 2,000 words
   - Content: Course outline (3 units), assessment standards, interactive features, student outcomes
   - Include: Embedded demo video, interactive diagram example, pricing

3. **National 4 Mathematics** (`/national-4-mathematics`)
   - Primary Keyword: national 4 maths help, national 4 maths practice
   - Target: 1,800 words
   - Content: Similar structure to National 5, emphasize foundational skills

#### Week 3-4: Key Feature Pages
4. **AI Maths Tutor** (`/features/ai-maths-tutor`)
   - Primary Keyword: ai maths tutor, ai homework help
   - Target: 1,500 words
   - Content: How AI works, instant feedback examples, comparison to human tutors

5. **SQA Curriculum Overview** (`/sqa/curriculum`)
   - Primary Keyword: sqa curriculum, sqa assessment support
   - Target: 1,800 words
   - Content: Official SQA integration, course codes, unit breakdown, assessment standards

### Month 3-4: Problem/Solution Content

#### Week 5-8: High-Intent Blog Posts
6. **"Struggling with National 5 Maths? Here's How AI Can Help"** (`/blog/struggling-national-5-maths`)
   - Primary Keyword: struggling with national 5 maths, how to pass national 5 maths
   - Target: 1,500 words
   - Structure:
     - H2: Common struggles (algebra, trigonometry, problem-solving)
     - H2: Why traditional methods fail (one-size-fits-all, no feedback)
     - H2: How AI tutoring solves this (adaptive hints, mastery tracking)
     - H2: Student success story (before/after data)
     - CTA: Try free diagnostic assessment

7. **"How Much Does Maths Tutoring Cost in Scotland? (AI Alternative)"** (`/blog/affordable-tutoring-scotland`)
   - Primary Keyword: maths tutoring cost scotland, cheap maths tutor
   - Target: 1,400 words
   - Content: Price comparison table (private tutors £25-50/hr vs. AI), ROI analysis, testimonial

8. **"AI Tutor vs. Human Tutor: What's Best for National 5 Students?"** (`/blog/ai-vs-human-tutor`)
   - Primary Keyword: ai tutor vs human tutor, find a maths tutor near me
   - Target: 1,800 words
   - Content: Comparison table (cost, availability, personalization), use case scenarios

9. **"How to Pass National 5 Maths: Evidence-Based Study Strategies"** (`/blog/how-to-pass-national-5`)
   - Primary Keyword: how to pass national 5 maths, best way to revise for national 5
   - Target: 2,000 words
   - Content: Spaced repetition, active recall, practice testing, mastery learning

### Month 5-6: Authority Building

#### Week 9-12: Deep-Dive Educational Content
10. **"Understanding SQA Assessment Standards: A Complete Guide"** (`/blog/sqa-assessment-standards`)
    - Primary Keyword: sqa assessment standards, what are sqa assessment standards
    - Target: 2,200 words
    - Content: Breakdown of each standard with examples, how they're assessed

11. **"The Science of Spaced Repetition for National 5 Exam Prep"** (`/blog/spaced-repetition-learning`)
    - Primary Keyword: spaced repetition learning, how does spaced repetition work
    - Target: 1,600 words
    - Content: Research citations, implementation in Scottish AI Lessons, data on retention

12. **"Dyslexia Support in Scottish Maths Education"** (`/accessibility/dyslexia-support`)
    - Primary Keyword: dyslexia maths help scotland
    - Target: 1,400 words
    - Content: WCAG compliance, plain language features, accessibility testing

### Ongoing: Weekly Blog Cadence
- **Week 13+**: Publish 1-2 blog posts per week
- Topics: Exam tips, topic breakdowns, student stories, feature tutorials
- Repurpose content: Turn blog posts into social media threads, videos, infographics

---

## Local SEO for Scottish Context

### 1. Google Business Profile (If Applicable)
**Note**: As a digital-only platform, traditional local SEO is limited. However, you can still optimize for local searches.

**Strategies**:
- Register business with Companies House (if UK-based entity)
- Create location pages for major Scottish cities (if serving local schools)
- Use Scottish landmarks and context in examples

### 2. Location-Specific Content

#### Targeting Major Scottish Cities (Lower Priority)
If expanding to partnerships with schools, create city-specific landing pages:

- `/tutoring/glasgow` - "AI Maths Tutor Glasgow | National 5 Help"
- `/tutoring/edinburgh` - "AI Maths Tutor Edinburgh | SQA Exam Prep"
- `/tutoring/aberdeen` - "AI Maths Tutor Aberdeen | Online National 5"

**Content**: Mention local schools (anonymized), exam centers, Scottish education statistics

### 3. NAP Consistency (Name, Address, Phone)
Even for online-only businesses, maintain consistent contact info:
- **Name**: Scottish AI Lessons
- **Address**: (If no physical location, use registered business address or "Online Only")
- **Phone**: UK phone number (if available)
- **Email**: contact@scottishailessons.com

Display this consistently in:
- Footer of website
- Contact page
- About page
- Schema markup

---

## Link Building & Authority

### 1. Content-Driven Link Acquisition

#### High-Value Link Targets
**Education Sector**:
- Education Scotland (education.gov.scot) - Resource listings
- SQA (sqa.org.uk) - Partner resources (if official partnership possible)
- Scottish schools' resource pages
- Teacher blogs and forums (TES Scotland)

**EdTech & Technology**:
- EdSurge, EdTech Magazine - Product reviews
- LangChain community (mention LangGraph implementation)
- AI/ML education blogs - Technical deep-dives

**News & Media**:
- The Herald Scotland - EdTech innovation stories
- The Scotsman - Education technology coverage
- BBC Scotland - Education section
- Local newspapers (Glasgow Times, Edinburgh Evening News)

#### Linkable Asset Creation
**Interactive Tools** (embed-friendly):
1. **Free SQA Diagnostic Tool** - Students take quiz, get recommended lessons
2. **National 5 Maths Formula Sheet** - Downloadable PDF with branding
3. **Study Planner Calculator** - Input exam date, get spaced repetition schedule
4. **Interactive Pythagorean Theorem Visualizer** - Shareable JSXGraph embed

**Data & Research**:
5. **"State of Scottish Secondary Education" Report** - Survey teachers/students, publish findings
6. **SQA Exam Statistics Dashboard** - Visualize pass rates, popular subjects (public data)

**Ultimate Guides**:
7. **"The Complete Guide to National 5 Maths"** - 10,000+ word pillar page
8. **"SQA Curriculum Navigator"** - Interactive course explorer

### 2. Outreach Strategy

#### HARO (Help A Reporter Out)
- Sign up for HARO alerts (education, technology categories)
- Respond to queries about AI in education, Scottish education trends
- Provide expert quotes → backlinks in articles

#### Guest Posting
**Target Blogs**:
- EdTech blogs (EdSurge, Getting Smart)
- Teacher resource sites (TES, Teach Secondary)
- AI/tech blogs (Towards Data Science, Medium publications)

**Pitch Ideas**:
- "How We Built an AI Tutor Using LangGraph" (technical audience)
- "5 Ways AI Can Support Dyslexic Maths Learners" (education audience)
- "The Future of SQA Exam Prep: AI-Powered Adaptive Learning" (Scottish education)

#### Partnership Outreach
**Potential Partners**:
- Scottish schools for pilot programs (testimonials + backlinks)
- Teacher training colleges (resources for student teachers)
- Dyslexia Scotland (accessibility partnership)
- Education conferences (sponsorship + speaking slots)

### 3. Broken Link Building

**Process**:
1. Find education resource pages linking to broken/outdated content
2. Use Ahrefs or Check My Links Chrome extension
3. Reach out: "Hi, noticed broken link on your National 5 resources page. We have an updated guide that might fit."
4. Provide link to relevant Scottish AI Lessons content

**Target Pages**:
- School resource lists (often outdated)
- Teacher blog posts from 2015-2020 (broken links common)
- Government education resource pages

---

## Performance Optimization

### 1. Core Web Vitals Targets

**Google Ranking Factors** (as of 2025):
- **LCP (Largest Contentful Paint)**: <2.5s (good) | 2.5-4s (needs improvement) | >4s (poor)
- **FID (First Input Delay)**: <100ms (good) | 100-300ms (needs improvement) | >300ms (poor)
- **CLS (Cumulative Layout Shift)**: <0.1 (good) | 0.1-0.25 (needs improvement) | >0.25 (poor)
- **INP (Interaction to Next Paint)**: <200ms (good) | 200-500ms (needs improvement) | >500ms (poor)

**Current Stack Advantages**:
- Next.js 15 App Router - Server-side rendering + static generation
- Vercel CDN - Global edge network for fast delivery
- React 19 - Improved rendering performance

### 2. Performance Optimizations

#### Image Optimization (Already Mentioned)
- WebP format with fallback
- Lazy loading below fold
- Next.js Image component (`next/image`)
- Responsive images with `srcset`

#### Code Splitting & Bundling
- Next.js automatic code splitting ✅
- Dynamic imports for heavy components (JSXGraph diagrams)
```tsx
import dynamic from 'next/dynamic'

const DiagramComponent = dynamic(() => import('@/components/JSXGraphDiagram'), {
  loading: () => <p>Loading diagram...</p>,
  ssr: false // Client-side only for interactive diagrams
})
```

#### Minimize JavaScript
- Tree-shaking unused code ✅ (Next.js default)
- Defer non-critical JS
- Use `next/script` with strategy="lazyOnload" for analytics

#### Font Optimization
```tsx
import { Inter, Open_Sans } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Prevent FOIT (Flash of Invisible Text)
  variable: '--font-inter'
})
```

#### Caching Strategy
- Static pages: Cache-Control: `public, max-age=31536000, immutable`
- Dynamic pages: `stale-while-revalidate`
- API routes: Cache responses where appropriate (course data)

### 3. Mobile Optimization

**Mobile-First Approach**:
- 60%+ of education searches are mobile
- Responsive design with Tailwind breakpoints
- Touch-friendly interactive diagrams (JSXGraph already optimized)
- Accessible tap targets (minimum 44x44px)

**Mobile Performance**:
- Reduce initial bundle size (<150KB)
- Prioritize above-the-fold content
- Avoid layout shifts (reserve space for images)

### 4. PageSpeed Insights Monitoring

**Tool**: https://pagespeed.web.dev/

**Targets**:
- **Mobile Score**: >90 (Performance)
- **Desktop Score**: >95 (Performance)
- All Core Web Vitals in "Good" range

**Weekly Monitoring**:
- Test homepage, course pages, blog posts
- Identify regressions after deployments
- Use Lighthouse CI in GitHub Actions (optional)

---

## Google Search Console Setup

### 1. Initial Setup (Week 1)

**Steps**:
1. Create Google Search Console account: https://search.google.com/search-console
2. Add property: `scottishailessons.com`
3. Verify ownership:
   - **Method 1**: Upload HTML file to `/public/google-verification.html`
   - **Method 2**: Add DNS TXT record (if managing domain DNS)
   - **Method 3**: Add meta tag to `<head>` (Next.js metadata)

```tsx
// app/layout.tsx
export const metadata = {
  verification: {
    google: 'YOUR_VERIFICATION_CODE'
  }
}
```

4. Submit sitemap: `https://scottishailessons.com/sitemap.xml`

### 2. Manual Indexing (Week 1-2)

**Priority Pages to Request Indexing**:
1. Homepage
2. National 5 Mathematics page
3. National 4 Mathematics page
4. AI Maths Tutor page
5. SQA Curriculum page

**Process**:
- Go to URL Inspection tool in GSC
- Enter URL
- Click "Request Indexing"
- Wait 24-48 hours for crawl

### 3. Ongoing Monitoring (Weekly)

**Key Metrics to Track**:
- **Performance**:
  - Total clicks (organic traffic)
  - Total impressions (visibility)
  - Average CTR (click-through rate)
  - Average position (ranking)

- **Coverage**:
  - Valid pages indexed
  - Errors (404s, server errors)
  - Excluded pages (check if important pages missing)

- **Core Web Vitals**:
  - LCP, FID/INP, CLS scores by page
  - Mobile vs. desktop performance

- **Top Queries**:
  - Which keywords driving traffic
  - Position for target keywords
  - Opportunities (high impressions, low CTR)

**Actions Based on Data**:
- **High impressions, low CTR** → Improve title/meta description
- **Position 11-20** → Optimize content, build links (close to page 1!)
- **Coverage errors** → Fix technical issues immediately
- **Slow Core Web Vitals** → Performance optimization

---

## LLM Optimization (ChatGPT, Claude, Perplexity)

### Why LLM SEO Matters
As of 2025, AI chatbots like ChatGPT, Claude, Perplexity, and Google Gemini are becoming primary search interfaces. Students may ask:
- "Find me a National 5 maths tutor"
- "What's the best AI tutor for Scottish students?"
- "How can I improve my SQA exam scores?"

**Goal**: Ensure Scottish AI Lessons appears in LLM responses with accurate, compelling information.

### 1. LLM-Friendly Content Structure

#### Clear, Factual Statements
LLMs prefer structured, authoritative content over marketing fluff.

**Good** ✅:
> "Scottish AI Lessons is an AI-powered tutoring platform specifically designed for SQA National 3, 4, and 5 qualifications. It provides adaptive learning with instant feedback, aligned with official SQA assessment standards."

**Bad** ❌:
> "Unlock your potential with our revolutionary, game-changing AI platform! Transform your learning journey today!"

#### Use Definitive Facts
- Include specific data: "50 lessons covering all SQA National 5 Maths assessment standards"
- Reference official sources: "Aligned with SQA course code C844 74"
- Provide measurable outcomes: "Students improve mastery scores by an average of 0.35 points"

#### Structured Data for LLMs
LLMs can parse structured formats:
- **Lists**: Use bullet points and numbered lists liberally
- **Tables**: Comparison tables (AI vs. human tutor, pricing tiers)
- **FAQs**: Q&A format with schema markup
- **Headings**: Clear H2/H3 structure for topic segmentation

### 2. FAQ Pages for Common Queries

Create comprehensive FAQ pages targeting questions students ask LLMs:

**Example FAQs**:
- "What is Scottish AI Lessons?"
- "Does Scottish AI Lessons cover SQA curriculum?"
- "How much does Scottish AI Lessons cost?"
- "Can Scottish AI Lessons help with National 5 Maths?"
- "Is Scottish AI Lessons accessible for dyslexic students?"
- "Does Scottish AI Lessons work on mobile?"
- "Can I use Scottish AI Lessons alongside school?"
- "What subjects does Scottish AI Lessons offer?"

**Format**:
```markdown
## What is Scottish AI Lessons?

Scottish AI Lessons is an AI-powered adaptive learning platform designed specifically for Scottish secondary students preparing for SQA National 3, 4, and 5 qualifications. It offers:

- Personalized lesson recommendations based on mastery tracking
- Instant feedback on practice questions
- Interactive mathematical diagrams using JSXGraph
- Accessibility features including plain language and dyslexia support
- Official SQA curriculum alignment with course codes and assessment standards

The platform uses LangGraph AI technology to provide 24/7 tutoring in Mathematics, Physics, and Applications of Mathematics.
```

### 3. Citations & Authoritative Sources

LLMs prioritize content with citations and authoritative references.

**Link to Official Sources**:
- SQA website (https://www.sqa.org.uk/)
- Education Scotland (https://education.gov.scot/)
- Research papers on spaced repetition, mastery learning
- Learning science studies (cite PubMed, Google Scholar papers)

**Example**:
> "Spaced repetition has been shown to improve long-term retention by up to 200% compared to massed practice (Cepeda et al., 2006). Scottish AI Lessons implements this research-backed technique through adaptive scheduling algorithms."

### 4. Brand Entity Recognition

Help LLMs recognize "Scottish AI Lessons" as a distinct entity:

**Consistent Branding**:
- Always use full name "Scottish AI Lessons" (not SAL, ScottishAI, etc.)
- Include in every meta description and key page
- Schema markup with Organization type
- Wikipedia entry (if notable enough in future)

**Alternative Names to Mention**:
- "Scottish AI Lessons platform"
- "ScottishAILessons.com"
- "SQA AI tutor Scottish AI Lessons"

### 5. Comparison Content

LLMs often answer "What's better, X or Y?" questions.

**Create Comparison Pages**:
1. **"Scottish AI Lessons vs. BBC Bitesize"** (`/compare/vs-bbc-bitesize`)
   - Table comparing features
   - Objective assessment of pros/cons
   - Use case: "Use Bitesize for quick reference, Scottish AI Lessons for adaptive practice"

2. **"Scottish AI Lessons vs. Seneca Learning"** (`/compare/vs-seneca-learning`)
   - Highlight SQA-specific advantage
   - Table: Scottish curriculum alignment

3. **"Scottish AI Lessons vs. Private Tutors"** (`/compare/vs-private-tutors`)
   - Cost comparison: £X/month vs. £25-50/hour
   - Availability: 24/7 vs. scheduled sessions
   - When to choose each: "Private tutors excel at complex pastoral support, AI excels at scalable practice"

**Tone**: Be objective and fair. LLMs penalize obviously biased content.

### 6. Freshness Signals

LLMs often prefer recent content (2024-2025 over 2020).

**Update Strategies**:
- Add "Last updated: [Date]" to articles
- Publish regular blog posts (weekly cadence)
- Update course pages when SQA curriculum changes
- Include current year in title tags where relevant: "National 5 Maths 2025"

### 7. Embeddings Optimization

LLMs use semantic embeddings to understand content. Optimize for semantic search:

**Use Topic Clustering**:
- Group related concepts: "SQA", "National 5", "assessment standards" near each other
- Create topic hubs (pillar pages) with spoke content
- Internal link related concepts

**Semantic Keyword Variations**:
Don't just repeat "National 5 Maths"—use variations:
- SQA National 5 Mathematics
- N5 Maths
- SCQF Level 5 Mathematics
- National Five Maths
- Scottish National 5 Maths

### 8. Testimonials & Social Proof

LLMs may cite user reviews and testimonials in responses.

**Structured Reviews**:
```json
{
  "@type": "Review",
  "author": "Ava M., National 5 Student",
  "datePublished": "2025-01-10",
  "reviewBody": "Scottish AI Lessons helped me improve my maths mastery from 0.42 to 0.89 in just 6 weeks. The instant feedback and adaptive hints made difficult topics like trigonometry finally click.",
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": "5",
    "bestRating": "5"
  }
}
```

Display testimonials prominently on homepage and course pages.

### 9. Platform Presence on LLM Training Data

**Goal**: Ensure content is crawled and included in LLM training datasets.

**Strategies**:
- Allow all major crawlers in `robots.txt` (don't block GPTBot, CCBot, etc.)
- Publish on platforms LLMs scrape:
  - Medium (cross-post blog content)
  - GitHub (technical documentation, open-source components)
  - Reddit (participate in r/ScottishEducation, r/GetStudying)
  - Quora (answer National 5 questions)
- Create shareable, citable content (research reports, guides)

### 10. Monitoring LLM Citations

**How to Check**:
- Ask ChatGPT, Claude, Perplexity: "What is Scottish AI Lessons?" → See if correctly cited
- Use citation tracking tools (if available): Browse.ai, or manual testing
- Monitor referral traffic from chat.openai.com, claude.ai domains (limited visibility)

**Iterate**:
- If incorrect info appears, update FAQ pages to correct
- If not mentioned, increase content volume + authoritative signals

---

## Analytics & Iteration

### 1. Google Analytics 4 Setup

**Implementation** (Next.js):
```tsx
// app/layout.tsx
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
      <GoogleAnalytics gaId="G-XXXXXXXXXX" />
    </html>
  )
}
```

**Key Events to Track**:
- `sign_up` - User creates account (primary conversion)
- `trial_start` - User begins free trial
- `lesson_start` - User starts a lesson
- `lesson_complete` - User completes a lesson
- `page_view` - Standard pageviews
- `scroll_depth` - 25%, 50%, 75%, 100% scroll milestones
- `cta_click` - Clicks on "Start Free Trial" buttons

**Custom Dimensions**:
- `course_level` - National 3, 4, or 5
- `subject` - Maths, Physics, Applications
- `traffic_source` - Organic, Direct, Referral, Social

### 2. Conversion Funnel Tracking

**Funnel Stages**:
1. **Awareness**: Organic search traffic to blog/landing pages
2. **Consideration**: Homepage visit, feature page views
3. **Conversion**: Sign-up form submission
4. **Activation**: First lesson started
5. **Retention**: 7-day active user

**Track Drop-Offs**:
- High bounce rate on landing pages → Improve content/CTA
- Low sign-up conversion → A/B test CTAs, simplify form
- Low lesson start rate → Improve onboarding UX

### 3. A/B Testing for SEO

**Test Variables**:
- **Title Tags**: Emotional vs. factual ("Master N5 Maths" vs. "N5 Maths Tutor")
- **Meta Descriptions**: CTA variations ("Try free" vs. "Start today" vs. "Learn more")
- **H1 Headlines**: Question format vs. statement ("Struggling with N5?" vs. "N5 Maths Tutor")
- **CTA Button Text**: "Start Free Trial" vs. "Try AI Tutor Free" vs. "Get Started"

**Tool**: Google Optimize (sunset 2023) → Use:
- Vercel Edge Config for Next.js A/B tests
- Optimizely
- VWO (Visual Website Optimizer)

### 4. Heatmaps & User Behavior

**Tools**:
- **Hotjar**: Heatmaps, session recordings, feedback polls
- **Microsoft Clarity**: Free heatmaps and session replay
- **FullStory**: Advanced user journey analysis

**Insights to Look For**:
- Are users clicking non-clickable elements? (improve UX)
- Do users scroll past important CTAs? (reposition)
- Where do users drop off in sign-up flow? (optimize form)

### 5. SEO Reporting Dashboard

**Weekly Metrics** (Google Data Studio or Looker Studio):
1. **Organic Traffic**: Sessions from organic search
2. **Keyword Rankings**: Top 10 target keywords (use Ahrefs/Semrush API or GSC)
3. **Top Landing Pages**: Pages receiving most organic traffic
4. **Conversions from Organic**: Sign-ups attributed to organic search
5. **Core Web Vitals**: LCP, INP, CLS scores
6. **Backlinks**: New backlinks this week (Ahrefs/Semrush)

**Monthly Deep Dive**:
- Content gaps analysis (keywords competitors rank for, we don't)
- SERP feature acquisitions (featured snippets, People Also Ask)
- Technical SEO audit (crawl errors, broken links, duplicate content)
- Content performance (top blog posts by traffic, engagement)

---

## Timeline & Milestones

### Pre-Launch (Week 0)
- [ ] Domain purchased and DNS configured
- [ ] Hosting set up (Vercel recommended)
- [ ] Google Search Console verified
- [ ] Google Analytics 4 installed
- [ ] XML sitemap generated and submitted
- [ ] robots.txt configured

### Month 1: Foundation (Weeks 1-4)
**Week 1**:
- [ ] Homepage live with optimized meta tags and schema
- [ ] National 5 Maths landing page published
- [ ] Request indexing for homepage and N5 Maths page
- [ ] Set up Google Analytics conversion tracking

**Week 2**:
- [ ] National 4 Maths landing page published
- [ ] AI Maths Tutor feature page published
- [ ] Internal linking structure implemented
- [ ] First blog post published: "Struggling with National 5 Maths?"

**Week 3**:
- [ ] SQA Curriculum overview page published
- [ ] Accessibility page published
- [ ] Second blog post: "How Much Does Maths Tutoring Cost in Scotland?"
- [ ] Submit all new pages for indexing

**Week 4**:
- [ ] Review GSC data: any pages indexed? Crawl errors?
- [ ] Publish comparison page: "AI Tutor vs. Human Tutor"
- [ ] Set up heatmap tracking (Hotjar/Clarity)
- [ ] Month 1 SEO report: baseline metrics

**Target Metrics**:
- 5-10 pages indexed
- 50-100 organic impressions (GSC)
- 0-5 organic clicks (normal for brand new site)
- 0 crawl errors

### Month 2: Content Expansion (Weeks 5-8)
**Week 5-6**:
- [ ] National 5 Physics landing page published
- [ ] Blog post: "How to Pass National 5 Maths"
- [ ] Blog post: "The Science of Spaced Repetition"
- [ ] Outreach: 5 HARO responses submitted

**Week 7-8**:
- [ ] Blog post: "Understanding SQA Assessment Standards"
- [ ] Comparison page: "Scottish AI Lessons vs. BBC Bitesize"
- [ ] Create first linkable asset: Free SQA Diagnostic Tool
- [ ] Outreach: 3 guest post pitches sent
- [ ] Month 2 SEO report

**Target Metrics**:
- 12-15 pages indexed
- 200-500 organic impressions
- 10-30 organic clicks
- Average position: 30-50 for target keywords

### Month 3: Authority Building (Weeks 9-12)
**Week 9-10**:
- [ ] Ultimate guide: "The Complete Guide to National 5 Maths" (3,000+ words)
- [ ] Blog post: "Dyslexia Support in Scottish Maths Education"
- [ ] Press release: Launch announcement to Scottish education media
- [ ] Outreach: Partner pitch to 5 Scottish schools

**Week 11-12**:
- [ ] Interactive tool: Study Planner Calculator
- [ ] Blog post: Topic breakdown (e.g., "Mastering Trigonometry for N5")
- [ ] First backlink acquired (target: education blog or news site)
- [ ] Month 3 SEO report

**Target Metrics**:
- 20+ pages indexed
- 1,000-2,000 organic impressions
- 50-100 organic clicks
- Average position: 20-30 for some keywords
- 1-3 quality backlinks (DR 30+)

### Month 4-6: Scaling & Optimization (Weeks 13-24)
**Ongoing Activities**:
- [ ] Publish 1-2 blog posts per week (every Tuesday & Thursday)
- [ ] Monitor rankings weekly: track movement for top 20 keywords
- [ ] Update low-performing pages based on GSC data
- [ ] Outreach: 5 link building contacts per week
- [ ] A/B test title tags and meta descriptions on key pages
- [ ] Add FAQ schema to all blog posts
- [ ] Expand to more subjects (if applicable): National 5 Applications, National 4 Physics

**Target Metrics (Month 6)**:
- 40-50 pages indexed
- 5,000-10,000 organic impressions
- 250-500 organic clicks (CTR: 3-5%)
- Average position: Top 10 for 3-5 long-tail keywords, Top 20 for main keywords
- 5-10 quality backlinks (DR 30+)
- 1-3 featured snippets acquired

### Month 7-12: Scaling to Page 1 Rankings (Weeks 25-52)
**Focus Areas**:
- **Content Depth**: Expand top-performing pages to 3,000+ words
- **Link Velocity**: Acquire 5-10 backlinks per month through content marketing
- **Technical SEO**: Maintain <2.5s LCP, >95 PageSpeed score
- **Brand Building**: Increase branded searches ("Scottish AI Lessons")
- **Conversion Optimization**: Improve organic traffic → sign-up rate to 5%+

**Target Metrics (Month 12)**:
- 100+ pages indexed
- 20,000-40,000 organic impressions
- 1,000-2,000 organic clicks (CTR: 4-6%)
- **Average position**:
  - **Top 3** for 5-10 long-tail keywords (e.g., "ai tutor scotland", "national 4 maths help")
  - **Top 10** for 10-15 medium-competition keywords (e.g., "national 5 maths tutor", "sqa curriculum")
  - **Top 20** for high-competition keywords (e.g., "ai maths tutor", "online maths tutor")
- 20-40 quality backlinks (DR 30+, mix of education, news, tech sites)
- 10+ featured snippets
- 50-100 sign-ups per month from organic search

---

## Success Metrics & KPIs

### Leading Indicators (Track Weekly)
1. **Keyword Rankings**: Position changes for top 20 target keywords
2. **Indexed Pages**: Coverage in Google Search Console
3. **Crawl Health**: Errors, warnings in GSC
4. **Backlinks**: New referring domains (track in Ahrefs/Semrush)
5. **Content Published**: Blog posts, landing pages per week

### Lagging Indicators (Track Monthly)
1. **Organic Traffic**: Total sessions from organic search
2. **Organic Conversions**: Sign-ups from organic traffic
3. **SERP Features**: Featured snippets, PAA boxes won
4. **Domain Authority**: Ahrefs DR / Moz DA (target: 30+ by Month 12)
5. **Branded Search Volume**: Searches for "Scottish AI Lessons"

### North Star Metric
**Organic Sign-Ups Per Month**: Students who discover and sign up via organic search.

**Targets**:
- Month 3: 5-10 organic sign-ups
- Month 6: 25-50 organic sign-ups
- Month 12: 100+ organic sign-ups

---

## Risk Mitigation

### Google Algorithm Updates
**Risk**: Core updates can drastically change rankings.

**Mitigation**:
- Focus on E-E-A-T (experience, expertise, authority, trust)
- Avoid black-hat tactics (keyword stuffing, link schemes)
- Diversify traffic sources (social, email, partnerships)
- Monitor Google Search Central blog for update announcements

### Competitor Response
**Risk**: BBC Bitesize, Seneca, or new entrants improve SQA content.

**Mitigation**:
- Maintain unique value proposition (official SQA integration, self-hosted option)
- Continuous content updates and freshness
- Build brand loyalty through superior product

### Technical SEO Failures
**Risk**: Site downtime, slow loading, crawl errors harm rankings.

**Mitigation**:
- Uptime monitoring (UptimeRobot, Vercel Analytics)
- Weekly GSC checks for coverage issues
- Automated PageSpeed tests in CI/CD
- Staging environment for testing changes before production

---

## Next Steps

### Immediate Actions (This Week)
1. **Audit current scottishailessons.com site**:
   - Run PageSpeed Insights: https://pagespeed.web.dev/
   - Check existing meta tags and schema
   - Identify quick wins (missing alt text, no sitemap, etc.)

2. **Set up tracking**:
   - Google Search Console verification
   - Google Analytics 4 installation
   - Submit sitemap

3. **Optimize existing pages**:
   - Update homepage title and meta description (see templates above)
   - Add schema markup (Organization, Course)
   - Fix any broken links or images

### Month 1 Priorities
1. Publish National 5 Maths and National 4 Maths landing pages
2. Publish first 2 blog posts (problem/solution content)
3. Request indexing for all key pages
4. Begin outreach for first backlinks (HARO, guest posts)

### Long-Term (6-12 Months)
1. Build to 50+ high-quality pages
2. Acquire 20+ authoritative backlinks
3. Achieve Top 10 rankings for 10+ target keywords
4. Drive 100+ organic sign-ups per month
5. Establish Scottish AI Lessons as the authoritative resource for SQA AI tutoring

---

**Document Version**: 1.0
**Last Updated**: 2025-11-11
**Owner**: ScottishAILessons Team
**Review Cycle**: Monthly (adjust based on ranking data)

**Related Documents**:
- `BRANDING_GUIDE.md` - Brand identity and messaging
- `KEYWORD_RESEARCH.md` - Full keyword list with search volumes
- `IMPLEMENTATION_CHECKLIST.md` - Step-by-step action plan
