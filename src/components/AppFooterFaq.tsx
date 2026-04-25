import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Zap } from 'lucide-react';

const FAQ_DATA = [
  {
    question: 'What formats are supported?',
    answer:
      'Input: SVG, PNG, JPG, WebP, AVIF, HEIC (Safari), GIF, BMP, TIFF. Output: WebP, AVIF, JPEG, PNG, JXL. SVGs can be optimized or rasterized at display density.',
  },
  {
    question: 'Is my data sent to a server?',
    answer:
      'No. Optimization runs entirely in your browser using WebAssembly. Your files never leave your device.',
  },
  {
    question: 'What is the file size limit?',
    answer: '25MB per image file; ZIP archives up to 2GB. Batch download is capped to avoid memory issues.',
  },
  {
    question: 'Why does "Download All" fail with my download manager?',
    answer:
      'Download managers (IDM, FDM, etc.) intercept downloads before our streaming system can handle them. Please temporarily disable your download manager extension and use your browser\'s built-in downloader. This allows us to stream files directly from storage without loading everything into memory, which is essential for handling large batches on low-memory devices.',
  },
];

/** Below-the-fold FAQ; loaded with React.lazy to trim initial bundle. */
export function AppFooterFaq() {
  return (
    <footer className="border-t border-border/50 bg-gradient-to-b from-muted/20 to-transparent">
      <section className="max-w-4xl mx-auto px-4 md:px-8 py-16 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/10 to-cta/10 text-primary text-xs font-bold uppercase tracking-widest border border-primary/10 shadow-sm">
          <Zap size={14} fill="currentColor" className="text-cta" /> Powered by WASM Engines
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight text-balance">
          Industrial grade optimization. <span className="text-primary italic">Browser native.</span>
        </h2>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed text-balance">
          The definitive alternative to TinyPNG. Recursive folder support, intelligent SVG rasterization,
          before/after preview, and zero data leakage.
        </p>
      </section>
      <section className="max-w-2xl mx-auto px-4 md:px-8 py-10 border-t border-border/50">
        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-6 text-center">
          FAQ
        </h3>
        <Accordion type="single" collapsible className="w-full">
          {FAQ_DATA.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
      <p className="py-6 text-center text-muted-foreground/60 text-[10px] uppercase tracking-widest font-bold border-t border-border/50">
        &copy; 2026 TinyIMG &bull; Industrial Strength &bull; Pure WASM
      </p>
    </footer>
  );
}
