import React from 'react';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | number;
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClass =
    size === 'sm' || (typeof size === 'number' && size <= 24)
      ? 'h-8'
      : size === 'lg' || (typeof size === 'number' && size >= 40)
      ? 'h-12'
      : 'h-9 sm:h-10';

  return (
    <img
      src="/assets/aistudio/file_0000000012488210983af17121cf1c31_aeba312b.png"
      alt="AnimeAlert Buea"
      decoding="async"
      className={`${sizeClass} w-auto aspect-video rounded-xl object-cover border border-[#D5DBE8]/70 dark:border-[#27324D] shadow-sm shrink-0 bg-[#0D1322] ${className}`}
    />
  );
};
