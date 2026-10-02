import React from "react";

interface ResultModalIllustrationProps {
  type?: "success" | "error";
  className?: string;
}

export function ResultModalIllustration({
  type = "success",
  className = "size-32",
}: ResultModalIllustrationProps) {
  const isSuccess = type === "success";

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full select-none"
      >
        {/* Floating Sparkles & Dots matching the reference */}
        {isSuccess ? (
          <>
            {/* Top-left Cyan Plus */}
            <path d="M36 34V42M32 38H40" stroke="#00A3FF" strokeWidth="2.2" strokeLinecap="round" />
            {/* Top-right Cyan Plus */}
            <path
              d="M124 32V40M120 36H128"
              stroke="#00A3FF"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Bottom-left Cyan Plus */}
            <path
              d="M32 106V112M29 109H35"
              stroke="#00C9FF"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Bottom-right Cyan Plus */}
            <path
              d="M128 108V114M125 111H131"
              stroke="#00C9FF"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Soft Gray Ring - Left */}
            <circle cx="28" cy="62" r="3.5" stroke="#CBD5E1" strokeWidth="1.8" />
            {/* Soft Gray Ring - Right */}
            <circle cx="132" cy="74" r="3.5" stroke="#CBD5E1" strokeWidth="1.8" />
          </>
        ) : (
          <>
            {/* Top-left Orange Plus */}
            <path d="M36 34V42M32 38H40" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
            {/* Top-right Orange Plus */}
            <path
              d="M124 32V40M120 36H128"
              stroke="#F59E0B"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Bottom-left Orange Plus */}
            <path
              d="M32 106V112M29 109H35"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Soft Gray Ring - Left */}
            <circle cx="28" cy="62" r="3.5" stroke="#CBD5E1" strokeWidth="1.8" />
            {/* Soft Gray Ring - Right */}
            <circle cx="132" cy="74" r="3.5" stroke="#CBD5E1" strokeWidth="1.8" />
          </>
        )}

        {/* Shadow under Document */}
        <ellipse cx="80" cy="138" rx="40" ry="7" fill="rgba(15, 23, 42, 0.05)" />

        {/* Main Document Card */}
        <g transform="translate(42, 36)">
          {/* Document Body */}
          <rect
            x="0"
            y="0"
            width="64"
            height="86"
            rx="8"
            fill="#FFFFFF"
            stroke="#1E293B"
            strokeWidth="3.2"
          />

          {/* Line 1 inside document */}
          <line
            x1="14"
            y1="22"
            x2="38"
            y2="22"
            stroke="#CBD5E1"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Line 2 inside document */}
          <line
            x1="14"
            y1="34"
            x2="48"
            y2="34"
            stroke="#CBD5E1"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {isSuccess ? (
            /* Health / Activity Pulse Line in document */
            <path
              d="M14 62H24L29 52L35 70L41 58L45 62H52"
              stroke="#00A3FF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            /* Warning / Red bottom bar in document */
            <line
              x1="14"
              y1="64"
              x2="50"
              y2="64"
              stroke="#EF4444"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}

          {/* Heart Graphic on Document Corner */}
          {isSuccess ? (
            <g transform="translate(38, -6)">
              {/* Heart Glow & Drop */}
              <path
                d="M19 8C19 3.5 15 0 10.5 0C6.5 0 3 3 3 3C3 3 -0.5 0 -4.5 0C-9 0 -13 3.5 -13 8C-13 15.5 3 24 3 24C3 24 19 15.5 19 8Z"
                fill="#00E5FF"
                transform="translate(13, 10)"
              />
              <path
                d="M19 8C19 3.5 15 0 10.5 0C6.5 0 3 3 3 3C3 3 -0.5 0 -4.5 0C-9 0 -13 3.5 -13 8C-13 15.5 3 24 3 24C3 24 19 15.5 19 8Z"
                stroke="#1E293B"
                strokeWidth="3"
                strokeLinejoin="round"
                transform="translate(13, 10)"
              />
            </g>
          ) : (
            <g transform="translate(38, -6)">
              <path
                d="M19 8C19 3.5 15 0 10.5 0C6.5 0 3 3 3 3C3 3 -0.5 0 -4.5 0C-9 0 -13 3.5 -13 8C-13 15.5 3 24 3 24C3 24 19 15.5 19 8Z"
                fill="#F59E0B"
                transform="translate(13, 10)"
              />
              <path
                d="M19 8C19 3.5 15 0 10.5 0C6.5 0 3 3 3 3C3 3 -0.5 0 -4.5 0C-9 0 -13 3.5 -13 8C-13 15.5 3 24 3 24C3 24 19 15.5 19 8Z"
                stroke="#1E293B"
                strokeWidth="3"
                strokeLinejoin="round"
                transform="translate(13, 10)"
              />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
