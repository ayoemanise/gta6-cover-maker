// The editor: wires the page to the cover renderer. Load photos, pick a template and a post size,
// click a panel to select it, drag to move its crop, wheel or slide to zoom, type the caption, and
// export the PNG. A `?shot=` query instead stages a fixed scene for a screenshot (./shots.js).

import { SIZES, TEMPLATES, getTemplate } from './templates.js';
import { layoutPanels } from './templates.js';
import { renderCover, panelRects } from './cover.js';
import { loadPhotoFiles, loadImage, makeThumb } from './photos.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover-canvas');
const photoInput = document.getElementById('photo-input');
const photoStrip = document.getElementById('photo-strip');
const captionInput = document.getElementById('caption-input');
const taglineInput = document.getElementById('tagline-input');
const templateSelect = document.getElementById('template-select');
const sizeSelect = document.getElementById('size-select');
const gradeSlider = document.getElementById('grade-slider');
const panelZoom = document.getElementById('panel-zoom');
const panelInfo = document.getElementById('panel-info');
const statusLine = document.getElementById('status-line');

const state = {
  template: getTemplate('mosaic-side'),
  sizeId: 'square',
  caption: 'PALM CITY',
  tagline: 'STORIES FROM THE NEON COAST',
  grade: 0.8,
  duotone: true,
  halftone: true,
  grain: true,
  art: true,
  photos: [], // [{ img, name }] — loaded from the person's own files
  panels: [], // per-panel: { photo: index | null, zoom, ox, oy } — ox/oy are fractions of the panel
  selected: 0,
  activePhoto: 0, // which strip thumbnail a click on an empty panel will place
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const defaultPanel = () => ({ photo: null, zoom: 1, ox: 0, oy: 0 });

/** Grows or shrinks the panel list to match the template's panel count, keeping crops by index. */
function ensurePanels() {
  const probe = layoutPanels(state.template.id, 1080, 1080, 216);
  const next = [];
  for (let i = 0; i < probe.length; i++) next.push(state.panels[i] ?? defaultPanel());
  state.panels = next;
  state.selected = clamp(state.selected, 0, next.length - 1);
}

function redraw() {
  renderCover(canvas, state, { preview: true, selected: state.selected });
  syncPanelControls();
}

/** Reflects the selected panel's crop in the zoom slider and the info line. */
function syncPanelControls() {
  const panel = state.panels[state.selected];
  if (!panel) return;
  panelZoom.value = panel.zoom;
  const photo = panel.photo == null ? null : state.photos[panel.photo];
  const name = photo ? photo.name : 'empty — click a thumbnail, then this panel';
  panelInfo.textContent = `Panel ${state.selected + 1} of ${state.panels.length}: ${name}`;
}

/** Keeps a crop inside its photo: the image must always cover its panel. */
function clampCrop(panel, rect, photo) {
  const fit = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight) * panel.zoom;
  const slackX = Math.max(0, (fit * photo.naturalWidth - rect.w) / 2);
  const slackY = Math.max(0, (fit * photo.naturalHeight - rect.h) / 2);
  panel.ox = clamp(panel.ox, -slackX / rect.w, slackX / rect.w);
  panel.oy = clamp(panel.oy, -slackY / rect.h, slackY / rect.h);
}

function setSize(sizeId) {
  const size = SIZES[sizeId];
  if (!size) return;
  state.sizeId = sizeId;
  canvas.width = size.w;
  canvas.height = size.h;
  redraw();
}

function setTemplate(id) {
  state.template = getTemplate(id);
  ensurePanels();
  redraw();
}

/** Appends loaded photos, rebuilds the strip, and fills any empty panels with them in turn. */
async function addPhotos(files) {
  const loaded = await loadPhotoFiles(files);
  if (!loaded.length) return;
  const first = state.photos.length;
  state.photos.push(...loaded);
  state.activePhoto = first;
  rebuildStrip();
  let seen = 0;
  state.panels.forEach((panel) => {
    if (panel.photo == null) panel.photo = first + (seen++ % loaded.length);
  });
  redraw();
}

/** One cover-cropped thumbnail per photo; the active one is lit up. */
function rebuildStrip() {
  photoStrip.replaceChildren();
  state.photos.forEach((photo, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = i === state.activePhoto ? 'thumb active' : 'thumb';
    button.title = photo.name;
    button.appendChild(makeThumb(photo.img, 64));
    button.addEventListener('click', () => {
      state.activePhoto = i;
      rebuildStrip();
    });
    photoStrip.appendChild(button);
  });
}

// --- pointer interaction on the preview: click to select and place, drag to pan, wheel to zoom ---

let drag = null;

function canvasPoint(e) {
  const k = canvas.width / canvas.clientWidth;
  return { x: (e.clientX - canvas.getBoundingClientRect().left) * k, y: (e.clientY - canvas.getBoundingClientRect().top) * k };
}

