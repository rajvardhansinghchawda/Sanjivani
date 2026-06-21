import React from 'react';

export default function SanjivniLogo({ size = 42, className = '', showWordmark = true }) {
  const wordmarkSize = Math.max(16, Math.round(size * 0.42));

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label="SANJIVNI logo"
        className="shrink-0"
      >
        <defs>
          <clipPath id="sanjivni-soft-crop">
            <rect x="0" y="0" width="100" height="100" rx="22" />
          </clipPath>
        </defs>
        <g clipPath="url(#sanjivni-soft-crop)">
          <circle cx="50" cy="18" r="12" fill="#AFC3B4" />
          <rect x="22" y="52" width="56" height="18" rx="9" fill="#C9D9CE" transform="rotate(-45 50 61)" opacity="0.95" />
          <rect x="22" y="52" width="56" height="18" rx="9" fill="#537061" transform="rotate(45 50 61)" opacity="0.92" />
          <rect x="22" y="52" width="56" height="18" rx="9" fill="#6C8779" transform="rotate(-135 50 61)" opacity="0.88" />
          <rect x="22" y="52" width="56" height="18" rx="9" fill="#415B50" transform="rotate(135 50 61)" opacity="0.88" />
          <circle cx="50" cy="52" r="16" fill="#DDE9DF" opacity="0.35" />
        </g>
      </svg>
      {showWordmark && (
        <span className="text-[#1B4332] font-black tracking-tight uppercase" style={{ fontSize: wordmarkSize }}>
          SANJIVNI
        </span>
      )}
    </div>
  );
}
