# SVG Icons Guide

This guide explains how to add SVG icons to replace the empty icon placeholders throughout the application.

## Overview

All emojis and icons have been removed from the application. Empty containers with class names are left in place where icons should be added. You can add your own SVG icons to these locations.

## Icon Locations

### 1. Header Buttons (`index.html`)

Buttons in the header have comments indicating where to add SVG icons:

```html
<!-- Add SVG icon before "Add Place" text: <svg class="btn-icon">...</svg> -->
<button id="add-poi-btn" class="btn btn-primary">Add Place</button>
```

**Recommended approach:**
```html
<button id="add-poi-btn" class="btn btn-primary">
  <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <!-- Your SVG path here -->
  </svg>
  Add Place
</button>
```

### 2. Rating Stars

Rating stars are in multiple locations:
- POI form rating input (`.rating-input .star`)
- Review form rating input (`.review-star`)
- Review display (`.review-rating`)
- Timeline display (`.timeline-rating`)

**Current state:** Empty `<span>` elements with classes `.star` or `.review-star`

**Recommended approach:**
Replace the empty spans with SVG icons. You can use a star SVG like:

```html
<span class="star" data-rating="1">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
</span>
```

For active stars, add the `.active` class and change the fill color in CSS.

### 3. Analytics Dashboard Icons

In `src/app/analytics-ui.ts`, stat cards have empty icon containers:

```html
<div class="stat-icon"></div>
```

**Recommended approach:**
Add SVG icons directly in the template strings:

```typescript
<div class="stat-icon">
  <svg width="24" height="24" viewBox="0 0 24 24">
    <!-- Your icon SVG path -->
  </svg>
</div>
```

### 4. Theme Toggle Icon

In `src/app/app-controller.ts`, the theme toggle icon is handled. Replace the empty textContent with SVG:

```typescript
private updateThemeIcons(theme: string): void {
  const icons = document.querySelectorAll('.theme-icon');
  icons.forEach(icon => {
    icon.innerHTML = theme === 'dark' 
      ? '<svg>...</svg>' // Sun icon for dark theme
      : '<svg>...</svg>'; // Moon icon for light theme
  });
}
```

### 5. Notification Messages

Notification messages no longer contain emojis. If you want to add icons to notifications, modify the `showNotification` method in `src/app/ui.ts` to include SVG icons.

## CSS Styling

Add CSS to style your SVG icons:

```css
.btn-icon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  vertical-align: middle;
}

.star svg {
  width: 20px;
  height: 20px;
  fill: #ccc;
  transition: fill 0.2s;
}

.star.active svg {
  fill: #f39c12;
}

.stat-icon svg {
  width: 32px;
  height: 32px;
  fill: currentColor;
}
```

## Icon Libraries

You can use icon libraries like:
- **Heroicons** (https://heroicons.com/)
- **Feather Icons** (https://feathericons.com/)
- **Lucide** (https://lucide.dev/)
- **Material Icons** (https://fonts.google.com/icons)

Or create your own custom SVG icons.

## Best Practices

1. **Consistency**: Use the same icon style throughout the application
2. **Accessibility**: Add `aria-label` attributes to icon-only buttons
3. **Size**: Keep icons appropriately sized (16-24px for buttons, 20px for stars)
4. **Colors**: Use `currentColor` in SVG fill/stroke to inherit text color
5. **Performance**: Inline SVG is preferred over external files for small icons

## Example: Complete Button with Icon

```html
<button id="add-poi-btn" class="btn btn-primary">
  <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
  <span>Add Place</span>
</button>
```

## Rating Stars Example

```html
<div class="rating-input">
  <span class="star" data-rating="1">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  </span>
  <!-- Repeat for 5 stars -->
</div>
```

With CSS:
```css
.rating-input .star svg {
  fill: #ddd;
  transition: fill 0.2s;
}

.rating-input .star.active svg {
  fill: #f39c12;
}
```

