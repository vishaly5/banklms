import AITutor from './byteSize/AITutor';
import { Bot, BookOpen, Brain, MessageCircle } from 'lucide-react';
import { PremiumHero, PremiumPageShell, PremiumStatCard } from './premium/PremiumPage';

export default function AITutorPage() {
  return (
    <PremiumPageShell>
      <PremiumHero
        title="Riva AI Learning Mentor"
        subtitle="CEAS-LMS courses ke liye Hinglish explanations, examples, aur step-by-step guided learning support."
        eyebrow="Hinglish study support"
        icon={Bot}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PremiumStatCard label="Concept Help" value="24x7" detail="Hinglish mentor" icon={Brain} tone="from-indigo-50 via-blue-50 to-white" accent="text-indigo-600" />
        <PremiumStatCard label="Course Context" value="Riva" detail="Learning focused" icon={BookOpen} tone="from-emerald-50 via-teal-50 to-white" accent="text-emerald-600" />
        <PremiumStatCard label="Doubt Solving" value="Chat" detail="Step-by-step jawab" icon={MessageCircle} tone="from-violet-50 via-purple-50 to-white" accent="text-violet-600" />
      </div>

      <div className="h-[calc(100vh-330px)] min-h-[560px] overflow-hidden rounded-[24px] border border-white/80 bg-white/88 shadow-[0_8px_30px_rgba(99,102,241,.06)] backdrop-blur-xl">
        <AITutor darkMode={false} standalone />
      </div>
    </PremiumPageShell>
  );
}
