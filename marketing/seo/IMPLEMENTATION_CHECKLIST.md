# Scottish AI Lessons - SEO Implementation Checklist
## Step-by-Step Action Plan to Rank First on Google

This checklist provides a practical, week-by-week implementation plan for the SEO strategy. Use this as your roadmap to launch and optimize scottishailessons.com for maximum organic visibility.

---

## Pre-Launch Setup (Complete Before Going Live)

### Domain & Hosting
- [ ] Domain `scottishailessons.com` registered and DNS configured
- [ ] Hosting platform selected (✅ Recommended: Vercel for Next.js)
- [ ] SSL certificate installed (HTTPS enabled)
- [ ] WWW vs. non-WWW redirect configured (choose one canonical version)
- [ ] Test site accessibility: `https://scottishailessons.com` loads correctly

### Technical Foundation
- [ ] Next.js 15 App Router confirmed (check `package.json`)
- [ ] TypeScript enabled for type safety
- [ ] Tailwind CSS 4 configured for styling
- [ ] Create `/public` folder for static assets (images, PDFs)
- [ ] Set up environment variables in `.env.local` (API keys, etc.)

### Analytics & Tracking Setup
- [ ] **Google Search Console**:
  - [ ] Create account: https://search.google.com/search-console
  - [ ] Add property: `scottishailessons.com`
  - [ ] Verify ownership (choose method below):
    - [ ] Option 1: HTML file upload to `/public/google-verification.html`
    - [ ] Option 2: DNS TXT record (if managing DNS)
    - [ ] Option 3: Meta tag in `<head>` (Next.js metadata API)
  - [ ] Verification confirmed (green checkmark in GSC)

- [ ] **Google Analytics 4**:
  - [ ] Create GA4 property: https://analytics.google.com
  - [ ] Copy Measurement ID (format: `G-XXXXXXXXXX`)
  - [ ] Install GA4 in Next.js (see code snippet below)
  - [ ] Test: Visit site in incognito mode, check GA4 Realtime report

```tsx
// app/layout.tsx
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
      <GoogleAnalytics gaId="G-XXXXXXXXXX" />
    </html>
  )
}
```

- [ ] **Event Tracking Setup**:
  - [ ] `sign_up` event for user registration
  - [ ] `trial_start` event for free trial begins
  - [ ] `lesson_start` event for lesson engagement
  - [ ] `cta_click` event for CTA button clicks

### SEO Technical Setup
- [ ] **Sitemap Generation**:
  - [ ] Create `app/sitemap.ts` (see code snippet below)
  - [ ] Test locally: `http://localhost:3000/sitemap.xml`
  - [ ] Submit to GSC after deployment

```tsx
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://scottishailessons.com'

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/national-5-mathematics`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/national-4-mathematics`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // Add more pages as you create them
  ]
}
```

- [ ] **Robots.txt**:
  - [ ] Create `app/robots.ts` (see code snippet below)
  - [ ] Test locally: `http://localhost:3000/robots.txt`

```tsx
// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/', '/studio/'],
      },
    ],
    sitemap: 'https://scottishailessons.com/sitemap.xml',
  }
}
```

- [ ] **Favicon & App Icons**:
  - [ ] Create `favicon.ico` in `/app` directory (16x16, 32x32, 48x48)
  - [ ] Create `icon.png` (512x512) for general use
  - [ ] Create `apple-icon.png` (180x180) for iOS
  - [ ] Test: Check browser tab shows favicon

### Performance Baseline
- [ ] Run PageSpeed Insights: https://pagespeed.web.dev/
  - [ ] Mobile score recorded: ____
  - [ ] Desktop score recorded: ____
  - [ ] LCP score: ____ (target: <2.5s)
  - [ ] INP score: ____ (target: <200ms)
  - [ ] CLS score: ____ (target: <0.1)
- [ ] Identify top 3 performance issues to fix
- [ ] Set up Vercel Analytics (if using Vercel hosting)

---

## Week 1: Homepage & Core Pages

### Day 1-2: Homepage Optimization

- [ ] **Meta Tags** (edit `app/page.tsx` or `app/layout.tsx`):
```tsx
export const metadata = {
  title: 'Scottish AI Lessons | SQA-Aligned AI Tutor for National 3/4/5',
  description: 'AI-powered tutoring for Scottish students. Get personalized help with National 5 Maths, Physics, and Applications. 24/7 adaptive learning aligned with SQA curriculum. Start free trial today.',
  keywords: 'ai tutor scotland, national 5 maths tutor, sqa exam practice, scottish ai lessons, adaptive learning',
  openGraph: {
    title: 'Scottish AI Lessons | SQA-Aligned AI Tutor',
    description: 'AI-powered tutoring for National 3/4/5. Personalized, accessible, and aligned with SQA curriculum.',
    url: 'https://scottishailessons.com',
    siteName: 'Scottish AI Lessons',
    images: [
      {
        url: 'https://scottishailessons.com/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Scottish AI Lessons | SQA-Aligned AI Tutor',
    description: 'AI-powered tutoring for National 3/4/5. Personalized, accessible, and aligned with SQA curriculum.',
    images: ['https://scottishailessons.com/twitter-image.jpg'],
  },
}
```

