/** Small hand-drawn style SVG icon set (no emoji). Decorative icons are aria-hidden. */
import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({ width: 24, height: 24, viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false, ...p });

export const Paw = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="16" rx="5" ry="4.2" fill="currentColor" />
    <circle cx="6" cy="10" r="2.2" fill="currentColor" />
    <circle cx="10" cy="6.5" r="2.2" fill="currentColor" />
    <circle cx="14" cy="6.5" r="2.2" fill="currentColor" />
    <circle cx="18" cy="10" r="2.2" fill="currentColor" />
  </svg>
);
export const Cheese = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 17 L21 17 L21 9 L3 13 Z" fill="#f5c542" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <circle cx="9" cy="14.5" r="1.3" fill="#d99a12" />
    <circle cx="16" cy="12.5" r="1.6" fill="#d99a12" />
  </svg>
);
export const Trap = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="12" width="16" height="6" rx="1" fill="#d89b5f" stroke="currentColor" strokeWidth="1.8" />
    <path d="M6 12 Q12 4 18 12" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);
export const Banana = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 15 Q12 22 20 8 Q14 14 6 12 Z" fill="#f5d142" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);
export const Bolt = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M13 2 L5 13 H11 L10 22 L19 10 H13 Z" fill="#f5b92e" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);
export const Laugh = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" fill="#fde9a9" stroke="currentColor" strokeWidth="1.8" />
    <path d="M7 10 Q8.5 8 10 10 M14 10 Q15.5 8 17 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M7 13 Q12 20 17 13 Z" fill="currentColor" />
  </svg>
);
export const Clock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="13" r="8" fill="#fff6dc" stroke="currentColor" strokeWidth="2" />
    <path d="M12 13 V8 M12 13 L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="5" cy="5" r="2.5" fill="currentColor" />
    <circle cx="19" cy="5" r="2.5" fill="currentColor" />
  </svg>
);
export const Check = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 12 L10 18 L20 6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const Cross = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
export const Star = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 2 L14.8 8.6 L22 9.3 L16.5 14 L18.2 21 L12 17.3 L5.8 21 L7.5 14 L2 9.3 L9.2 8.6 Z" fill="currentColor" />
  </svg>
);
export const Pause = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
    <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
  </svg>
);
export const Eye = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2 12 Q12 3 22 12 Q12 21 2 12 Z" fill="#fff6dc" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3.5" fill="currentColor" />
  </svg>
);
export const Arrow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const Sandwich = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 10 L12 4 L21 10 Z" fill="#e9c27a" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <rect x="3" y="10" width="18" height="3" fill="#76b94e" stroke="currentColor" strokeWidth="1.6" />
    <rect x="3" y="13" width="18" height="4" rx="1" fill="#e9c27a" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

export const ITEM_ICONS: Record<string, (p: SVGProps<SVGSVGElement>) => JSX.Element> = {
  cheese: Cheese,
  sandwich: Sandwich,
  mousetrap: Trap,
  bananaPeel: Banana,
};
