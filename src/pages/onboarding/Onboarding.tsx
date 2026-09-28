import { useApp } from '../../lib/store';
import { supabase, friendlyError } from '../../lib/supabase';
import { ensureMonth } from '../../lib/data';
import { currentMonth } from '../../lib/format';
import { toast } from '../../components/ui';
import { AccountsStep, DebtsStep, FixedStep, IncomeStep, SummaryStep, VariableStep } from './steps';

const TOTAL = 6;

export function Onboarding() {
  const { profile, updateProfile, userId, categories, bump } = useApp();
  const step = Math.min(Math.max(profile?.onboarding_step ?? 1, 1), TOTAL);

  // o passo atual fica salvo no perfil: se a pessoa fechar o app, continua de onde parou
  const goTo = async (n: number) => {
    try {
      await updateProfile({ onboarding_step: n });
      window.scrollTo(0, 0);
    } catch (err) {
      toast(friendlyError(err));
    }
  };
  const next = () => goTo(step + 1);
  const back = step > 1 ? () => goTo(step - 1) : undefined;

  async function finish(goal: { target: number } | null) {
    try {
      if (goal) {
        const { count } = await supabase.from('goals').select('id', { count: 'exact', head: true }).eq('user_id', userId);
        if (!count) {
          const { error } = await supabase
            .from('goals')
            .insert({ user_id: userId, name: 'Reserva de emergência', target_amount: goal.target, saved_amount: 0 });
          if (error) throw error;
        }
      }
      await ensureMonth(userId, currentMonth(), categories);
      await updateProfile({ onboarding_completed: true, last_review_month: currentMonth() });
      bump();
      window.location.hash = '/';
      toast('Tudo pronto. Bem-vindo ao Fina');
    } catch (err) {
      toast(friendlyError(err));
    }
  }

  return (
    <main className="onboarding">
      <div className="onb-progress">
        <div className="onb-progress-text">
          Passo {step} de {TOTAL}
        </div>
        <div className="progress">
          <div className="progress-bar ok" style={{ width: `${(step / TOTAL) * 100}%` }} />
        </div>
      </div>

      {step === 1 && <IncomeStep actions={{ primaryLabel: 'Continuar', onDone: next }} />}
      {step === 2 && <FixedStep actions={{ primaryLabel: 'Continuar', onDone: next, onBack: back }} />}
      {step === 3 && <VariableStep actions={{ primaryLabel: 'Continuar', onDone: next, onBack: back }} />}
      {step === 4 && <AccountsStep actions={{ primaryLabel: 'Continuar', onDone: next, onBack: back }} />}
      {step === 5 && <DebtsStep actions={{ primaryLabel: 'Continuar', onDone: next, onBack: back, onSkip: next }} />}
      {step === 6 && <SummaryStep onBack={() => goTo(5)} onFinish={finish} />}
    </main>
  );
}