- [ ] **Homepage Content Checklist**:
  - [ ] H1 tag: "Scottish AI Lessons: Your Personal AI Tutor for SQA Qualifications"
  - [ ] Above-fold hero section with primary CTA ("Start Free Trial")
  - [ ] Value proposition: "Official SQA curriculum, 24/7 availability, instant feedback"
  - [ ] Feature highlights: Adaptive learning, interactive diagrams, accessibility
  - [ ] Social proof: Student testimonials (if available) or case study preview
  - [ ] Secondary CTA at bottom: "Try Free Diagnostic Assessment"
  - [ ] Footer: Contact info, privacy policy, accessibility statement
  - [ ] Word count: 800-1,200 words
  - [ ] Internal links to: National 5 Maths, National 4 Maths, Features, About

- [ ] **Schema Markup** (add to homepage):
```tsx
// app/page.tsx
export default function HomePage() {
  const organizationSchema = {
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
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      {/* Homepage content */}
    </>
  )
}
```

- [ ] **Image Optimization**:
  - [ ] Hero image converted to WebP format (<200KB)
  - [ ] Alt text added: "Scottish students using AI tutor for National 5 Maths"
  - [ ] Using Next.js Image component with `priority` flag for hero image
  - [ ] All other images lazy-loaded

- [ ] **Call-to-Action (CTA) Buttons**:
  - [ ] Primary CTA: "Start Free Trial" (above fold, prominent color)
  - [ ] Secondary CTA: "Watch Demo" or "See How It Works"
  - [ ] Footer CTA: "Get Started Today"
  - [ ] All CTAs tracked in Google Analytics (`cta_click` event)

- [ ] **Mobile Optimization**:
  - [ ] Test on mobile device (iPhone, Android)
  - [ ] CTA buttons min 44x44px touch target
  - [ ] Text readable without zooming (min 16px font size)
  - [ ] No horizontal scrolling

### Day 3-4: National 5 Mathematics Landing Page

- [ ] **Create Page**: `app/national-5-mathematics/page.tsx`

- [ ] **Meta Tags**:
```tsx
export const metadata = {
  title: 'National 5 Maths Tutor | AI-Powered SQA Revision | Scottish AI Lessons',
  description: 'Master National 5 Maths with AI tutoring. Instant feedback, interactive diagrams, and personalized practice aligned with SQA assessment standards. Try free.',
}
```

- [ ] **Content Structure**:
  - [ ] H1: "National 5 Maths Tutor: AI-Powered SQA Revision"
  - [ ] H2: "Why Choose AI Tutoring for National 5 Maths?"
    - [ ] H3: Instant Feedback on Every Practice Question
    - [ ] H3: Interactive Diagrams for Visual Learning
    - [ ] H3: Aligned with SQA Assessment Standards (Course Code: C844 74)
  - [ ] H2: "What You'll Master in National 5 Maths"
    - [ ] H3: Unit 1: Expressions and Formulae
    - [ ] H3: Unit 2: Relationships
    - [ ] H3: Unit 3: Applications
  - [ ] H2: "How Scottish AI Lessons Works"
    - [ ] Step 1: Diagnostic assessment
    - [ ] Step 2: Personalized lesson plan
    - [ ] Step 3: Adaptive practice with hints
  - [ ] H2: "Student Success Stories" (testimonial if available)
  - [ ] H2: "Frequently Asked Questions"
    - [ ] FAQ: "How hard is National 5 Maths?"
    - [ ] FAQ: "Can I use this alongside school?"
    - [ ] FAQ: "Is this accessible for dyslexic students?"
  - [ ] Word count: 1,500-2,000 words

- [ ] **Schema Markup** (Course schema):
```tsx
const courseSchema = {
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
  "teaches": [
    "Expressions and formulae",
    "Relationships",
    "Applications"
  ]
}
```

- [ ] **Internal Links**:
  - [ ] Link to homepage (breadcrumb)
  - [ ] Link to "AI Maths Tutor" feature page
  - [ ] Link to "SQA Curriculum" page
  - [ ] Link to relevant blog posts (when published)

- [ ] **CTA Placement**:
  - [ ] Above fold: "Start Free Trial for National 5 Maths"
  - [ ] Mid-page: "Try a Sample Lesson"
  - [ ] Bottom: "Get Your Personalized Study Plan"

### Day 5-7: National 4 Mathematics & AI Tutor Pages

- [ ] **National 4 Mathematics Page** (`app/national-4-mathematics/page.tsx`):
  - [ ] Meta tags: "National 4 Maths Help | AI Tutor for SQA Revision"
  - [ ] Similar structure to National 5 page (1,500-1,800 words)
  - [ ] Course schema with code (National 4)
  - [ ] FAQs tailored to National 4 students

