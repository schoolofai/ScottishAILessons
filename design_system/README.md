# Scottish AI Lessons Design System

A cohesive, gamified design system for educational interfaces, derived from the practice-wizard component patterns and optimized for learning experiences.

## Philosophy

This design system embraces a **Duolingo-inspired gamified aesthetic** that makes learning feel engaging and rewarding while maintaining clarity and accessibility for educational content.

### Core Principles

1. **Clarity First**: Educational content must be readable and scannable
2. **Gamified Feedback**: Success, progress, and errors should feel meaningful
3. **Consistent Hierarchy**: Visual weight guides attention to important elements
4. **Responsive by Default**: All components work seamlessly across devices
5. **Accessible**: WCAG 2.1 AA compliant with proper ARIA attributes

---

## Quick Start

### Import Design Tokens

```css
/* In your global CSS file */
@import '@/design_system/tokens/colors.css';
@import '@/design_system/tokens/typography.css';
@import '@/design_system/tokens/spacing.css';
@import '@/design_system/tokens/animations.css';
```

### Use in Tailwind

The design tokens are available as CSS custom properties and can be used directly in Tailwind classes:

```tsx
<div className="bg-[var(--wizard-bg)] text-[var(--wizard-text)]">
  <h1 className="font-[var(--font-display)] text-[var(--text-2xl)]">
    Welcome
  </h1>
</div>
```

Or extend `tailwind.config.ts` to use the tokens:

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        wizard: {
          green: 'var(--wizard-green)',
          blue: 'var(--wizard-blue)',
          gold: 'var(--wizard-gold)',
          red: 'var(--wizard-red)',
        },
      },
    },
  },
};
```

---

## Design Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--wizard-green` | `#58CC02` | Primary success, correct answers, CTA buttons |
| `--wizard-green-dark` | `#46A302` | Pressed/hover states for green |
| `--wizard-blue` | `#1CB0F6` | Active/current state, information |
| `--wizard-gold` | `#FFC800` | Rewards, achievements, XP |
| `--wizard-red` | `#FF4B4B` | Errors, incorrect answers |

#### SQA Level Colors

| Token | Value | Level |
|-------|-------|-------|
| `--level-n3` | `#22C55E` | National 3 (Green) |
| `--level-n4` | `#3B82F6` | National 4 (Blue) |
| `--level-n5` | `#8B5CF6` | National 5 (Purple) |
| `--level-higher` | `#F97316` | Higher (Orange) |
| `--level-adv-higher` | `#EF4444` | Advanced Higher (Red) |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-display` | `'Fredoka', sans-serif` | Headings, playful elements |
| `--font-body` | `'Nunito', sans-serif` | Body text, readable content |
| `--font-mono` | `'Geist Mono', monospace` | Code, technical content |

### Animations

| Animation | Duration | Usage |
|-----------|----------|-------|
| `wizard-fade-in` | 300ms | Content appearing |
| `wizard-slide-left` | 400ms | Panel/drawer entry |
| `wizard-pop` | 400ms | Rewards, celebrations |
| `wizard-pulse` | 2s loop | Loading, attention |

---

## Component Patterns

### Split Panel Layout

Used for content with navigation sidebar (e.g., past-papers viewer).

```
┌─────────────────────────────────────────────┐
│  {header}                                   │
├──────────────┬──────────────────────────────┤
│  {sidebar}   │  {content}                   │
│              │                              │
│  resizable ──┤                              │
│              │                              │
└──────────────┴──────────────────────────────┘
```

```tsx
import { SplitPanelLayout } from '@/components/ui/split-panel-layout';

<SplitPanelLayout
  header={<PaperHeader />}
  sidebar={<QuestionsSidebar />}
  content={<WalkthroughContent />}
  sidebarWidth={280}
  resizable={true}
  mobileDrawer={true}
/>
```

### Sidebar Navigation

Pattern for scrollable navigation lists with sticky header/footer.

```tsx
<nav className="h-full flex flex-col">
  {/* Sticky Header */}
  <div className="sticky top-0 bg-white/80 backdrop-blur-sm p-4 border-b">
    <h2 className="font-display font-semibold">Navigation</h2>
  </div>

  {/* Scrollable List */}
  <ul className="flex-1 overflow-y-auto p-2 space-y-1">
    {items.map(item => (
      <NavItem key={item.id} {...item} />
    ))}
  </ul>

  {/* Sticky Footer */}
  <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm p-4 border-t">
    <ProgressSummary />
  </div>
</nav>
```

### Content Cards

Themed cards for different content types.

| Theme | Background | Border | Usage |
|-------|------------|--------|-------|
| Blue | `bg-blue-50` | `border-blue-200` | Information, questions |
| Green | `bg-green-50` | `border-green-200` | Success, solutions |
| Red | `bg-red-50` | `border-red-200` | Errors, warnings |
| Amber | `bg-amber-50` | `border-amber-200` | Tips, notes |
| Purple | `bg-purple-50` | `border-purple-200` | Diagrams, visuals |

---

## Responsive Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Mobile | < 640px | Single column, drawer navigation |
| Tablet | 640px - 1024px | Collapsible sidebar |
| Desktop | > 1024px | Full split-panel layout |

```tsx
// Using useMediaQuery hook
const isMobile = useMediaQuery('(max-width: 640px)');
const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1024px)');
const isDesktop = useMediaQuery('(min-width: 1024px)');
```

---

## Accessibility Guidelines

### Keyboard Navigation

- All interactive elements must be focusable with Tab
- Arrow keys for navigation within lists
- Enter/Space for activation
- Escape to close modals/drawers

### ARIA Attributes

```tsx
// Navigation list
<nav aria-label="Question navigation">
  <ul role="list">
    <li role="listitem">
      <button
        aria-current={isSelected ? 'page' : undefined}
        aria-label={`Question ${number}, ${marks} marks`}
      >
        ...
      </button>
    </li>
  </ul>
</nav>

// Live regions for updates
<div role="status" aria-live="polite">
  {loadingMessage}
</div>
```

### Color Contrast

All text meets WCAG AA requirements:
- Normal text: 4.5:1 contrast ratio
- Large text: 3:1 contrast ratio
- Interactive elements: visible focus indicators

---

## File Structure

```
/design_system/
├── README.md                    # This file
├── tokens/
│   ├── colors.css              # Color CSS custom properties
│   ├── typography.css          # Font families, sizes, weights
│   ├── spacing.css             # Spacing scale & layout tokens
│   └── animations.css          # Keyframe animations & timing
├── components/
│   ├── split-panel-layout.md   # Split panel documentation
│   ├── sidebar-navigation.md   # Sidebar patterns
│   ├── content-cards.md        # Card component patterns
│   ├── buttons.md              # Button variants
│   └── badges.md               # Badge/pill patterns
└── patterns/
    ├── loading-states.md       # Skeleton & loading patterns
    ├── error-states.md         # Error handling UI
    └── responsive.md           # Responsive breakpoints & behavior
```

---

## Usage in Routes

### Past Papers (`/past-papers/...`)

Uses `SplitPanelLayout` with:
- `QuestionsSidebar` for navigation
- `WalkthroughContent` for display
- Level-based color coding

### Practice Wizard (`/practice_wizard/...`)

Uses full design system with:
- `JourneyTimeline` sidebar
- `BlockReferencePanel` reference drawer
- Gamified progress indicators

---

## Contributing

When adding new components or patterns:

1. Document the component in `/design_system/components/`
2. Use existing design tokens
3. Ensure responsive behavior
4. Add accessibility attributes
5. Include usage examples
