import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
)
export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />
  </svg>
)
export const IconPlan = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3.5 4.5h17v15h-17zM3.5 11h7v8.5M10.5 4.5V8M14 11h6.5M14 11v3" />
  </svg>
)
export const IconPano = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="12" rx="9" ry="3.6" />
    <path d="M12 3v18M3 12c0 5 4 9 9 9s9-4 9-9-4-9-9-9-9 4-9 9Z" opacity=".55" />
  </svg>
)
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
  </svg>
)
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10.5v6M12 7.4v.2" />
  </svg>
)
export const IconRuler = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 16.5 16.5 3l4.5 4.5L7.5 21z M7 12.5l2 2M10 9.5l2 2M13 6.5l2 2" />
  </svg>
)
export const IconArrow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </svg>
)
export const IconBulb = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 18h6M10 21h4M8.5 14.5a6 6 0 1 1 7 0c-.8.6-1.5 1.6-1.5 2.5h-4c0-.9-.7-1.9-1.5-2.5Z" />
  </svg>
)
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="15.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
)
export const IconGauge = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 17a8 8 0 1 1 16 0M12 17l4-6" />
  </svg>
)
export const IconDrag = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
  </svg>
)
export const IconZoom = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 21 21M8 10.5h5M10.5 8v5" />
  </svg>
)