- [ ] **AI Maths Tutor Feature Page** (`app/features/ai-maths-tutor/page.tsx`):
  - [ ] Meta tags: "AI Maths Tutor | Instant Feedback & Interactive Diagrams"
  - [ ] H1: "AI Maths Tutor: How It Works"
  - [ ] Explain LangGraph technology (simplified for students)
  - [ ] Comparison table: AI tutor vs. traditional methods
  - [ ] Demo video or GIF showing interaction
  - [ ] Word count: 1,000-1,500 words

- [ ] **Internal Linking**:
  - [ ] Update homepage to link to all 3 new pages
  - [ ] Cross-link National 5/4 Maths pages ("Explore National 4 Maths")
  - [ ] Link AI Tutor page from both course pages

### Week 1 Wrap-Up

- [ ] **Deploy to Production** (Vercel):
  - [ ] Run build locally: `npm run build` (check for errors)
  - [ ] Deploy to Vercel: `vercel --prod` or push to main branch (auto-deploy)
  - [ ] Test live site: All pages load correctly
  - [ ] Check sitemap: `https://scottishailessons.com/sitemap.xml`
  - [ ] Check robots.txt: `https://scottishailessons.com/robots.txt`

- [ ] **Submit to Google Search Console**:
  - [ ] Submit sitemap: GSC → Sitemaps → Add `https://scottishailessons.com/sitemap.xml`
  - [ ] Request indexing for key pages:
    - [ ] Homepage
    - [ ] National 5 Maths page
    - [ ] National 4 Maths page
    - [ ] AI Maths Tutor page
  - [ ] Wait 24-48 hours for initial crawl

- [ ] **Performance Check**:
  - [ ] Run PageSpeed Insights on live site
  - [ ] Verify all Core Web Vitals in "Good" range
  - [ ] Fix any critical issues identified

---

## Week 2: Content Foundation & Blog Launch

### Day 8-10: SQA Curriculum & Accessibility Pages

- [ ] **SQA Curriculum Page** (`app/sqa/curriculum/page.tsx`):
  - [ ] Meta tags: "SQA Curriculum | Official Course Integration | Scottish AI Lessons"
  - [ ] H1: "Official SQA Curriculum Integration"
  - [ ] Explain SQA database integration
  - [ ] List supported courses with codes (C844 74, etc.)
  - [ ] Link to official SQA website
  - [ ] Word count: 1,500-1,800 words
  - [ ] Schema: FAQPage for "What is SQA curriculum?"

- [ ] **Accessibility Statement Page** (`app/accessibility/page.tsx`):
  - [ ] Meta tags: "Accessibility | WCAG Compliance | Scottish AI Lessons"
  - [ ] H1: "Accessibility Statement"
  - [ ] WCAG 2.1 AA compliance details
  - [ ] Plain language support (CEFR A2-B1)
  - [ ] Dyslexia-friendly features
  - [ ] Extra time accommodations
  - [ ] Contact for accessibility feedback
  - [ ] Word count: 1,000-1,200 words

### Day 11-14: First Blog Posts

- [ ] **Blog Post 1**: "Struggling with National 5 Maths? Here's How AI Can Help"
  - [ ] File: `app/blog/struggling-national-5-maths/page.tsx`
  - [ ] Meta tags: "Struggling with National 5 Maths? AI Tutor Can Help"
  - [ ] Word count: 1,500 words
  - [ ] Structure:
    - [ ] H2: Common Struggles (algebra, trigonometry, word problems)
    - [ ] H2: Why Traditional Methods Fall Short
    - [ ] H2: How AI Tutoring Solves This (adaptive hints, instant feedback)
    - [ ] H2: Real Student Success Story (with data)
    - [ ] H2: Get Started with AI Tutoring
  - [ ] Internal links: National 5 Maths page, AI Tutor page
  - [ ] CTA: "Try Free Diagnostic Assessment"
  - [ ] Schema: Article + FAQPage
  - [ ] Featured image (WebP, <200KB) with alt text
  - [ ] Publish date: Add to content

- [ ] **Blog Post 2**: "How Much Does Maths Tutoring Cost in Scotland? (AI Alternative)"
  - [ ] File: `app/blog/affordable-tutoring-scotland/page.tsx`
  - [ ] Meta tags: "Maths Tutoring Costs Scotland | Affordable AI Alternative"
  - [ ] Word count: 1,400 words
  - [ ] Structure:
    - [ ] H2: Average Private Tutor Costs (£25-50/hour)
    - [ ] H2: Hidden Costs of Traditional Tutoring (travel, scheduling)
    - [ ] H2: AI Tutoring Pricing Model (monthly subscription vs. hourly)
    - [ ] H2: Cost-Benefit Comparison Table
    - [ ] H2: When to Choose Each Option
  - [ ] Comparison table (HTML table, mobile-responsive)
  - [ ] Internal links: Pricing page, National 5 Maths
  - [ ] CTA: "See Pricing Plans"
  - [ ] Schema: Article

