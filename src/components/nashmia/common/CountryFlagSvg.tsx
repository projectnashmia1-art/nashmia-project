import React, { memo } from "react";

interface CountryFlagSvgProps {
  countryCode?: string | null;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  title?: string;
}

const SIZE_MAP = {
  xs: "w-4 h-2.5",
  sm: "w-4.5 h-3",
  md: "w-5 h-3.5",
  lg: "w-6.5 h-4.5",
};

/**
 * Pure SVG country flag renderer with crisp vector geometries,
 * ensuring identical, pixel-perfect rendering across Windows, macOS, Linux, iOS, and Android.
 */
export const CountryFlagSvg = memo(function CountryFlagSvg({
  countryCode,
  className = "",
  size = "md",
  title,
}: CountryFlagSvgProps) {
  const code = (countryCode || "INT").trim().toUpperCase();
  const dimensions = SIZE_MAP[size] || SIZE_MAP.md;

  const renderFlagContent = () => {
    switch (code) {
      // 🇬🇧 United Kingdom
      case "GB":
      case "UK":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <clipPath id="gb-clip">
              <rect width="60" height="36" rx="2" />
            </clipPath>
            <g clipPath="url(#gb-clip)">
              <path d="M0,0 L60,36 M60,0 L0,36" stroke="#012169" strokeWidth="36" />
              <path d="M0,0 L60,36 M60,0 L0,36" stroke="#FFFFFF" strokeWidth="6" />
              <path d="M0,0 L60,36 M60,0 L0,36" stroke="#C8102E" strokeWidth="4" />
              <path d="M30,0 v36 M0,18 h60" stroke="#FFFFFF" strokeWidth="10" />
              <path d="M30,0 v36 M0,18 h60" stroke="#C8102E" strokeWidth="6" />
            </g>
          </svg>
        );

      // 🇵🇰 Pakistan
      case "PK":
        return (
          <svg viewBox="0 0 60 40" className="w-full h-full">
            <clipPath id="pk-clip">
              <rect width="60" height="40" rx="2" />
            </clipPath>
            <g clipPath="url(#pk-clip)">
              <rect width="60" height="40" fill="#01411C" />
              <rect width="15" height="40" fill="#FFFFFF" />
              {/* Crescent */}
              <circle cx="37" cy="20" r="11" fill="#FFFFFF" />
              <circle cx="40" cy="18" r="9.5" fill="#01411C" />
              {/* 5-pointed Star */}
              <polygon
                points="42,13 43.5,17 47.5,17 44.5,19.5 45.5,23.5 42,21 38.5,23.5 39.5,19.5 36.5,17 40.5,17"
                fill="#FFFFFF"
              />
            </g>
          </svg>
        );

      // 🇺🇸 United States
      case "US":
      case "USA":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <clipPath id="us-clip">
              <rect width="60" height="36" rx="2" />
            </clipPath>
            <g clipPath="url(#us-clip)">
              <rect width="60" height="36" fill="#B22234" />
              {/* White stripes */}
              {[1, 3, 5, 7, 9, 11].map((i) => (
                <rect key={i} y={(i * 36) / 13} width="60" height={36 / 13} fill="#FFFFFF" />
              ))}
              {/* Blue Canton */}
              <rect width="25" height={(7 * 36) / 13} fill="#3C3B6E" />
              {/* Stars dots pattern */}
              <circle cx="5" cy="4" r="1" fill="#FFF" />
              <circle cx="10" cy="4" r="1" fill="#FFF" />
              <circle cx="15" cy="4" r="1" fill="#FFF" />
              <circle cx="20" cy="4" r="1" fill="#FFF" />
              <circle cx="7.5" cy="9.5" r="1" fill="#FFF" />
              <circle cx="12.5" cy="9.5" r="1" fill="#FFF" />
              <circle cx="17.5" cy="9.5" r="1" fill="#FFF" />
              <circle cx="5" cy="15" r="1" fill="#FFF" />
              <circle cx="10" cy="15" r="1" fill="#FFF" />
              <circle cx="15" cy="15" r="1" fill="#FFF" />
              <circle cx="20" cy="15" r="1" fill="#FFF" />
            </g>
          </svg>
        );

      // 🇩🇪 Germany
      case "DE":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="12" fill="#000000" />
            <rect y="12" width="60" height="12" fill="#DD0000" />
            <rect y="24" width="60" height="12" fill="#FFCE00" />
          </svg>
        );

      // 🇦🇪 United Arab Emirates
      case "AE":
      case "UAE":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="12" fill="#00732F" />
            <rect y="12" width="60" height="12" fill="#FFFFFF" />
            <rect y="24" width="60" height="12" fill="#000000" />
            <rect width="15" height="36" fill="#FF0000" />
          </svg>
        );

      // 🇳🇱 Netherlands
      case "NL":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="12" fill="#AE1C28" />
            <rect y="12" width="60" height="12" fill="#FFFFFF" />
            <rect y="24" width="60" height="12" fill="#21468B" />
          </svg>
        );

      // 🇧🇪 Belgium
      case "BE":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="20" height="36" fill="#000000" />
            <rect x="20" width="20" height="36" fill="#FFD100" />
            <rect x="40" width="20" height="36" fill="#EF3340" />
          </svg>
        );

      // 🇫🇷 France
      case "FR":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="20" height="36" fill="#002654" />
            <rect x="20" width="20" height="36" fill="#FFFFFF" />
            <rect x="40" width="20" height="36" fill="#ED2939" />
          </svg>
        );

      // 🇪🇸 Spain
      case "ES":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="9" fill="#AA151B" />
            <rect y="9" width="60" height="18" fill="#F1BF00" />
            <rect y="27" width="60" height="9" fill="#AA151B" />
            {/* Coat of arms silhouette */}
            <circle cx="16" cy="18" r="4" fill="#AA151B" />
          </svg>
        );

      // 🇮🇹 Italy
      case "IT":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="20" height="36" fill="#008C45" />
            <rect x="20" width="20" height="36" fill="#F4F5F0" />
            <rect x="40" width="20" height="36" fill="#CD212A" />
          </svg>
        );

      // 🇨🇳 China
      case "CN":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="36" fill="#DE2910" />
            {/* Large Star */}
            <polygon
              points="10,6 12,12 18,12 13,16 15,22 10,18 5,22 7,16 2,12 8,12"
              fill="#FFDE00"
            />
            {/* Small Stars */}
            <circle cx="20" cy="5" r="1.5" fill="#FFDE00" />
            <circle cx="24" cy="9" r="1.5" fill="#FFDE00" />
            <circle cx="24" cy="15" r="1.5" fill="#FFDE00" />
            <circle cx="20" cy="19" r="1.5" fill="#FFDE00" />
          </svg>
        );

      // 🇸🇬 Singapore
      case "SG":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="18" fill="#EE2536" />
            <rect y="18" width="60" height="18" fill="#FFFFFF" />
            {/* Crescent & Stars */}
            <circle cx="12" cy="9" r="6" fill="#FFFFFF" />
            <circle cx="14" cy="9" r="5" fill="#EE2536" />
            <circle cx="15" cy="6" r="0.8" fill="#FFFFFF" />
            <circle cx="18" cy="7" r="0.8" fill="#FFFFFF" />
            <circle cx="18" cy="11" r="0.8" fill="#FFFFFF" />
            <circle cx="15" cy="12" r="0.8" fill="#FFFFFF" />
            <circle cx="13.5" cy="9" r="0.8" fill="#FFFFFF" />
          </svg>
        );

      // 🇮🇳 India
      case "IN":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="12" fill="#FF9933" />
            <rect y="12" width="60" height="12" fill="#FFFFFF" />
            <rect y="24" width="60" height="12" fill="#138808" />
            {/* Ashoka Chakra */}
            <circle cx="30" cy="18" r="4.5" fill="none" stroke="#000080" strokeWidth="1" />
            <circle cx="30" cy="18" r="1" fill="#000080" />
          </svg>
        );

      // 🇸🇦 Saudi Arabia
      case "SA":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="36" fill="#006C35" />
            {/* White Sword & Inscription */}
            <rect x="18" y="14" width="24" height="2" fill="#FFFFFF" rx="1" />
            <rect x="16" y="21" width="28" height="2" fill="#FFFFFF" rx="1" />
            <polygon points="16,22 14,20 14,24" fill="#FFFFFF" />
          </svg>
        );

      // 🇶🇦 Qatar
      case "QA":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="36" fill="#8D1B3D" />
            <path
              d="M0,0 L18,0 L24,4 L18,8 L24,12 L18,16 L24,20 L18,24 L24,28 L18,32 L24,36 L0,36 Z"
              fill="#FFFFFF"
            />
          </svg>
        );

      // 🇴🇲 Oman
      case "OM":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="12" fill="#FFFFFF" />
            <rect y="12" width="60" height="12" fill="#DB161B" />
            <rect y="24" width="60" height="12" fill="#008000" />
            <rect width="15" height="36" fill="#DB161B" />
            <circle cx="7" cy="8" r="3" fill="#FFFFFF" />
          </svg>
        );

      // 🇰🇼 Kuwait
      case "KW":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="12" fill="#007A3D" />
            <rect y="12" width="60" height="12" fill="#FFFFFF" />
            <rect y="24" width="60" height="12" fill="#CE1126" />
            <polygon points="0,0 16,12 16,24 0,36" fill="#000000" />
          </svg>
        );

      // 🇧🇭 Bahrain
      case "BH":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="36" fill="#CE1126" />
            <path
              d="M0,0 L18,0 L24,4.5 L18,9 L24,13.5 L18,18 L24,22.5 L18,27 L24,31.5 L18,36 L0,36 Z"
              fill="#FFFFFF"
            />
          </svg>
        );

      // 🇪🇬 Egypt
      case "EG":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="12" fill="#CE1126" />
            <rect y="12" width="60" height="12" fill="#FFFFFF" />
            <rect y="24" width="60" height="12" fill="#000000" />
            {/* Eagle of Saladin */}
            <circle cx="30" cy="18" r="3" fill="#C09300" />
          </svg>
        );

      // 🇹🇷 Turkey
      case "TR":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="36" fill="#E30A17" />
            <circle cx="24" cy="18" r="9" fill="#FFFFFF" />
            <circle cx="26.5" cy="18" r="7.2" fill="#E30A17" />
            <polygon
              points="34,18 37,16 36,19.5 39,21 35.5,21.5 34,25 33,21.5 29.5,21 32.5,19.5 31.5,16"
              fill="#FFFFFF"
              transform="scale(0.7) translate(14, 5)"
            />
          </svg>
        );

      // 🇱🇰 Sri Lanka
      case "LK":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="36" fill="#FFBE29" />
            <rect x="4" y="4" width="8" height="28" fill="#005A36" />
            <rect x="14" y="4" width="8" height="28" fill="#EB7B11" />
            <rect x="24" y="4" width="32" height="28" fill="#8D153A" />
            <circle cx="40" cy="18" r="5" fill="#FFBE29" />
          </svg>
        );

      // 🇧🇩 Bangladesh
      case "BD":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="36" fill="#006A4E" />
            <circle cx="27" cy="18" r="10" fill="#F42A41" />
          </svg>
        );

      // 🇰🇷 South Korea
      case "KR":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="36" fill="#FFFFFF" />
            {/* Taegeuk Circle */}
            <circle cx="30" cy="18" r="8" fill="#CD2E3A" />
            <path d="M22,18 A8,8 0 0,0 38,18 A4,4 0 0,0 30,18 A4,4 0 0,1 22,18 Z" fill="#0047A0" />
            {/* Trigrams bars */}
            <rect x="12" y="7" width="6" height="1.5" fill="#000000" transform="rotate(-30 15 8)" />
            <rect x="42" y="7" width="6" height="1.5" fill="#000000" transform="rotate(30 45 8)" />
            <rect
              x="12"
              y="27"
              width="6"
              height="1.5"
              fill="#000000"
              transform="rotate(30 15 28)"
            />
            <rect
              x="42"
              y="27"
              width="6"
              height="1.5"
              fill="#000000"
              transform="rotate(-30 45 28)"
            />
          </svg>
        );

      // 🇯🇵 Japan
      case "JP":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="36" fill="#FFFFFF" />
            <circle cx="30" cy="18" r="10.8" fill="#BC002D" />
          </svg>
        );

      // 🇦🇺 Australia
      case "AU":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="36" fill="#00008B" />
            {/* Union Jack in canton */}
            <rect width="30" height="18" fill="#012169" />
            <path d="M0,0 L30,18 M30,0 L0,18" stroke="#FFFFFF" strokeWidth="3" />
            <path d="M0,0 L30,18 M30,0 L0,18" stroke="#C8102E" strokeWidth="1.8" />
            <path d="M15,0 v18 M0,9 h30" stroke="#FFFFFF" strokeWidth="5" />
            <path d="M15,0 v18 M0,9 h30" stroke="#C8102E" strokeWidth="3" />
            {/* Commonwealth & Southern Cross stars */}
            <polygon
              points="15,24 16,27 19,27 16.5,29 17.5,32 15,30 12.5,32 13.5,29 11,27 14,27"
              fill="#FFFFFF"
            />
            <circle cx="45" cy="8" r="1.5" fill="#FFFFFF" />
            <circle cx="52" cy="14" r="1.5" fill="#FFFFFF" />
            <circle cx="42" cy="18" r="1.5" fill="#FFFFFF" />
            <circle cx="48" cy="27" r="1.5" fill="#FFFFFF" />
          </svg>
        );

      // 🇿🇦 South Africa
      case "ZA":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="18" fill="#E03C31" />
            <rect y="18" width="60" height="18" fill="#001489" />
            {/* Green Y and Black Triangle */}
            <polygon points="0,0 24,18 0,36" fill="#000000" />
            <polygon points="0,0 4,0 28,18 4,36 0,36 22,18" fill="#FFB81C" />
            <polygon points="0,0 26,18 60,18 60,12 28,12 12,0" fill="#007749" />
            <polygon points="0,36 26,18 60,18 60,24 28,24 12,36" fill="#007749" />
          </svg>
        );

      // 🇧🇷 Brazil
      case "BR":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="36" fill="#009739" />
            <polygon points="30,4 54,18 30,32 6,18" fill="#FEDD00" />
            <circle cx="30" cy="18" r="7" fill="#012169" />
            <path d="M24,18 A7,7 0 0,0 36,18" stroke="#FFFFFF" strokeWidth="1" fill="none" />
          </svg>
        );

      // 🇨🇦 Canada
      case "CA":
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="15" height="36" fill="#FF0000" />
            <rect x="15" width="30" height="36" fill="#FFFFFF" />
            <rect x="45" width="15" height="36" fill="#FF0000" />
            {/* Maple leaf */}
            <polygon
              points="30,8 32,15 37,13 34,19 39,21 34,24 35,27 30,25 25,27 26,24 21,21 26,19 23,13 28,15"
              fill="#FF0000"
            />
          </svg>
        );

      // Default Global Maritime Port Icon
      default:
        return (
          <svg viewBox="0 0 60 36" className="w-full h-full">
            <rect width="60" height="36" fill="#0FA3B1" />
            <circle cx="30" cy="18" r="10" fill="#E8F8F9" stroke="#FFFFFF" strokeWidth="1.5" />
            <ellipse cx="30" cy="18" rx="5" ry="10" fill="none" stroke="#0FA3B1" strokeWidth="1" />
            <line x1="20" y1="18" x2="40" y2="18" stroke="#0FA3B1" strokeWidth="1" />
          </svg>
        );
    }
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-slate-300/80 shadow-2xs transition-transform hover:scale-110 select-none ${dimensions} ${className}`}
      title={title || code}
    >
      {renderFlagContent()}
    </span>
  );
});
