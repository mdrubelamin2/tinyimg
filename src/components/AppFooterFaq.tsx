import { Heart, Zap } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const FAQ_DATA = [
  {
    answer:
      'We support major formats like SVG, PNG, JPG, WebP, AVIF, and HEIC. We also handle GIF (static first-frame only), BMP, and TIFF (support varies by browser). You can export to WebP, AVIF, JPEG, PNG, or HEIC.',
    question: 'What image formats can I use?',
  },
  {
    answer:
      'Yes. All processing happens locally in your browser using secure sandboxed technology. Your images are never uploaded or sent to any server.',
    question: 'Is my data private and secure?',
  },
  {
    answer:
      'You can process individual images up to 25MB, or upload ZIP archives up to 2GB. Large batch processing is handled efficiently to save your device memory.',
    question: 'Are there any file size limits?',
  },
  {
    answer:
      "Some download managers (like IDM or FDM) can interfere with our secure streaming system. If you experience issues, please temporarily disable them and use your browser's default downloader. This ensures smooth, fast, and memory-efficient downloads for large batches.",
    question: 'Why is "Download All" not working for me?',
  },
]

/** Below-the-fold FAQ; loaded with React.lazy to trim initial bundle. */
export function AppFooterFaq() {
  return (
    <footer className='border-border/50 from-muted/20 border-t bg-gradient-to-b to-transparent'>
      <section className='mx-auto max-w-4xl space-y-6 px-4 py-16 text-center md:px-8'>
        <div className='from-primary/10 to-cta/10 text-primary border-primary/10 inline-flex items-center gap-2 rounded-full border bg-gradient-to-r px-4 py-1.5 text-xs font-bold tracking-widest uppercase shadow-sm'>
          <Zap
            className='text-cta'
            fill='currentColor'
            size={14}
          />{' '}
          Secure Browser-Native Engine
        </div>
        <h2 className='text-foreground text-2xl font-extrabold tracking-tight text-balance md:text-3xl'>
          Professional-grade optimization.{' '}
          <span className='text-primary italic'>100% Private.</span>
        </h2>
        <p className='text-muted-foreground mx-auto max-w-2xl text-sm leading-relaxed text-balance md:text-base'>
          A powerful, private alternative to TinyPNG. Supports recursive folders, intelligent SVG
          rasterization, and live previews—all while keeping your data strictly on your device.
        </p>
      </section>
      <section className='border-border/50 mx-auto max-w-2xl border-t px-4 py-10 md:px-8'>
        <h3 className='text-muted-foreground mb-6 text-xs font-black tracking-widest uppercase'>
          FAQ
        </h3>
        <Accordion
          className='w-full'
          collapsible
          type='single'
        >
          {FAQ_DATA.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
            >
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
      <div className='text-muted-foreground/60 border-border/50 border-t py-8 text-center text-[10px] font-bold tracking-widest uppercase'>
        <p>&copy; 2026 TinyIMG &bull; Privacy First</p>
        <p className='mt-2 inline-flex items-center gap-1.5 text-[9px] opacity-80'>
          Crafted with{' '}
          <Heart
            className='text-destructive'
            fill='currentColor'
            size={10}
          />{' '}
          by{' '}
          <a
            className='text-primary decoration-primary/50 hover:decoration-primary underline underline-offset-4 transition-all hover:opacity-80'
            href='https://www.linkedin.com/in/mdrubelamin2/'
            rel='noopener noreferrer'
            target='_blank'
          >
            Md Rubel Amin
          </a>
        </p>
      </div>
    </footer>
  )
}
