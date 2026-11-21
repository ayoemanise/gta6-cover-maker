// Fixed scenes for screenshots, driven by the `?shot=` query. Two kinds:
//   ?shot=cover  — the cover alone: the editor UI hides and the canvas fills the viewport.
//                  `size` (square | tall | wide) picks a post size; `w`/`h` override the canvas
//                  pixel size; `template`, `photos`, `caption`, `tagline`, `grade` stage the scene.
//   ?shot=editor — the full editor with sample photos loaded into the panels.
// `window.__shotReady` is set once everything has painted, so the screenshot waits for it.
// The photos here are the kit's own CC0 samples (app/samples/), free to use.

const SAMPLES = {
  pier: 'samples/pier.jpg',
  boulevard: 'samples/boulevard.jpg',
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export async function runShot(shot, params, app) {
  const { state } = app;
  const caption = params.get('caption');
  if (caption != null) {
    state.caption = caption;
    document.getElementById('caption-input').value = caption;
  }
  const tagline = params.get('tagline');
  if (tagline != null) {
    state.tagline = tagline;
    document.getElementById('tagline-input').value = tagline;
  }
  const grade = Number(params.get('grade'));
  if (grade > 0) {
    state.grade = clamp(grade, 0, 1);
    document.getElementById('grade-slider').value = state.grade;
  }
  for (const flag of ['duotone', 'halftone', 'grain', 'art']) {
    const v = params.get(flag);
    if (v != null) {
      state[flag] = v === '1' || v === 'true';
      document.getElementById(`${flag}-toggle`).checked = state[flag];
    }
  }

  if (shot === 'cover') {
    document.body.classList.add('shot');
    const sizeId = params.get('size');
    if (sizeId) app.setSize(sizeId);
    const w = Number(params.get('w'));
    const h = Number(params.get('h'));
    if (w > 0 && h > 0) {
      app.canvas.width = w;
      app.canvas.height = h;
    }
  }

  const templateId = params.get('template');
  if (templateId) app.setTemplate(templateId);

  const names = (params.get('photos') ?? 'pier,boulevard')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  await app.addPhotosFromUrls(names.map((n) => SAMPLES[n] ?? n));

  // fill every panel in turn and give the crops a little variety so the board looks alive
  state.panels.forEach((panel, i) => {
    panel.photo = i % state.photos.length;
    panel.zoom = 1.08 + (i % 3) * 0.14;
    panel.ox = (i % 2 === 0 ? -1 : 1) * 0.018;
    panel.oy = i % 3 === 0 ? 0.02 : -0.014;
  });

  if (shot === 'editor') {
    state.selected = 0;
    state.activePhoto = 0;
    document.getElementById('template-select').value = state.template.id;
    document.getElementById('size-select').value = state.sizeId;
  } else {
    state.selected = null; // a cover scene shows the poster alone — never the selection ring
  }

  await document.fonts.ready;
  app.redraw();
  app.ready();
}
