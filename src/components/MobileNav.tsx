import React, { useState, useEffect } from 'react';
import { Home, Search, Calendar, Heart, Send } from 'lucide-react';
import { lireFavoris } from '../lib/favoris';

interface MobileNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentPath, onNavigate }) => {
  const [favCount, setFavCount] = useState<number>(() => lireFavoris().length);

  useEffect(() => {
    const handleFavChange = (e: Event) => {
      const custom = e as CustomEvent<{ count: number }>;
      setFavCount(custom.detail?.count ?? lireFavoris().length);
    };

    window.addEventListener('favoris:change', handleFavChange);
    return () => window.removeEventListener('favoris:change', handleFavChange);
  }, []);

  const navItems = [
    { label: 'Accueil', path: '/', icon: Home },
    { label: 'Recherche', path: '/recherche', icon: Search },
    { label: 'Calendrier', path: '/calendrier', icon: Calendar },
    {
      label: 'Favoris',
      path: '/favoris',
      icon: Heart,
      badge: favCount > 0 ? favCount : null
    },
    { label: 'Canaux', path: '/canaux', icon: Send }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF]/95 dark:bg-[#161F35]/95 backdrop-blur-md border-t border-[#D5DBE8] dark:border-[#27324D] px-2 py-1 safe-area-pb">
      <div className="grid grid-cols-5 items-center justify-items-center h-14">
        {navItems.map((item) => {
          const isActive =
            item.path === '/'
              ? currentPath === '/'
              : currentPath.startsWith(item.path);

          const IconComponent = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`relative flex flex-col items-center justify-center w-full h-full min-h-[44px] min-w-[44px] transition-colors ${
                isActive
                  ? 'text-[#2B50FF] dark:text-[#7F95FF]'
                  : 'text-[#55607A] dark:text-[#A3AEC8] hover:text-[#14213D] dark:hover:text-[#EEF1F8]'
              }`}
            >
              <div className="relative">
                <IconComponent className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[16px] h-4 rounded-full bg-[#FFC83D] text-[#14213D] text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium tracking-tight ${isActive ? 'font-bold' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
