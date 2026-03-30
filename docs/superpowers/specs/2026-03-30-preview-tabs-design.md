# Preview Modal Tabs UI Redesign

## Overview
Revamp the format tabs in the ImagePreview modal to be fluid, detailed, and modern, matching the app's existing design system.

## Current State
Simple button-style tabs with basic active state styling.

## Target Design

### Layout
- Horizontal tab bar with sliding pill indicator
- Tabs positioned below header, above split-view
- Padding: px-4 py-3
- Background: subtle glassmorphism (bg-muted/30)

### Tab Structure (per tab)
```
[ WEBP · 24.5 KB · -38% ]
```
- Format name: bold, uppercase, tracking-wider
- Separator: centered dot (·)
- File size: regular weight
- Savings badge: inline pill with percentage

### Visual Design

**Inactive Tabs:**
- Text: text-muted-foreground
- Background: transparent
- Hover: bg-muted/50, slight scale (scale-[1.02])

**Active Tab (Sliding Pill):**
- Background: primary color with subtle shadow
- Text: text-primary-foreground (white)
- Border-radius: rounded-xl (matching app)
- Padding: px-4 py-2
- Shadow: shadow-lg shadow-primary/25

**Savings Badge:**
- Inactive: bg-success/15 text-success
- Active: bg-white/20 text-white

### Animations
- Pill slide: 300ms cubic-bezier(0.4, 0, 0.2, 1)
- Hover scale: 150ms ease-out
- Text color transition: 200ms ease-out

### Edge Cases
- Single format: hide tabs entirely
- Long filenames: truncate with ellipsis in header
- Loading state: show shimmer on tabs

## Implementation Notes
- Use CSS transform for pill position (better performance)
- Memoize format calculations
- Maintain keyboard accessibility
- Support format change via onFormatChange callback