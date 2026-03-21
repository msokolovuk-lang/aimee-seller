export type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  section: string;
  badge?: string;
  badgeColor?: 'teal' | 'green' | 'amber' | 'rose';
};

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Дашборд', icon: '📊', href: '/dashboard', section: 'main' },
  { id: 'catalog', label: 'Каталог', icon: '📦', href: '/catalog', section: 'main', badge: '47', badgeColor: 'teal' },
  { id: 'orders', label: 'Заказы', icon: '🛒', href: '/orders', section: 'main', badge: '12', badgeColor: 'green' },
  { id: 'activity', label: 'Активность', icon: '⚡', href: '/activity', section: 'main', badge: 'live', badgeColor: 'green' },
  { id: 'a2a', label: 'A2A Сеть', icon: '🤖', href: '/a2a', section: 'ai', badge: 'live', badgeColor: 'green' },
  { id: 'threats', label: 'Угрозы', icon: '⚠️', href: '/threats', section: 'ai', badge: '1', badgeColor: 'rose' },
  { id: 'briefing', label: 'AI Брифинг', icon: '💡', href: '/briefing', section: 'ai' },
  { id: 'ai-center', label: 'ИИ-центр', icon: '🧠', href: '/ai-center', section: 'ai' },
  { id: 'warehouse', label: 'Склад', icon: '🏭', href: '/warehouse', section: 'ops', badge: '3', badgeColor: 'amber' },
  { id: 'finance', label: 'Финансы', icon: '💰', href: '/finance', section: 'ops' },
  { id: 'bigdata', label: 'Big Data', icon: '📈', href: '/bigdata', section: 'data' },
  { id: 'tariffs', label: 'Тарифы', icon: '💎', href: '/pricing', section: 'settings' },
  { id: 'profile', label: 'Профиль', icon: '⚙️', href: '/profile', section: 'settings' },
];

export const SECTION_LABELS: Record<string, string> = {
  main: 'Основное',
  ai: 'AI Агент',
  ops: 'Операции',
  data: 'Данные',
  settings: 'Настройки',
};
