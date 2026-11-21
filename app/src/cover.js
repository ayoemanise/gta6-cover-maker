// Renders the cover: the sky and panels with their graded photo crops, then the bold caption
// lettering with its tagline, the finishes (halftone, grain) and, in the editor, the selection
// ring. The same function paints the live preview and the exported PNG, so what you see is
// exactly what you get.

import { layoutPanels } from './templates.js';
import { drawSky, drawSun, drawStars, drawPalms, drawGrain, drawHalftone } from './art.js';

// One sunset palette per panel, cycled in panel order, so neighbours always contrast.
export const PANEL_TINTS = [
  { name: 'sunset', top: '#ff8a3d', bottom: '#e6368f' },
  { name: 'lagoon', top: '#37c9c0', bottom: '#5b2bb8' },
  { name: 'gold', top: '#ffc25e', bottom: '#c42db0' },
  { name: 'flamingo', top: '#ff5e7d', bottom: '#3c1f95' },
];

export const TITLE_FONT = 'Anton, sans-serif';
export const TAGLINE_FONT = '"Archivo Black", sans-serif';

/** Greedy word wrap against `maxW` with the context's current font; returns the lines. */
function wrapWords(ctx, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxW || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Fits the caption into the canvas: shrink the Anton title (wrapped to at most two lines) until it
 * and the tagline fit the space the caption mode gives them. Returns the band height for 'band'
 * mode plus every number the lettering pass needs.
 */
export function captionMetrics(ctx, state, W, H) {
  const title = (state.caption ?? '').trim().toUpperCase();
  const tagline = (state.tagline ?? '').trim().toUpperCase();
  const mode = state.captionMode; // filled in below per template
  if (!title && !tagline) return { mode, bandH: 0, lines: [], size: 0, tagSize: 0 };

  const lineGap = 0.06; // fraction of title size between wrapped lines
  const tagScale = 0.22; // tagline size relative to title size
  let size = 0;
  let lines = [];

  if (mode === 'band') {
    const maxBand = 0.32 * H;
    for (let s = 0.16 * H; s >= 0.045 * H; s -= Math.max(2, s * 0.02)) {
      ctx.font = `${s}px ${TITLE_FONT}`;
      lines = wrapWords(ctx, title, 0.9 * W);
      if (lines.length > 2) continue;
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 0);
      if (widest > 0.9 * W) continue;
      const tagH = tagline ? s * tagScale * 2.1 : 0;
      const content = lines.length * s * (1 + lineGap) + tagH;
      if (content + s * 0.5 <= maxBand) {
        size = s;
        break;
      }
    }
    if (!size) size = 0.045 * H;
  } else {
    const maxZone = 0.4 * H;
    for (let s = 0.14 * H; s >= 0.04 * H; s -= Math.max(2, s * 0.02)) {
      ctx.font = `${s}px ${TITLE_FONT}`;
      lines = wrapWords(ctx, title, 0.92 * W);
      if (lines.length > 2) continue;
      const tagH = tagline ? s * tagScale * 2.2 : 0;
      if (lines.length * s * (1 + lineGap) + tagH <= maxZone) {
        size = s;
        break;
      }
    }
    if (!size) size = 0.04 * H;
  }

  let tagSize = Math.max(13, size * tagScale);
  // the tagline stays on one line: scale it down until it fits the poster width with a margin
  if (tagline) {
    for (;;) {
      ctx.font = `${tagSize}px ${TAGLINE_FONT}`;
      ctx.letterSpacing = `${tagSize * 0.34}px`;
      const width = ctx.measureText(tagline).width;
      if (width <= 0.92 * W || tagSize <= 9) break;
      tagSize = Math.max(9, tagSize * ((0.92 * W) / width) * 0.96);
    }
    ctx.letterSpacing = '0px'; // leave the measuring context clean for everything else
  }
  // the fallback sizes were never wrapped at their own size — re-wrap there and keep it to three
  if (!lines.length || lines.length > 2) {
    ctx.font = `${size}px ${TITLE_FONT}`;
    lines = wrapWords(ctx, title, mode === 'band' ? 0.9 * W : 0.92 * W).slice(0, 3);
  }
  const titleH = lines.length * size * (1 + lineGap);
  const bandH = mode === 'band' && (title || tagline)
    ? Math.min(0.32 * H, titleH + (tagline ? tagSize * 2.1 : 0) + size * 0.5)
    : 0;
  return { mode, bandH, lines, size, tagSize };
}

/** Panel rectangles for this state at canvas size W × H — used by the editor for hit testing. */
export function panelRects(state, W, H) {
  const probe = document.createElement('canvas').getContext('2d');
  const { bandH } = captionMetrics(probe, { ...state, captionMode: state.template.caption }, W, H);
  return layoutPanels(state.template.id, W, H, bandH);
}

