import Topbar from '@/components/ui/topbar';

export default function AiToolsPage() {
  return (
    <div>
      <Topbar title="🧠 AI Tools" subtitle="Про план 3 активны" />
      <div className="p-7 max-w-[1200px]">
        <div className="bg-card border border-black/[0.07] rounded-aimee p-10 text-center animate-fade-in">
          <div className="text-4xl mb-3">🧠 </div>
          <h2 className="text-lg font-bold mb-2">🧠 AI Tools</h2>
          <p className="text-sm text-txt-secondary">Про план 3 активны</p>
          <p className="text-xs text-txt-muted font-mono mt-4">Следующий шаг разработки</p>
        </div>
      </div>
    </div>
  );
}
