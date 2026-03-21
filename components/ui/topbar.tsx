'use client';

type TopbarProps = {
  title: string;
  subtitle?: string;
};

export default function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header className="flex items-center justify-between px-7 py-3.5 bg-card border-b border-black/[0.07] sticky top-0 z-40">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && (
          <p className="text-[11px] font-mono text-txt-muted">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3.5">
        <span className="text-[10px] font-mono text-txt-muted">
          {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · Пн, 11 мар 2026
        </span>
        <div className="w-8 h-8 rounded-aimee-sm bg-gradient-to-br from-teal to-aimee-indigo flex items-center justify-center text-white text-[11px] font-bold">
          NC
        </div>
      </div>
    </header>
  );
}
