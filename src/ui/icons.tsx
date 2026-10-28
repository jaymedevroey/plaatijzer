import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 22, ...p }: P) {
  return {
    width: size, height: size, viewBox: '0 0 22 22', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
  }
}

export const IconGrid = (p: P) => (<svg {...base(p)}><rect x="3.5" y="4.5" width="15" height="14" rx="3" /><path d="M3.5 9h15M7.5 2.5v4M14.5 2.5v4" /><path d="M8 13.5l2 2 4-4" /></svg>)
export const IconChart = (p: P) => (<svg {...base(p)}><path d="M3.5 3.5v15h15" /><path d="M7 14l3.5-4 3 2.5L18 7" /></svg>)
export const IconCoach = (p: P) => (<svg {...base(p)}><path d="M4 5.5A2 2 0 0 1 6 3.5h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 4z" /></svg>)
export const IconMore = (p: P) => (<svg {...base(p)}><circle cx="5" cy="11" r="1.4" fill="currentColor" /><circle cx="11" cy="11" r="1.4" fill="currentColor" /><circle cx="17" cy="11" r="1.4" fill="currentColor" /></svg>)
export const IconPlus = (p: P) => (<svg {...base(p)} strokeWidth={2.4}><path d="M11 4v14M4 11h14" /></svg>)
export const IconBack = (p: P) => (<svg {...base(p)} strokeWidth={2}><path d="M13 5l-6 6 6 6" /></svg>)
export const IconDown = (p: P) => (<svg {...base(p)} strokeWidth={2}><path d="M5 8l6 6 6-6" /></svg>)
export const IconRight = (p: P) => (<svg {...base(p)} strokeWidth={2.2}><path d="M4 11h14M12 5l6 6-6 6" /></svg>)
export const IconCheck = (p: P) => (<svg {...base(p)} strokeWidth={2.6}><path d="M5 11.5l4 4L17 6.5" /></svg>)
export const IconClose = (p: P) => (<svg {...base(p)} strokeWidth={2}><path d="M6 6l10 10M16 6L6 16" /></svg>)
export const IconUp = (p: P) => (<svg {...base(p)} strokeWidth={2}><path d="M11 18V4M5 10l6-6 6 6" /></svg>)
export const IconSun = (p: P) => (<svg {...base(p)}><circle cx="11" cy="11" r="4" /><path d="M11 2v2M11 18v2M2 11h2M18 11h2" /></svg>)
export const IconTrash = (p: P) => (<svg {...base(p)}><path d="M4 6h14M9 6V4h4v2M6 6l1 12h8l1-12" /></svg>)
export const IconBackspace = (p: P) => (<svg {...base(p)} viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7z" /><path d="M12.5 9.5l5 5M17.5 9.5l-5 5" /></svg>)
export const IconSync = (p: P) => (<svg {...base(p)}><path d="M18 9a7 7 0 0 0-12.5-2M4 13a7 7 0 0 0 12.5 2" /><path d="M5 3v4h4M17 19v-4h-4" /></svg>)
export const IconDumbbell = (p: P) => (<svg {...base(p)}><path d="M3 11h16M6 7v8M16 7v8M3 9v4M19 9v4" /></svg>)
export const IconVolleyball = (p: P) => (<svg {...base(p)}><circle cx="11" cy="11" r="8" /><path d="M11 11c0-3.4 1.5-6 4.3-7.2M11 11c-2.9 1.7-5.9 1.8-7.9.4M11 11c2.7 1.8 3.9 4.5 3.6 7.6" /></svg>)
export const IconDots = IconMore
export const IconChevron = (p: P) => (<svg {...base(p)} strokeWidth={2}><path d="M8 4l7 7-7 7" /></svg>)
