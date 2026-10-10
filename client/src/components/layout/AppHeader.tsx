import { BookOpen, Briefcase, History, Mic, Shuffle } from 'lucide-react';
import type { Tab } from '../../types';
import AccountMenu from './AccountMenu';
import SystemStatus from './SystemStatus';

const TABS: { id: Tab; label: string; shortLabel: string; Icon: typeof Mic }[] = [
  { id: 'random', label: 'Random Topic', shortLabel: 'Topics', Icon: Shuffle },
  { id: 'interview', label: 'Interview Prep', shortLabel: 'Interview', Icon: Briefcase },
  { id: 'vocab', label: 'Vocabulary', shortLabel: 'Vocab', Icon: BookOpen },
  { id: 'history', label: 'History', shortLabel: 'History', Icon: History },
];

interface AppHeaderProps {
  activeTab: Tab;
  onSelect: (tab: Tab) => void;
}

export default function AppHeader({ activeTab, onSelect }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-sm">
            <Mic className="size-4" aria-hidden="true" />
          </span>
          <div className="leading-tight whitespace-nowrap">
            <p className="text-sm font-semibold text-fg">Speak Up</p>
            <p className="hidden text-xs text-subtle xl:block">Speaking practice</p>
          </div>
        </div>

        <nav aria-label="Practice modes" className="hidden md:block">
          <TabList activeTab={activeTab} onSelect={onSelect} />
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <SystemStatus />
          <AccountMenu />
        </div>
      </div>

      <nav aria-label="Practice modes" className="border-t border-line px-2 py-1.5 md:hidden">
        <ul className="grid grid-cols-4 gap-1">
          {TABS.map(({ id, shortLabel, Icon }) => {
            const active = id === activeTab;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onSelect(id)}
                  className={`flex w-full flex-col items-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    active ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-fg'
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {shortLabel}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

function TabList({ activeTab, onSelect }: AppHeaderProps) {
  return (
    <ul className="flex gap-1">
      {TABS.map(({ id, label, Icon }) => {
        const active = id === activeTab;
        return (
          <li key={id}>
            <button
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(id)}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors ${
                active ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-fg'
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
