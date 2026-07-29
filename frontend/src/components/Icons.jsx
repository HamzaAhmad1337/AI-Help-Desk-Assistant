const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconChat({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M4 12a8 8 0 1 1 3.2 6.4L4 20l1.1-4.3A8 8 0 0 1 4 12Z" />
    </svg>
  );
}

export function IconClose({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function IconSend({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" {...base} aria-hidden="true">
      <path d="M2.5 10 17.5 3 12 17.5 9.5 11.5 2.5 10Z" />
      <path d="m9.5 11.5 8-8.5" />
    </svg>
  );
}

export function IconRefresh({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" {...base} aria-hidden="true">
      <path d="M17 10a7 7 0 1 1-2.05-4.95" />
      <path d="M17 3v4h-4" />
    </svg>
  );
}

export function IconCopy({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" {...base} aria-hidden="true">
      <rect x="7" y="7" width="9" height="9" rx="2" />
      <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function IconCheck({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" {...base} aria-hidden="true">
      <path d="m4 10.5 4 4 8-9" />
    </svg>
  );
}

export function IconThumbUp({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" {...base} aria-hidden="true">
      <path d="M6 17V8.5l3.5-5.5c1 0 1.8.8 1.8 1.8V8h3.9c1 0 1.8.9 1.6 1.9l-1 5.6c-.1.9-.9 1.5-1.8 1.5H6Z" />
      <path d="M6 17H3.8V8.5H6" />
    </svg>
  );
}

export function IconThumbDown({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" {...base} aria-hidden="true">
      <path d="M14 3v8.5L10.5 17c-1 0-1.8-.8-1.8-1.8V12H4.8c-1 0-1.8-.9-1.6-1.9l1-5.6C4.3 3.6 5.1 3 6 3h8Z" />
      <path d="M14 3h2.2v8.5H14" />
    </svg>
  );
}

export function IconTicket({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" {...base} aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4V7Z" />
      <path d="M11 5v10" strokeDasharray="2 2" />
    </svg>
  );
}

export function IconSun({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" {...base} aria-hidden="true">
      <circle cx="10" cy="10" r="3.6" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
    </svg>
  );
}

export function IconMoon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" {...base} aria-hidden="true">
      <path d="M17 10.5A7 7 0 0 1 9.5 3a7 7 0 1 0 7.5 7.5Z" />
    </svg>
  );
}

export function IconShield({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.9-7 9.5-4.1-1.6-7-5.3-7-9.5V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function IconGlobe({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </svg>
  );
}

export function IconLaptop({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true">
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M2 19h20" />
    </svg>
  );
}

export function IconLifebuoy({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.8" />
      <path d="m5.6 5.6 3.7 3.7M14.7 14.7l3.7 3.7M18.4 5.6l-3.7 3.7M9.3 14.7l-3.7 3.7" />
    </svg>
  );
}