/** The grade that turns a photo into a Vice-style panel: duotone washes and a sunset foot. */
function applyGrade(ctx, rect, tint, grade, duotone) {
  const { x, y, w, h } = rect;
  if (duotone) {
    const duo = ctx.createLinearGradient(0, y, 0, y + h);
    duo.addColorStop(0, tint.top);
    duo.addColorStop(1, tint.bottom);
    ctx.globalCompositeOperation = 'color';
    ctx.globalAlpha = Math.min(1, 0.3 + 0.7 * grade);
    ctx.fillStyle = duo;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.4 * grade;
    ctx.fillStyle = duo;
    ctx.fillRect(x, y, w, h);
  } else {
    const wash = ctx.createLinearGradient(0, y, 0, y + h);
    wash.addColorStop(0, tint.top);
    wash.addColorStop(1, tint.bottom);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.8 * grade;
    ctx.fillStyle = wash;
    ctx.fillRect(x, y, w, h);
  }
  // the shared sunset foot: hot pink burning in from the bottom of every panel
  const foot = ctx.createLinearGradient(0, y + h * 0.4, 0, y + h);
  foot.addColorStop(0, 'rgba(255, 62, 154, 0)');
  foot.addColorStop(1, 'rgba(190, 24, 120, 0.85)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.55 * grade;
  ctx.fillStyle = foot;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

/** A soft dark vignette pressed into the panel edges. */
function applyVignette(ctx, rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const inner = Math.min(rect.w, rect.h) * 0.45;
  const outer = Math.hypot(rect.w, rect.h) / 2;
  const vig = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  vig.addColorStop(0, 'rgba(16, 4, 30, 0)');
  vig.addColorStop(1, 'rgba(16, 4, 30, 0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** The empty-slot card shown where no photo has been placed yet. */
function drawEmptySlot(ctx, rect) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = 'rgba(255, 227, 242, 0.7)';
  ctx.lineWidth = Math.max(2, rect.h * 0.012);
  ctx.beginPath();
  ctx.arc(rect.x + rect.w / 2, rect.y + rect.h * 0.42, rect.h * 0.14, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const y = rect.y + rect.h * 0.42 + rect.h * 0.14 + i * rect.h * 0.022;
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.w / 2 - rect.h * 0.1, y);
    ctx.lineTo(rect.x + rect.w / 2 + rect.h * 0.1, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#ffe3f2';
  ctx.font = `${Math.max(12, rect.h * 0.07)}px ${TAGLINE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PICK A PHOTO', rect.x + rect.w / 2, rect.y + rect.h * 0.78);
  ctx.restore();
}

/** One panel: the photo cropped to it, the grade, the finishes, and the separating keyline. */
function drawPanel(ctx, rect, panel, photo, tint, state, W) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const base = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  base.addColorStop(0, tint.top);
  base.addColorStop(1, tint.bottom);
  ctx.fillStyle = base;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (photo) {
    // cover-fit scaled by the panel's zoom, nudged by its crop offsets (fractions of the panel)
    const fit = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight);
    const s = fit * panel.zoom;
    const dw = photo.naturalWidth * s;
    const dh = photo.naturalHeight * s;
    const dx = rect.x + (rect.w - dw) / 2 + panel.ox * rect.w;
    const dy = rect.y + (rect.h - dh) / 2 + panel.oy * rect.h;
    ctx.drawImage(photo, dx, dy, dw, dh);
    applyGrade(ctx, rect, tint, state.grade, state.duotone);
    applyVignette(ctx, rect);
    if (state.halftone) drawHalftone(ctx, rect, Math.min(1, state.grade + 0.2));
  } else {
    drawEmptySlot(ctx, rect);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(12, 5, 26, 0.85)';
  ctx.lineWidth = Math.max(2, W * 0.0032);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

/** One title line: heavy dark outline, drop shadow, then the sunset-gradient fill. */
function drawTitleLine(ctx, line, cx, baseline, size) {
  ctx.save();
  ctx.font = `${size}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${-size * 0.012}px`;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = '#12051f';
  ctx.lineWidth = size * 0.17;
  ctx.shadowColor = 'rgba(8, 2, 20, 0.6)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.07;
  ctx.strokeText(line, cx, baseline);
  ctx.shadowColor = 'transparent';
  const grad = ctx.createLinearGradient(0, baseline - size * 0.8, 0, baseline + size * 0.06);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.7, '#fff2f9');
  grad.addColorStop(1, '#ffcdeb');
  ctx.fillStyle = grad;
  ctx.fillText(line, cx, baseline);
  ctx.restore();
}

/** The tagline: small, wide-tracked Archivo Black in warm gold under (or above) the title. */
function drawTagline(ctx, text, cx, baseline, size) {
  ctx.save();
  ctx.font = `${size}px ${TAGLINE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const track = size * 0.34;
  ctx.letterSpacing = `${track}px`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#12051f';
  ctx.lineWidth = size * 0.16;
  ctx.shadowColor = 'rgba(8, 2, 20, 0.5)';
  ctx.shadowBlur = size * 0.5;
  ctx.shadowOffsetY = size * 0.12;
  const x = cx - track / 2; // re-centre: the trailing tracking space pulls the glyphs left
  ctx.strokeText(text, x, baseline);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(text, x, baseline);
  ctx.restore();
}

/** The whole lettering pass: band or scrim, title, tagline. */
function drawCaption(ctx, W, H, m, state) {
  const title = (state.caption ?? '').trim().toUpperCase();
  const tagline = (state.tagline ?? '').trim().toUpperCase();
  if (!title && !tagline) return;
  if (m.mode === 'band') {
    const bandTop = H - m.bandH;
    const band = ctx.createLinearGradient(0, bandTop, 0, H);
    band.addColorStop(0, 'rgba(22, 7, 44, 0.88)');
    band.addColorStop(1, 'rgba(64, 11, 84, 0.92)');
    ctx.fillStyle = band;
    ctx.fillRect(0, bandTop, W, m.bandH);
    const rim = ctx.createLinearGradient(0, 0, W, 0);
    rim.addColorStop(0, 'rgba(255, 110, 196, 0)');
    rim.addColorStop(0.5, 'rgba(255, 138, 61, 0.9)');
    rim.addColorStop(1, 'rgba(255, 110, 196, 0)');
    ctx.fillStyle = rim;
    ctx.fillRect(0, bandTop, W, Math.max(2, W * 0.003));
  } else {
    const scrim = ctx.createLinearGradient(0, H * 0.55, 0, H);
    scrim.addColorStop(0, 'rgba(16, 5, 34, 0)');
    scrim.addColorStop(0.62, 'rgba(16, 5, 34, 0.55)');
    scrim.addColorStop(1, 'rgba(12, 3, 26, 0.85)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);
  }

  if (state.art) drawPalms(ctx, W, H);

  const titleH = m.lines.length * m.size * 1.06;
  const cx = W / 2;
  if (m.mode === 'band') {
    const top = H - m.bandH + m.size * 0.22;
    m.lines.forEach((line, i) => drawTitleLine(ctx, line, cx, top + i * m.size * 1.06 + m.size * 0.8, m.size));
    if (tagline) drawTagline(ctx, tagline, cx, top + titleH + m.tagSize * 1.35, m.tagSize);
  } else {
    const bottom = H - 0.045 * H;
    if (tagline) drawTagline(ctx, tagline, cx, bottom - titleH - m.tagSize * 0.9, m.tagSize);
    const titleTop = bottom - titleH - (tagline ? m.tagSize * 1.7 : 0);
    m.lines.forEach((line, i) => drawTitleLine(ctx, line, cx, titleTop + i * m.size * 1.06 + m.size * 0.8, m.size));
  }
}

/** The dashed ring and corner handles marking the selected panel in the editor preview. */
function drawSelection(ctx, rect, W) {
  ctx.save();
  const k = W / 1080;
  ctx.strokeStyle = '#ff7ad9';
  ctx.lineWidth = 4 * k;
  ctx.setLineDash([16 * k, 10 * k]);
  ctx.shadowColor = 'rgba(255, 122, 217, 0.8)';
  ctx.shadowBlur = 10 * k;
  ctx.strokeRect(rect.x + 2 * k, rect.y + 2 * k, rect.w - 4 * k, rect.h - 4 * k);
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  const hs = 11 * k;
  for (const [hx, hy] of [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h],
  ]) {
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    ctx.strokeStyle = 'rgba(18, 5, 31, 0.9)';
    ctx.lineWidth = 2 * k;
    ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }
  ctx.restore();
}

/**
 * Paints `state` onto `canvas`. opts: { selected: panel index for the editor ring, preview: true }
 * — the preview shows the ring, the export does not, and nothing else differs.
 */
export function renderCover(canvas, state, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const template = state.template;
  const m = captionMetrics(ctx, { ...state, captionMode: template.caption }, W, H);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);

  if (state.art) {
    drawSky(ctx, W, H);
    drawSun(ctx, W * 0.5, H * 0.16, W * 0.08);
    drawStars(ctx, W, H);
  } else {
    ctx.fillStyle = '#170a38';
    ctx.fillRect(0, 0, W, H);
  }

  const rects = layoutPanels(state.template.id, W, H, m.bandH);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] ?? { photo: null, zoom: 1, ox: 0, oy: 0 };
    const photo = panel.photo == null ? null : state.photos[panel.photo]?.img ?? null;
    drawPanel(ctx, rect, panel, photo, PANEL_TINTS[i % PANEL_TINTS.length], state, W);
  });

  drawCaption(ctx, W, H, m, state);
  if (state.grain) drawGrain(ctx, W, H, Math.min(1, state.grade + 0.15));

  // a thin light keyline around the whole poster
  ctx.strokeStyle = 'rgba(255, 240, 250, 0.25)';
  ctx.lineWidth = Math.max(2, W * 0.0035);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);

  if (opts.preview && opts.selected != null && rects[opts.selected]) {
    drawSelection(ctx, rects[opts.selected], W);
  }
}
