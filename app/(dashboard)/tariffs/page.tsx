import Topbar from '@/components/ui/topbar';

export default function TariffsPage() {
  return (
    <div>
      <Topbar title="💎 Тарифы" subtitle="Выберите план" />
      <div className="p-7 max-w-[1200px]">
        <div className="bg-card border border-black/[0.07] rounded-aimee p-10 text-center animate-fade-in">
          <div className="text-4xl mb-3">💎 </div>
          <h2 className="text-lg font-bold mb-2">💎 Тарифы</h2>
          <p className="text-sm text-txt-secondary">Выберите план</p>
          <p className="text-xs text-txt-muted font-mono mt-4">Следующий шаг разработки</p>
        </div>
      </div>
    </div>
  );
}
