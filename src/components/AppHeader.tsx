/**
 * App header: logo, title, theme toggle, GitHub link.
 */

import { Github, Sparkles } from 'lucide-react'

import { ThemeToggle } from './layout/ThemeToggle'

const GITHUB_URL = 'https://github.com/mdrubelamin2/tinyimg.git'

export function AppHeader() {
  return (
    <nav className='glass shadow-primary/10 fixed top-[max(1rem,env(safe-area-inset-top,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] left-[max(1rem,env(safe-area-inset-left,0px))] z-50 flex items-center justify-between rounded-2xl px-4 py-3 shadow-2xl md:px-6'>
      <div className='flex items-center gap-3'>
        <div className='from-primary to-primary/80 text-primary-foreground shadow-primary/30 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br shadow-lg transition-transform hover:scale-105'>
          <Sparkles
            fill='currentColor'
            size={20}
          />
        </div>
        <div>
          <h1 className='text-foreground text-lg leading-none font-bold tracking-tight md:text-xl'>
            TinyIMG
          </h1>
          <p className='text-muted-foreground mt-0.5 text-[9px] font-semibold tracking-widest uppercase md:text-[10px]'>
            Industrial Optimizer
          </p>
        </div>
      </div>
      <div className='flex items-center gap-2 md:gap-3'>
        <ThemeToggle />
        <a
          aria-label='Open GitHub repository'
          className='hover:bg-muted text-muted-foreground hover:text-foreground group cursor-pointer rounded-xl p-2.5 transition-colors duration-200'
          href={GITHUB_URL}
          rel='noreferrer'
          target='_blank'
        >
          <Github
            className='transition-transform group-hover:scale-110'
            size={18}
          />
        </a>
      </div>
    </nav>
  )
}