- [ ] **Update Sitemap**:
  - [ ] Add blog posts to `sitemap.ts`
  - [ ] Deploy updated sitemap
  - [ ] Submit to GSC

- [ ] **Internal Linking Update**:
  - [ ] Add "Latest Blog Posts" section to homepage
  - [ ] Link from National 5 Maths page to blog post 1
  - [ ] Link from pricing page (if exists) to blog post 2

### Week 2 Wrap-Up

- [ ] **Deploy all new pages**
- [ ] **Request indexing** for SQA, Accessibility, and 2 blog posts in GSC
- [ ] **Social sharing**:
  - [ ] Share blog posts on Twitter/X (if account exists)
  - [ ] Share on LinkedIn (if company page exists)
  - [ ] Post in relevant Reddit communities (r/ScottishEducation, r/GetStudying)
- [ ] **Analytics check**:
  - [ ] Review GA4: Any traffic yet?
  - [ ] GSC: Any pages indexed? Impressions?

---

## Week 3-4: Comparison Content & Outreach

### Day 15-18: Comparison Pages

- [ ] **Comparison Page 1**: "Scottish AI Lessons vs. BBC Bitesize"
  - [ ] File: `app/compare/vs-bbc-bitesize/page.tsx`
  - [ ] Meta tags: "Scottish AI Lessons vs BBC Bitesize | SQA Tutor Comparison"
  - [ ] Word count: 1,500-1,800 words
  - [ ] Comparison table (features, pricing, SQA alignment)
  - [ ] Objective tone: Highlight strengths of both
  - [ ] Use case recommendations: "Use Bitesize for quick reference, Scottish AI Lessons for adaptive practice"
  - [ ] Internal links: National 5 pages, features

- [ ] **Comparison Page 2**: "AI Tutor vs. Human Tutor: What's Best for National 5?"
  - [ ] File: `app/blog/ai-vs-human-tutor/page.tsx`
  - [ ] Meta tags: "AI Tutor vs Human Tutor | National 5 Comparison"
  - [ ] Word count: 1,800 words
  - [ ] Comparison table (cost, availability, personalization, expertise)
  - [ ] Scenarios: When to choose each
  - [ ] Hybrid approach: Using both together
  - [ ] Internal links: Pricing, National 5 Maths, blog post on costs

### Day 19-21: Blog Post 3