function panelAt(x, y) {
  const rects = panelRects(state, canvas.width, canvas.height);
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = canvasPoint(e);
  const hit = panelAt(x, y);
  if (hit === -1) return;
  state.selected = hit;
  const panel = state.panels[hit];
  if (panel.photo == null && state.photos.length) panel.photo = clamp(state.activePhoto, 0, state.photos.length - 1);
  drag = { hit, x, y };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { x, y } = canvasPoint(e);
  const panel = state.panels[drag.hit];
  const photo = panel.photo == null ? null : state.photos[panel.photo];
  if (!photo) return;
  const rects = panelRects(state, canvas.width, canvas.height);
  const rect = rects[drag.hit];
  panel.ox += (x - drag.x) / rect.w;
  panel.oy += (y - drag.y) / rect.h;
  clampCrop(panel, rect, photo);
  drag.x = x;
  drag.y = y;
  redraw();
});

canvas.addEventListener('pointerup', () => {
  drag = null;
});

canvas.addEventListener('wheel', (e) => {
  const { x, y } = canvasPoint(e);
  const hit = panelAt(x, y);
  if (hit === -1) return;
  e.preventDefault();
  state.selected = hit;
  const panel = state.panels[hit];
  const photo = panel.photo == null ? null : state.photos[panel.photo];
  if (!photo) return;
  panel.zoom = clamp(panel.zoom * Math.exp(-e.deltaY * 0.0016), 1, 4);
  const rects = panelRects(state, canvas.width, canvas.height);
  clampCrop(panel, rects[hit], photo);
  redraw();
}, { passive: false });

// --- control wiring ---

photoInput.addEventListener('change', async () => {
  await addPhotos(photoInput.files);
  photoInput.value = ''; // allow re-picking the same file later
});

document.getElementById('fill-panels').addEventListener('click', () => {
  if (!state.photos.length) return;
  state.panels.forEach((panel, i) => {
    panel.photo = i % state.photos.length;
  });
  redraw();
});

document.getElementById('clear-panel').addEventListener('click', () => {
  state.panels[state.selected].photo = null;
  redraw();
});

captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  redraw();
});

taglineInput.addEventListener('input', () => {
  state.tagline = taglineInput.value;
  redraw();
});

templateSelect.addEventListener('change', () => setTemplate(templateSelect.value));
sizeSelect.addEventListener('change', () => setSize(sizeSelect.value));

gradeSlider.addEventListener('input', () => {
  state.grade = Number(gradeSlider.value);
  redraw();
});

for (const id of ['duotone-toggle', 'halftone-toggle', 'grain-toggle', 'art-toggle']) {
  const key = id.replace('-toggle', '');
  document.getElementById(id).addEventListener('change', (e) => {
    state[key] = e.target.checked;
    redraw();
  });
}

panelZoom.addEventListener('input', () => {
  const panel = state.panels[state.selected];
  const photo = panel.photo == null ? null : state.photos[panel.photo];
  if (!photo) return;
  panel.zoom = Number(panelZoom.value);
  const rects = panelRects(state, canvas.width, canvas.height);
  clampCrop(panel, rects[state.selected], photo);
  redraw();
});

document.getElementById('panel-reset').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  const photo = panel.photo == null ? null : state.photos[panel.photo];
  if (photo) clampCrop(panel, panelRects(state, canvas.width, canvas.height)[state.selected], photo);
  redraw();
});

document.getElementById('export-button').addEventListener('click', () => {
  const size = SIZES[state.sizeId];
  const out = document.createElement('canvas');
  out.width = size.w;
  out.height = size.h;
  renderCover(out, state, { preview: false });
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = size.file;
    a.click();
    statusLine.textContent = `Saved ${size.file}`;
  }, 'image/png');
});

// --- start-up: fill the selects, wait for the two poster fonts, paint the empty board ---

for (const t of TEMPLATES) {
  const option = document.createElement('option');
  option.value = t.id;
  option.textContent = t.name;
  templateSelect.appendChild(option);
}
templateSelect.value = state.template.id;

for (const s of Object.values(SIZES)) {
  const option = document.createElement('option');
  option.value = s.id;
  option.textContent = s.label;
  sizeSelect.appendChild(option);
}
sizeSelect.value = state.sizeId;

ensurePanels();
setSize(state.sizeId);

// repaint once the two poster fonts are in, so the lettering never shows in a fallback face
Promise.all([
  document.fonts.load('100px Anton'),
  document.fonts.load('100px "Archivo Black"'),
]).then(redraw).catch(redraw);

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  // screenshot scenes take the wheel: they load samples, set the caption and paint (./shots.js)
  runShot(shot, params, {
    state,
    canvas,
    setSize,
    setTemplate,
    addPhotosFromUrls: async (urls) => {
      const photos = [];
      for (const url of urls) {
        const img = await loadImage(url);
        photos.push({ img, name: url.split('/').pop() });
      }
      state.photos.push(...photos);
      rebuildStrip();
    },
    ready: () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.__shotReady = true;
      }));
      // rAF never fires in an occluded window — land the flag on a timer too
      setTimeout(() => {
        window.__shotReady = true;
      }, 400);
    },
  });
}
