export type SvgType = 'SIMPLE' | 'HYBRID';

export interface SvgClassification {
  type: SvgType;
  stats: {
    nodes: number;
    segments: number;
    filters: number;
  };
}

export function classifySvg(svgString: string): SvgClassification {
  const nodes = (svgString.match(/<[^/!][^>]*>/g) || []).length;
  const segments = (svgString.match(/[a-df-z]/gi) || []).length;
  const filters = (svgString.match(/<filter|<mask|<clipPath/g) || []).length;
  const isHybrid = svgString.includes('<image');

  let type: SvgType = 'SIMPLE';
  if (isHybrid || (nodes > 1500 || segments > 5000 || filters > 5)) {
    type = 'HYBRID';
  }

  return {
    type,
    stats: {
      nodes,
      segments,
      filters,
    },
  };
}
