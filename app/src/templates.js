// Panel layouts and export sizes for the cover. A template splits the poster area above the caption
// into panel rectangles; layoutPanels() turns one into pixel rects for a given canvas size, so every
// panel crop stays put when the size or template changes.

export const SIZES = {
  square: { id: 'square', w: 1080, h: 1080, label: '1080 × 1080', file: 'cover-1080x1080.png' },
  tall: { id: 'tall', w: 1080, h: 1350, label: '1080 × 1350', file: 'cover-1080x1350.png' },
  wide: { id: 'wide', w: 1920, h: 1080, label: '1920 × 1080', file: 'cover-1920x1080.png' },
};

// caption: 'band' reserves a solid strip at the foot for the lettering, 'overlay' draws it over the
// bottom panels behind a scrim. cut names how the area is split; the numbers are fractions.
export const TEMPLATES = [
  { id: 'poster', name: 'Big Panel', caption: 'overlay', cut: ['full'] },
  { id: 'triptych', name: 'Stacked Rows', caption: 'band', cut: ['rows', 0.36, 0.33, 0.31] },
  { id: 'mosaic-side', name: 'Big + Side', caption: 'band', cut: ['left-big', 0.58] },
  { id: 'quad', name: 'Four Grid', caption: 'overlay', cut: ['grid', 0.5, 0.5] },
  { id: 'feature', name: 'Feature Row', caption: 'band', cut: ['feature', 0.6] },
];

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** Splits `box` into horizontal rows of the given fractional heights, `gutter` between them. */
function rows(box, fracs, gutter) {
  const total = fracs.reduce((a, b) => a + b, 0);
  const free = box.h - gutter * (fracs.length - 1);
  let y = box.y;
  return fracs.map((f) => {
    const h = (f / total) * free;
    const rect = { x: box.x, y, w: box.w, h };
    y += h + gutter;
    return rect;
  });
}

/** Splits `box` into vertical columns of the given fractional widths, `gutter` between them. */
function cols(box, fracs, gutter) {
  const total = fracs.reduce((a, b) => a + b, 0);
  const free = box.w - gutter * (fracs.length - 1);
  let x = box.x;
  return fracs.map((f) => {
    const w = (f / total) * free;
    const rect = { x, y: box.y, w, h: box.h };
    x += w + gutter;
    return rect;
  });
}

/** The poster area the panels live in: everything above the caption zone, inside the frame margin. */
function panelArea(W, H, mode, bandH) {
  const m = 0.028 * W; // frame margin, kept square so gutters match at every size
  const top = m;
  if (mode === 'band') {
    const gap = 0.014 * W;
    return { x: m, y: top, w: W - 2 * m, h: H - bandH - gap - top };
  }
  return { x: m, y: top, w: W - 2 * m, h: H - 2 * m };
}

/** Panel rectangles in canvas pixels for `templateId` at size W × H, `bandH` reserved for the caption. */
export function layoutPanels(templateId, W, H, bandH) {
  const t = getTemplate(templateId);
  const g = 0.016 * W;
  const area = panelArea(W, H, t.caption, bandH);
  const cut = t.cut;
  switch (cut[0]) {
    case 'full':
      return [area];
    case 'rows':
      return rows(area, cut.slice(1), g);
    case 'left-big': {
      const [big, side] = cols(area, [cut[1], 1 - cut[1]], g);
      return [big, ...rows(side, [0.52, 0.48], g)];
    }
    case 'grid': {
      const halves = rows(area, [cut[1], cut[2]], g);
      return [...cols(halves[0], [0.5, 0.5], g), ...cols(halves[1], [0.5, 0.5], g)];
    }
    case 'feature': {
      const [top, bottom] = rows(area, [cut[1], 1 - cut[1]], g);
      return [top, ...cols(bottom, [0.5, 0.5], g)];
    }
    default:
      return [area];
  }
}
