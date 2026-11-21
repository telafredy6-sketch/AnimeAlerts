import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ size = 28, className = '' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="16" fill="#14213D" />
      <circle cx="32" cy="32" r="16" fill="#FFC83D" stroke="#2B50FF" strokeWidth="4" />
      <path
        d="M25 39 L32 23 L39 39 M27.5 34.5 L36.5 34.5"
        fill="none"
        stroke="#14213D"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
