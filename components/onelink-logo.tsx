// OneLink brand logo — chain-link SVG + gradient wordmark

type OneLinkLogoProps = {
  iconSize?: number;
  textSize?: string;
  dark?: boolean; // true = white "One" (for dark backgrounds), false = navy "One" (for light backgrounds)
  className?: string;
};

export function OneLinkLogo({
  iconSize = 32,
  textSize = "text-[18px]",
  dark = true,
  className = "",
}: OneLinkLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 44 44" fill="none" aria-label="OneLink logo">
        <defs>
          <linearGradient id="olg" x1="0" y1="44" x2="44" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6D28D9" />
            <stop offset="42%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <clipPath id="olc">
            <rect x="12" y="20" width="11" height="10" />
          </clipPath>
        </defs>
        {/* Back ring (bottom-right) */}
        <rect x="18" y="18" width="23" height="23" rx="8" fill="none" stroke="url(#olg)" strokeWidth="5.5" />
        {/* Front ring (top-left) — renders on top in overlap area */}
        <rect x="3" y="3" width="23" height="23" rx="8" fill="none" stroke="url(#olg)" strokeWidth="5.5" />
        {/* Back ring clipped — the piece that emerges "in front" of the front ring at the crossing */}
        <rect x="18" y="18" width="23" height="23" rx="8" fill="none" stroke="url(#olg)" strokeWidth="5.5" clipPath="url(#olc)" />
      </svg>

      <span className={`${textSize} font-black tracking-tight leading-none`}>
        <span style={{ color: dark ? "#ffffff" : "#0F2B5B" }}>One</span>
        <span
          style={{
            background: "linear-gradient(90deg, #1D4ED8 0%, #06B6D4 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Link
        </span>
      </span>
    </div>
  );
}