- [ ] **Blog Post 3**: "How to Pass National 5 Maths: Evidence-Based Study Strategies"
  - [ ] File: `app/blog/how-to-pass-national-5/page.tsx`
  - [ ] Meta tags: "How to Pass National 5 Maths | Study Strategies That Work"
  - [ ] Word count: 2,000 words
  - [ ] Structure:
    - [ ] H2: Understanding the National 5 Maths Exam
    - [ ] H2: Strategy 1: Spaced Repetition (with research citations)
    - [ ] H2: Strategy 2: Active Recall (practice testing)
    - [ ] H2: Strategy 3: Mastery Learning (don't move on until 80%+)
    - [ ] H2: Study Plan Template (timeline to exam)
    - [ ] H2: How Scottish AI Lessons Implements These Strategies
  - [ ] Downloadable study plan PDF (lead magnet)
  - [ ] Cite research: Spacing effect (Cepeda et al.), retrieval practice
  - [ ] Internal links: National 5 Maths, spaced repetition feature
  - [ ] CTA: "Start Your Personalized Study Plan"
  - [ ] Schema: Article + HowTo

### Day 22-28: Link Building Outreach (First Wave)

- [ ] **HARO (Help A Reporter Out)**:
  - [ ] Sign up: https://www.helpareporter.com/
  - [ ] Set alerts for: "education", "technology", "Scotland", "AI"
  - [ ] Respond to 5 relevant queries this week
  - [ ] Track responses in spreadsheet

- [ ] **Guest Post Outreach**:
  - [ ] Identify 10 target blogs (education, EdTech, Scottish sites)
  - [ ] Pitch topics:
    - [ ] "How AI is Transforming SQA Exam Prep" (for EdTech blogs)
    - [ ] "5 Ways AI Can Support Dyslexic Learners" (for accessibility blogs)
    - [ ] "Building an AI Tutor with LangGraph" (for tech blogs)
  - [ ] Send 5 pitches this week
  - [ ] Track in spreadsheet (site, contact, pitch sent, response)

- [ ] **Education Directory Listings**:
  - [ ] Submit to Edudemic: https://www.edudemic.com/
  - [ ] Submit to EdSurge Product Index: https://www.edsurge.com/
  - [ ] Submit to Scottish education directories (local)
  - [ ] Check for free listing opportunities on teacher resource sites

- [ ] **Community Engagement**:
  - [ ] Join r/ScottishEducation subreddit
  - [ ] Join r/GetStudying subreddit
  - [ ] Answer 3-5 questions related to National 5 Maths, tutoring
  - [ ] Provide value first, mention Scottish AI Lessons naturally if relevant

### Week 3-4 Wrap-Up

- [ ] **Deploy comparison pages and blog post 3**
- [ ] **Request indexing** for all new pages
- [ ] **Update sitemap** with new URLs
- [ ] **First backlink check**:
  - [ ] Use Ahrefs or Semrush to check for any new backlinks
  - [ ] Record in spreadsheet: Referring domain, DR/DA, link URL
- [ ] **GSC Analysis** (Week 4):
  - [ ] Check Coverage: How many pages indexed?
  - [ ] Check Performance: Any impressions or clicks yet?
  - [ ] Identify any crawl errors and fix

---

## Month 2: Content Expansion & Authority Building

### Week 5-6: Additional Course Pages & Blog Posts

- [ ] **National 5 Physics Page** (`app/national-5-physics/page.tsx`):
  - [ ] Meta tags: "National 5 Physics Tutor | SQA AI Revision"
  - [ ] Similar structure to Maths page (1,500-2,000 words)
  - [ ] Course schema with SQA Physics course code
  - [ ] Internal links to related pages

- [ ] **Blog Post 4**: "The Science of Spaced Repetition for National 5 Exam Prep"
  - [ ] File: `app/blog/spaced-repetition-learning/page.tsx`
  - [ ] Word count: 1,600 words
  - [ ] Cite research papers (PubMed, Google Scholar)
  - [ ] Explain algorithm (Ebbinghaus forgetting curve)
  - [ ] How Scottish AI Lessons implements it (EMA mastery tracking)
  - [ ] Schema: Article + FAQPage ("How does spaced repetition work?")

- [ ] **Blog Post 5**: "Understanding SQA Assessment Standards: A Complete Guide"
  - [ ] File: `app/blog/sqa-assessment-standards/page.tsx`
  - [ ] Word count: 2,200 words
  - [ ] Break down each assessment standard with examples
  - [ ] Link to official SQA documentation
  - [ ] Explain how students are evaluated
  - [ ] Internal links: SQA Curriculum page, course pages

### Week 7-8: Interactive Tools (Linkable Assets)

- [ ] **Free SQA Diagnostic Tool**:
  - [ ] Create landing page: `app/tools/diagnostic-assessment/page.tsx`
  - [ ] Build simple quiz (5-10 questions, National 5 Maths)
  - [ ] Provide instant results with lesson recommendations
  - [ ] Capture email for results (lead generation)
  - [ ] Schema: WebApplication or SoftwareApplication
  - [ ] Promote on homepage and social media

- [ ] **National 5 Maths Formula Sheet** (Downloadable PDF):
  - [ ] Design PDF with Scottish AI Lessons branding
  - [ ] Include all key formulas for National 5 Maths
  - [ ] Gated download (optional email capture)
  - [ ] Landing page: `app/resources/national-5-formula-sheet/page.tsx`
  - [ ] Shareable on Pinterest, Twitter, Reddit

- [ ] **Outreach for Tools**:
  - [ ] Email 10 teachers: "Free diagnostic tool for your students"
  - [ ] Post in teacher Facebook groups (if access)
  - [ ] Submit to teacher resource directories

### Month 2 Wrap-Up

- [ ] **Content published this month**:
  - [ ] 1 additional course page (Physics)
  - [ ] 2 blog posts (spaced repetition, SQA standards)
  - [ ] 2 linkable assets (diagnostic tool, formula sheet)
- [ ] **Outreach results**:
  - [ ] HARO responses: ___
  - [ ] Guest post acceptances: ___
  - [ ] Backlinks acquired: ___ (track in spreadsheet)
- [ ] **Analytics review**:
  - [ ] Organic impressions: ___
  - [ ] Organic clicks: ___
  - [ ] Top-performing page: ___
  - [ ] Average position for target keywords: ___
- [ ] **Technical health check**:
  - [ ] Run PageSpeed Insights: All pages >90 mobile score?
  - [ ] GSC Coverage: Any errors?
  - [ ] Broken links: Use tool to check (Screaming Frog or online checker)

---

## Month 3: Authority Building & Link Acquisition

### Week 9-10: Ultimate Guide (Pillar Content)

- [ ] **Ultimate Guide**: "The Complete Guide to National 5 Maths"
  - [ ] File: `app/guides/complete-national-5-maths-guide/page.tsx`
  - [ ] Word count: 3,000-5,000 words (comprehensive)
  - [ ] Structure:
    - [ ] Table of contents (jump links)
    - [ ] Introduction: What is National 5 Maths?
    - [ ] Unit 1: Expressions and Formulae (detailed breakdown)
    - [ ] Unit 2: Relationships (detailed breakdown)
    - [ ] Unit 3: Applications (detailed breakdown)
    - [ ] Exam structure and scoring
    - [ ] Study strategies
    - [ ] Common mistakes and how to avoid them
    - [ ] Recommended resources (including Scottish AI Lessons)
  - [ ] Downloadable PDF version
  - [ ] Internal links to all relevant pages (course page, blog posts)
  - [ ] Schema: Article or Guide
  - [ ] Promote heavily: Social media, email outreach to teachers

- [ ] **Blog Post 6**: "Dyslexia Support in Scottish Maths Education"
  - [ ] File: `app/blog/dyslexia-maths-support/page.tsx`
  - [ ] Word count: 1,400 words
  - [ ] Research dyslexia statistics in Scotland
  - [ ] Explain accessibility features (plain language, extra time)
  - [ ] Interview or quote from dyslexia organization (Dyslexia Scotland)
  - [ ] Internal links: Accessibility page, features
  - [ ] Outreach: Contact Dyslexia Scotland for potential partnership/link

### Week 11-12: Press & PR

- [ ] **Press Release**: "Scottish AI Lessons Launches AI-Powered Tutoring for SQA Students"
  - [ ] Write 400-500 word press release
  - [ ] Distribute to:
    - [ ] The Herald Scotland education desk
    - [ ] The Scotsman education section
    - [ ] BBC Scotland education
    - [ ] Education Scotland media contacts
    - [ ] Local newspapers (Glasgow Times, Edinburgh Evening News)
  - [ ] Track: Any pickups? Backlinks?

- [ ] **School Partnership Outreach**:
  - [ ] Identify 10 Scottish secondary schools
  - [ ] Pitch pilot program: "Free access for 20 students for 3 months"
  - [ ] Offer: Testimonials + case study + backlink from school website
  - [ ] Track responses in spreadsheet

- [ ] **Interactive Tool 2**: Study Planner Calculator
  - [ ] Create: `app/tools/study-planner/page.tsx`
  - [ ] Input: Exam date, current mastery level
  - [ ] Output: Personalized spaced repetition schedule
  - [ ] Shareable results (social sharing buttons)
  - [ ] Promote: Reddit, Twitter, teacher groups

### Month 3 Wrap-Up

- [ ] **Content published**:
  - [ ] 1 ultimate guide (3,000+ words)
  - [ ] 1 blog post (dyslexia support)
  - [ ] 1 interactive tool (study planner)
  - [ ] 1 press release distributed
- [ ] **Link building**:
  - [ ] Total backlinks: ___ (Ahrefs/Semrush)
  - [ ] Referring domains: ___
  - [ ] Highest DR backlink: ___
- [ ] **Rankings**:
  - [ ] Top 3 keyword positions: ___ (list keywords)
  - [ ] Top 10 keyword positions: ___ (list keywords)
  - [ ] Top 20 keyword positions: ___ (list keywords)
- [ ] **Traffic**:
  - [ ] Organic sessions: ___
  - [ ] Sign-ups from organic: ___
  - [ ] Top landing page: ___

---

## Month 4-6: Scaling & Optimization

### Ongoing Activities (Weekly)

- [ ] **Content Publishing Schedule**:
  - [ ] **Every Tuesday**: Publish 1 blog post (1,200-1,800 words)
  - [ ] **Every Thursday**: Update existing content or publish case study
  - [ ] Topics to cover:
    - [ ] Topic breakdowns (e.g., "Mastering Trigonometry for National 5")
    - [ ] Exam tips ("National 5 Maths Exam Day Tips")
    - [ ] Student success stories
    - [ ] Feature tutorials ("How to Use Interactive Diagrams")

- [ ] **Link Building Outreach** (Weekly):
  - [ ] 5 HARO responses per week
  - [ ] 2-3 guest post pitches per week
  - [ ] 1 partnership outreach per week (schools, organizations)
  - [ ] Engage in 5 Reddit/Quora discussions (provide value, natural mentions)

- [ ] **SEO Monitoring** (Weekly):
  - [ ] Check GSC Performance: Top queries, impressions, clicks, CTR
  - [ ] Track keyword rankings (use Ahrefs, Semrush, or GSC)
  - [ ] Identify pages with high impressions but low CTR → optimize meta descriptions
  - [ ] Identify keywords ranking #11-20 → create targeted content or build links

- [ ] **A/B Testing** (Bi-Weekly):
  - [ ] Test title tags: Emotional vs. factual
  - [ ] Test meta descriptions: Different CTAs
  - [ ] Test CTA button text: "Start Free Trial" vs. "Try AI Tutor Free"
  - [ ] Track results in GA4

### Month 4-6 Focus Areas

- [ ] **Content Depth**:
  - [ ] Expand top-performing pages to 3,000+ words
  - [ ] Add video content (explainer videos, student testimonials)
  - [ ] Create infographics for shareable content

- [ ] **Technical SEO**:
  - [ ] Maintain <2.5s LCP on all pages
  - [ ] Ensure >95 PageSpeed score (desktop), >90 (mobile)
  - [ ] Fix any broken links or 404 errors
  - [ ] Update sitemap as new content published

- [ ] **Link Velocity**:
  - [ ] Target: 5-10 backlinks per month
  - [ ] Quality over quantity: Prioritize DR 30+ domains
  - [ ] Diversify link sources: Education, news, tech blogs

- [ ] **Conversion Optimization**:
  - [ ] Analyze funnel: Homepage → Course Page → Sign-Up
  - [ ] Identify drop-off points
  - [ ] A/B test sign-up form (# of fields, copy, design)
  - [ ] Add exit-intent popups (if not too intrusive)

---

## Month 7-12: Scaling to Page 1

### Quarterly Goals (Months 7-9, 10-12)

- [ ] **Content Goals**:
  - [ ] 50+ blog posts published (total)
  - [ ] 10+ ultimate guides/pillar pages
  - [ ] 5+ interactive tools/calculators
  - [ ] 20+ case studies or student testimonials

- [ ] **Link Building Goals**:
  - [ ] 40+ total backlinks
  - [ ] 20+ referring domains (DR 30+)
  - [ ] 3+ links from DR 50+ domains (major publications)
  - [ ] Featured in 1-2 major Scottish education news outlets

- [ ] **Ranking Goals**:
  - [ ] Top 3 for 10+ long-tail keywords
  - [ ] Top 10 for 15+ medium-competition keywords
  - [ ] Top 20 for 5+ high-competition keywords (e.g., "ai maths tutor")
  - [ ] 10+ featured snippets acquired

- [ ] **Traffic Goals**:
  - [ ] 20,000+ organic impressions/month
  - [ ] 1,000+ organic clicks/month
  - [ ] 100+ sign-ups from organic search/month
  - [ ] 4-6% average CTR from search results

### Advanced Strategies (Months 10-12)

- [ ] **Topic Clustering**:
  - [ ] Identify 5 topic clusters (e.g., "National 5 Maths", "AI Tutoring", "SQA Exam Prep")
  - [ ] Create pillar pages for each cluster
  - [ ] Build 10+ supporting articles per cluster
  - [ ] Strong internal linking between cluster pages

- [ ] **Video SEO**:
  - [ ] Create YouTube channel: "Scottish AI Lessons"
  - [ ] Publish 1-2 videos per week (lessons, tips, platform tours)
  - [ ] Optimize video titles, descriptions (include target keywords)
  - [ ] Embed videos on relevant blog posts and course pages
  - [ ] Video schema markup

- [ ] **Local SEO Expansion** (If Relevant):
  - [ ] Create city-specific landing pages (Glasgow, Edinburgh, Aberdeen)
  - [ ] Target "ai tutor [city]" keywords
  - [ ] Partner with local schools for case studies and backlinks

- [ ] **E-E-A-T Enhancement**:
  - [ ] Publish research report: "State of Scottish Secondary Education 2025"
  - [ ] Get quoted in major publications (via HARO, PR)
  - [ ] Build author profiles with credentials
  - [ ] Acquire .edu or .gov backlinks (if possible via partnerships)

---

## Ongoing Maintenance & Iteration

### Monthly SEO Review Checklist

- [ ] **Performance Analysis** (Google Analytics 4):
  - [ ] Organic sessions this month: ___
  - [ ] Organic conversions: ___
  - [ ] Top landing pages: ___
  - [ ] Bounce rate by page: ___
  - [ ] Goal: Identify underperforming pages and optimize

- [ ] **Keyword Tracking** (Google Search Console / Ahrefs):
  - [ ] Track top 20 target keywords
  - [ ] Note position changes: Improved ____, Declined ____
  - [ ] Identify new keyword opportunities (high impressions, low clicks)
  - [ ] Goal: Focus efforts on keywords close to page 1 (#11-20)

- [ ] **Content Audit**:
  - [ ] Review pages with <100 views/month: Worth updating or removing?
  - [ ] Update statistics, examples, and dates on key pages
  - [ ] Add internal links to new content from older posts
  - [ ] Goal: Keep content fresh and relevant

- [ ] **Technical Health Check**:
  - [ ] Run Screaming Frog crawl (or similar tool)
  - [ ] Check for broken links, 404 errors
  - [ ] Review GSC Coverage: Any indexing issues?
  - [ ] PageSpeed Insights: Any pages below 90 score?
  - [ ] Goal: Maintain technical excellence

- [ ] **Backlink Analysis**:
  - [ ] New backlinks this month: ___
  - [ ] Lost backlinks: ___
  - [ ] Check for spammy backlinks (disavow if necessary)
  - [ ] Competitor backlink gap analysis: What links do they have that we don't?
  - [ ] Goal: Continue acquiring high-quality backlinks

- [ ] **SERP Features**:
  - [ ] Featured snippets won this month: ___
  - [ ] People Also Ask appearances: ___
  - [ ] Image pack appearances: ___
  - [ ] Goal: Optimize content for SERP features (FAQ schema, lists, tables)

---

## Tools & Resources

### Essential SEO Tools

**Free Tools**:
- [ ] Google Search Console (indexing, performance)
- [ ] Google Analytics 4 (traffic, conversions)
- [ ] Google PageSpeed Insights (performance)
- [ ] Microsoft Clarity (heatmaps, session replay)
- [ ] Ubersuggest (basic keyword research, free tier)
- [ ] AnswerThePublic (question-based keywords)

**Paid Tools** (Optional but Recommended):
- [ ] Ahrefs ($99/mo) - Keyword research, backlink tracking, competitor analysis
- [ ] Semrush ($129/mo) - All-in-one SEO platform
- [ ] Screaming Frog SEO Spider (Free up to 500 URLs, £149/year for unlimited)

### Content Creation Resources

- [ ] Grammarly (writing quality)
- [ ] Hemingway Editor (readability)
- [ ] Canva (graphics for blog posts)
- [ ] TinyPNG / Squoosh (image compression)
- [ ] Schema Markup Generator (https://technicalseo.com/tools/schema-markup-generator/)

### Outreach & Link Building

- [ ] HARO (Help A Reporter Out) - https://www.helpareporter.com/
- [ ] Hunter.io (find email addresses for outreach)
- [ ] Mailshake or Lemlist (email outreach campaigns)
- [ ] BuzzSumo (find popular content in your niche)

---

## Success Metrics Summary

### Month 3 Targets
- **Pages Indexed**: 15-20
- **Organic Impressions**: 1,000-2,000/month
- **Organic Clicks**: 50-100/month
- **Backlinks**: 3-5 (DR 30+)
- **Top 20 Rankings**: 5-10 keywords

### Month 6 Targets
- **Pages Indexed**: 40-50
- **Organic Impressions**: 5,000-10,000/month
- **Organic Clicks**: 250-500/month
- **Backlinks**: 10-15 (DR 30+)
- **Top 10 Rankings**: 5-10 keywords
- **Featured Snippets**: 1-3

### Month 12 Targets
- **Pages Indexed**: 100+
- **Organic Impressions**: 20,000-40,000/month
- **Organic Clicks**: 1,000-2,000/month
- **Backlinks**: 40+ (DR 30+)
- **Top 3 Rankings**: 10+ keywords
- **Top 10 Rankings**: 20+ keywords
- **Featured Snippets**: 10+
- **Organic Sign-Ups**: 100+/month

---

## Troubleshooting Common Issues

### Issue: Pages Not Getting Indexed

**Possible Causes**:
- [ ] Sitemap not submitted to GSC
- [ ] Robots.txt blocking crawlers
- [ ] Low-quality or duplicate content
- [ ] No internal links pointing to page

**Solutions**:
- [ ] Manually request indexing in GSC URL Inspection tool
- [ ] Check robots.txt: Ensure page not disallowed
- [ ] Improve content quality (add 500+ words, unique insights)
- [ ] Add internal links from homepage and related pages

### Issue: High Impressions, Low Clicks (Low CTR)

**Possible Causes**:
- [ ] Unappealing title tag or meta description
- [ ] Ranking for wrong intent keywords
- [ ] Competitors have better SERP features (featured snippets)

**Solutions**:
- [ ] A/B test title tags with emotional hooks or numbers
- [ ] Rewrite meta descriptions with clear CTA and benefits
- [ ] Optimize for featured snippets (use FAQ schema, numbered lists)

### Issue: Rankings Dropping

**Possible Causes**:
- [ ] Google algorithm update
- [ ] Competitor improved their content
- [ ] Technical issues (slow site, broken links)
- [ ] Lost backlinks

**Solutions**:
- [ ] Check Google Search Central blog for recent updates
- [ ] Analyze competitor pages: What changed? More content? Better UX?
- [ ] Run technical SEO audit (Screaming Frog)
- [ ] Build new backlinks to affected pages

### Issue: Slow Core Web Vitals

**Possible Causes**:
- [ ] Large unoptimized images
- [ ] Heavy JavaScript bundles
- [ ] Slow server response time

**Solutions**:
- [ ] Convert all images to WebP, compress to <200KB
- [ ] Use Next.js Image component with lazy loading
- [ ] Code split large components (dynamic imports)
- [ ] Upgrade hosting or use Vercel Edge Network

---

## Final Notes

- **SEO is a Marathon, Not a Sprint**: Results take 3-6 months to materialize. Stay consistent.
- **Quality Over Quantity**: 1 excellent 2,000-word guide > 10 mediocre 300-word posts.
- **User Experience Matters**: Fast, accessible, well-designed site = higher rankings.
- **Adapt to Data**: Review GSC weekly, adjust strategy based on what's working.
- **Don't Neglect LLM SEO**: As AI search grows, optimize for ChatGPT, Claude, Perplexity citations.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-11
**Owner**: ScottishAILessons Team

**Related Documents**:
- `BRANDING_GUIDE.md` - Brand identity framework
- `KEYWORD_RESEARCH.md` - Full keyword list (50 keywords)
- `SEO_STRATEGY.md` - Comprehensive SEO strategy

**Good luck with your SEO journey! 🚀**
