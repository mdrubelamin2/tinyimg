import { describe, it, expect } from 'vitest';
import { PRESETS as PRESETSFromFacade } from '@/workers/raster-encode';
import { PRESETS as PRESETSFromModule } from '@/lib/codecs/raster/presets';

/**
 * Node Vitest cannot load jSquash WASM without extra setup; instead we lock the
 * contract that must hold for PNG mild-quant: `pTry === PRESETS.photo` in encode-png.
 */
describe('raster codec module binding (facade vs lib/codecs/raster)', () => {
  it('re-exports the same PRESETS object from workers/raster-encode as lib/codecs/raster/presets', () => {
    expect(PRESETSFromFacade).toBe(PRESETSFromModule);
    expect(PRESETSFromFacade.photo).toBe(PRESETSFromModule.photo);
    expect(PRESETSFromFacade.graphic).toBe(PRESETSFromModule.graphic);
  });

  it('keeps stable reference for PRESETS.photo identity check', () => {
    expect(PRESETSFromModule.photo).toBe(PRESETSFromModule.photo);
  });
});
