'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, SECTION_LABELS } from '@/lib/nav';

const badgeStyles: Record<string, string> = {
  teal: 'bg-teal-dim text-teal',
  green: 'bg-aimee-green-dim text-aimee-green',
  amber: 'bg-aimee-amber-dim text-aimee-amber',
  rose: 'bg-aimee-rose-dim text-aimee-rose',
};

export default function Sidebar() {
  const pathname = usePathname();
  const [brandName, setBrandName] = useState('');

  useEffect(() => {
    setBrandName(localStorage.getItem('brand_name') || '');
  }, []);

  const grouped: Record<string, typeof NAV_ITEMS> = {};
  NAV_ITEMS.forEach((item) => {
    if (!grouped[item.section]) grouped[item.section] = [];
    grouped[item.section].push(item);
  });

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-card border-r border-black/[0.07] flex flex-col z-50">
      {/* Logo */}
      <Link href="/onboarding" className="px-5 pt-5 pb-3.5 flex items-center gap-2.5 border-b border-black/[0.07] hover:opacity-80 transition-opacity">
        <div className="w-9 h-9 bg-teal rounded-[10px] flex items-center justify-center text-base font-bold text-white shadow-[0_0_14px_rgba(15,188,206,0.25)]">
          A
        </div>
        <span className="text-lg font-bold">AIMEE</span>
        <span className="ml-auto text-[8px] font-mono text-teal bg-teal-dim border border-teal/30 px-1.5 py-0.5 rounded-full">
          SELLER
        </span>
      </Link>

      {/* Brand name */}
      <div className="px-4 py-3 border-b border-black/[0.07]">
        <p className="text-sm font-bold text-gray-900 truncate">
          {brandName || 'Seller Portal'}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2.5 overflow-y-auto">
        {Object.entries(grouped).map(([section, items]) => (
          <div key={section}>
            <div className="text-[9px] font-mono text-txt-muted tracking-widest uppercase px-3 pt-3 pb-1.5">
              {SECTION_LABELS[section]}
            </div>
            {items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`
                    relative flex items-center gap-2.5 px-3 py-2.5 rounded-aimee-sm text-[13px] mb-0.5 transition-all
                    ${isActive
                      ? 'bg-teal-dim text-teal font-semibold'
                      : 'text-txt-secondary hover:bg-teal-dim hover:text-txt'
                    }
                  `}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-sm bg-teal" />
                  )}
                  <span className="text-base w-[22px] text-center">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`ml-auto text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full ${
                        badgeStyles[item.badgeColor || 'teal']
                      }`}
                    >
                      {item.badge === 'live' ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-aimee-green animate-pulse-slow" />
                          live
                        </span>
                      ) : (
                        item.badge
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3.5 border-t border-black/[0.07]">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-teal bg-teal-dim border border-teal/20 px-2.5 py-1.5 rounded-aimee-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-aimee-green animate-pulse-slow" />
          AIMEE AI
        </div>
      </div>
    </aside>
  );
}
