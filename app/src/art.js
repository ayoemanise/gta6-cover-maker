// Decorative cover art drawn in canvas: the sunset sky, the slatted sun disc, palm silhouettes,
// star sparkles, and the texture tiles (film grain, halftone dots). Everything is drawn here from
// scratch — original art, no borrowed assets — and seeded so a render is identical every time.

/** Small seeded PRNG so stars and grain are the same in the preview and the exported PNG. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The dusk sky the whole cover sits on, visible in the frame margin and behind the caption band. */
export function drawSky(ctx, W, H) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#170a38');
  sky.addColorStop(0.42, '#4b1668');
  sky.addColorStop(0.68, '#a12a6e');
  sky.addColorStop(0.86, '#f0562f');
  sky.addColorStop(1, '#ffb03a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // a soft glow low on the horizon, as if the sun had just set behind the panels
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.78, 0, W * 0.5, H * 0.78, W * 0.75);
  glow.addColorStop(0, 'rgba(255, 154, 61, 0.35)');
  glow.addColorStop(1, 'rgba(255, 154, 61, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

/** The synthwave sun: a gradient disc with horizontal slats eaten out of its lower half. */
export function drawSun(ctx, cx, cy, r) {
  const layer = document.createElement('canvas');
  layer.width = Math.ceil(r * 2);
  layer.height = Math.ceil(r * 2);
  const lc = layer.getContext('2d');
  const disc = lc.createRadialGradient(r, r * 0.72, r * 0.1, r, r, r);
  disc.addColorStop(0, '#ffe9a0');
  disc.addColorStop(0.45, '#ffb347');
  disc.addColorStop(0.78, '#ff6a5e');
  disc.addColorStop(1, '#f23d9c');
  lc.fillStyle = disc;
  lc.beginPath();
  lc.arc(r, r, r, 0, Math.PI * 2);
  lc.fill();
  // slats: stripes across the lower half, thicker and wider apart toward the bottom
  lc.globalCompositeOperation = 'destination-out';
  let y = r * 1.02;
  let gap = r * 0.055;
  let thick = r * 0.045;
  while (y < 2 * r) {
    lc.fillRect(0, y, 2 * r, thick);
    y += thick + gap;
    gap *= 1.35;
    thick *= 1.18;
  }
  ctx.save();
  ctx.shadowColor = 'rgba(255, 122, 61, 0.55)';
  ctx.shadowBlur = r * 0.35;
  ctx.drawImage(layer, cx - r, cy - r);
  ctx.restore();
}

/** One four-point sparkle. */
export function drawStar(ctx, x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r);
  ctx.fill();
  ctx.restore();
}

/** A scatter of sparkles across the upper sky, fixed by seed. */
export function drawStars(ctx, W, H) {
  const rand = mulberry32(20261121);
  for (let i = 0; i < 16; i++) {
    const x = rand() * W;
    const y = rand() * H * 0.3;
    drawStar(ctx, x, y, W * (0.0016 + rand() * 0.0038), '#ffe3f2', 0.35 + rand() * 0.5);
  }
}

/**
 * A palm silhouette. The trunk leans by `lean` (−1 … 1); fronds sweep out of the crown as tapered
 * crescents. Drawn from the base point (x, y) upward with height h, all in one flat colour.
 */
export function drawPalm(ctx, x, y, h, lean, color) {
  ctx.save();
  ctx.fillStyle = color;
  // trunk: a tapered curve from base to crown
  const bend = lean * h * 0.32;
  const crownX = x + bend;
  const crownY = y - h;
  ctx.beginPath();
  ctx.moveTo(x - h * 0.028, y);
  ctx.quadraticCurveTo(x + bend * 0.45, y - h * 0.55, crownX - h * 0.012, crownY);
  ctx.lineTo(crownX + h * 0.02, crownY);
  ctx.quadraticCurveTo(x + bend * 0.55, y - h * 0.5, x + h * 0.03, y);
  ctx.closePath();
  ctx.fill();
  // fronds: eight arcs falling out of the crown, each a thin crescent
  const fronds = 8;
  for (let i = 0; i < fronds; i++) {
    const angle = Math.PI * (0.08 + (i / (fronds - 1)) * 0.84);
    const reach = h * (0.34 + (i % 3) * 0.05);
    const tipX = crownX + Math.cos(angle) * reach * (i < fronds / 2 ? 1 : 1);
    const tipY = crownY - Math.sin(angle) * reach * 0.62;
    const drop = reach * 0.42;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(crownX + (tipX - crownX) * 0.5, tipY - drop * 0.55, tipX, tipY);
    ctx.quadraticCurveTo(crownX + (tipX - crownX) * 0.5, tipY + drop * 0.45, crownX, crownY + h * 0.015);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The two palms that frame the caption: one at each lower corner, leaning inward. */
export function drawPalms(ctx, W, H) {
  const color = '#1a0a2e';
  drawPalm(ctx, W * 0.055, H * 1.01, H * 0.3, 0.55, color);
  drawPalm(ctx, W * 0.945, H * 1.01, H * 0.24, -0.5, color);
}

let grainTile = null;
let halftoneTile = null;

/** A reusable noise tile for the film-grain finish. */
function getGrainTile() {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 160;
  const tc = tile.getContext('2d');
  const image = tc.createImageData(160, 160);
  const rand = mulberry32(99);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 90 + rand() * 130;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  tc.putImageData(image, 0, 0);
  grainTile = tile;
  return tile;
}

/** A reusable dot tile for the halftone finish. */
function getHalftoneTile() {
  if (halftoneTile) return halftoneTile;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 12;
  const tc = tile.getContext('2d');
  tc.fillStyle = 'rgba(20, 6, 34, 0.85)';
  tc.beginPath();
  tc.arc(6, 6, 1.7, 0, Math.PI * 2);
  tc.fill();
  halftoneTile = tile;
  return tile;
}

/** Film grain over the whole cover, mixed into the photo with an overlay blend. */
export function drawGrain(ctx, W, H, strength) {
  if (strength <= 0) return;
  const pattern = ctx.createPattern(getGrainTile(), 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.32 * strength;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Halftone dots clipped to `rect`, printed over a finished panel. */
export function drawHalftone(ctx, rect, strength) {
  if (strength <= 0) return;
  const pattern = ctx.createPattern(getHalftoneTile(), 'repeat');
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.globalAlpha = 0.5 * strength;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = pattern;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}
