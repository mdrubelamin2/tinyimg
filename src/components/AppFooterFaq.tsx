import { Zap } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const FAQ_DATA = [
  {
    answer:
      'Input: SVG, PNG, JPG, WebP, AVIF, HEIC (Safari), GIF, BMP, TIFF. Output: WebP, AVIF, JPEG, PNG, JXL. SVGs can be optimized or rasterized at display density.',
    question: 'What formats are supported?',
  },
  {
    answer:
      'No. Optimization runs entirely in your browser using WebAssembly. Your files never leave your device.',
    question: 'Is my data sent to a server?',
  },
  {
    answer:
      '25MB per image file; ZIP archives up to 2GB. Batch download is capped to avoid memory issues.',
    question: 'What is the file size limit?',
  },
  {
    answer:
      "Download managers (IDM, FDM, etc.) intercept downloads before our streaming system can handle them. Please temporarily disable your download manager extension and use your browser's built-in downloader. This allows us to stream files directly from storage without loading everything into memory, which is essential for handling large batches on low-memory devices.",
    question: 'Why does "Download All" fail with my download manager?',
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
          Powered by WASM Engines
        </div>
        <h2 className='text-foreground text-2xl font-extrabold tracking-tight text-balance md:text-3xl'>
          Industrial grade optimization.{' '}
          <span className='text-primary italic'>Browser native.</span>
        </h2>
        <p className='text-muted-foreground mx-auto max-w-2xl text-sm leading-relaxed text-balance md:text-base'>
          The definitive alternative to TinyPNG. Recursive folder support, intelligent SVG
          rasterization, before/after preview, and zero data leakage.
        </p>
      </section>
      <section className='border-border/50 mx-auto max-w-2xl border-t px-4 py-10 md:px-8'>
        <h3 className='text-muted-foreground mb-6 text-center text-xs font-black tracking-widest uppercase'>
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
      <p className='text-muted-foreground/60 border-border/50 border-t py-6 text-center text-[10px] font-bold tracking-widest uppercase'>
        &copy; 2026 TinyIMG &bull; Industrial Strength &bull; Pure WASM
      </p>
    </footer>
  )
}
