/**
 * App header: logo, title, theme toggle, GitHub link.
 */

import React from 'react';
import { Sparkles, Github } from 'lucide-react';
import { ThemeToggle } from './layout/ThemeToggle';

const GITHUB_URL = 'https://github.com/rubel-amin/tinyimg';

export const AppHeader: React.FC = () => (
  <nav className="fixed top-4 left-4 right-4 z-50 glass rounded-2xl px-4 md:px-6 py-3 flex justify-between items-center shadow-2xl shadow-primary/10">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30 cursor-pointer transition-transform hover:scale-105">
        <Sparkles size={20} fill="currentColor" />
      </div>
      <div>
        <h1 className="text-lg md:text-xl font-bold tracking-tight text-foreground leading-none">
          TinyIMG
        </h1>
        <p className="text-[9px] md:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-0.5">
          Industrial Optimizer
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2 md:gap-3">
      <ThemeToggle />
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        className="p-2.5 rounded-xl hover:bg-muted transition-colors duration-200 text-muted-foreground hover:text-foreground cursor-pointer group"
        aria-label="Open GitHub repository"
      >
        <Github size={18} className="group-hover:scale-110 transition-transform" />
      </a>
    </div>
  </nav>
);
