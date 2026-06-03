#!/usr/bin/env node
/**
 * Generates netcall-ripple.session.json for ascii-motion.
 *
 * Design:
 *   - 160×45 canvas (16:9 with char-cell aspect correction)
 *   - Dark navy tiled wall: left side darker, right side brighter (depth/angle cue)
 *   - Square Chebyshev-distance ripple waves, two half-period-offset rings, looping
 *   - NETCALL block-font logo centered, white on dark plate
 */

'use strict';
const fs = require('fs');

// ─── Canvas / Timeline ───────────────────────────────────────────────────────
const W = 160, H = 45;
const FPS = 24, TOTAL_FRAMES = 72; // 3s loop

// ─── Netcall Brand Colors ────────────────────────────────────────────────────
const C = {
  bg:         '#04091A',
  gridMid:    '#1A3A7A',
  gridBright: '#2962CC',
  panelDark:  '#060D24',
  panelMid:   '#0D2260',
  panelLit:   '#1442B5',
  panelPeak:  '#2D6EFF',
  panelGlow:  '#5B9EFF',
  panelWhite: '#A8CEFF',
  logoFg:     '#FFFFFF',
  logoGlow:   '#7EC8FF',
  logoAccent: '#1442B5',
  logoBg:     '#04091A',
};

// ─── Grid Layout (8×5 panels, 20 cols × 9 rows = 160×45) ─────────────────────
const PANEL_W = 8, PANEL_H = 5;
const COLS = 20, ROWS = 9;
const CX = (COLS - 1) / 2; // 9.5
const CY = (ROWS - 1) / 2; // 4.0

// ─── Wave ─────────────────────────────────────────────────────────────────────
const WAVE_PERIOD = 72;  // frames per ripple cycle (= TOTAL_FRAMES → clean loop)
const MAX_DIST    = 11;
const WAVE_WIDTH  = 1.6; // narrow band → fewer panels lit → smaller JSON

function chebyshev(col, row) {
  return Math.max(Math.abs(col - CX), Math.abs(row - CY));
}

function waveIntensity(d, frame) {
  const wf = (frame % WAVE_PERIOD) / WAVE_PERIOD * MAX_DIST;
  let diff = Math.abs(d - wf);
  diff = Math.min(diff, MAX_DIST - diff); // circular wrap
  return Math.max(0, 1 - diff / WAVE_WIDTH);
}

// ─── Block-font letters (5×5 bitmaps) ────────────────────────────────────────
const FONT = {
  N: [[1,0,0,0,1],[1,1,0,0,1],[1,0,1,0,1],[1,0,0,1,1],[1,0,0,0,1]],
  E: [[1,1,1,1,1],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,1,1,1,1]],
  T: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
  C: [[0,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[0,1,1,1,1]],
  A: [[0,1,1,1,0],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1]],
  L: [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
};

// 2×2 pixels per bitmap dot → letter = 10 wide × 10 tall; gap = 2 chars
const LETTER_W = 10, LETTER_H = 10, GAP_W = 2;
const WORD = ['N','E','T','C','A','L','L'];
const LOGO_TOTAL_W = WORD.length * LETTER_W + (WORD.length - 1) * GAP_W; // 82
const LOGO_TOTAL_H = LETTER_H; // 10
const LOGO_X = Math.floor((W - LOGO_TOTAL_W) / 2); // 39
const LOGO_Y = Math.floor((H - LOGO_TOTAL_H) / 2); // 17

// ─── Helpers ─────────────────────────────────────────────────────────────────
function setCell(data, x, y, char, color, bgColor) {
  if (x >= 0 && x < W && y >= 0 && y < H)
    data[`${x},${y}`] = { char, color, bgColor };
}

function cornerChar(col, row) {
  const t = row === 0, b = row === ROWS, l = col === 0, r = col === COLS;
  if (t&&l) return '╔'; if (t&&r) return '╗';
  if (b&&l) return '╚'; if (b&&r) return '╝';
  if (t) return '╦'; if (b) return '╩';
  if (l) return '╠'; if (r) return '╣';
  return '╬';
}

// ─── Grid layer (static) ─────────────────────────────────────────────────────
function buildGrid() {
  const data = {};

  // Panel interiors: left=dark, right=brighter (depth/angle shading)
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const b = col / (COLS - 1);        // 0=left/dark … 1=right/bright
      const color = b < 0.20 ? C.panelDark
                  : b < 0.40 ? C.panelMid
                  : b < 0.60 ? C.panelLit
                  : b < 0.80 ? C.panelPeak
                  :             C.panelGlow;
      const ch    = b < 0.25 ? ' '
                  : b < 0.45 ? '░'
                  : b < 0.65 ? '▒'
                  :             '▓';
      for (let dx = 1; dx < PANEL_W - 1; dx++)
        for (let dy = 1; dy < PANEL_H - 1; dy++)
          setCell(data, col*PANEL_W+dx, row*PANEL_H+dy, ch, color, C.bg);
    }
  }

  // Horizontal grid lines
  for (let row = 0; row <= ROWS; row++) {
    const y = row * PANEL_H;
    for (let x = 0; x < W; x++)
      if (x % PANEL_W !== 0)
        setCell(data, x, y, '═', C.gridMid, C.bg);
  }

  // Vertical grid lines
  for (let col = 0; col <= COLS; col++) {
    const x = col * PANEL_W;
    for (let y = 0; y < H; y++)
      if (y % PANEL_H !== 0)
        setCell(data, x, y, '║', C.gridMid, C.bg);
  }

  // Intersections / corners
  for (let row = 0; row <= ROWS; row++)
    for (let col = 0; col <= COLS; col++)
      setCell(data, col*PANEL_W, row*PANEL_H, cornerChar(col,row), C.gridBright, C.bg);

  return data;
}

// ─── Ripple frame (overlay, transparent bg) ───────────────────────────────────
function buildRippleFrame(frame) {
  const data = {};

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const d = chebyshev(col, row);
      const v = waveIntensity(d, frame);
      if (v < 0.12) continue;

      const color = v < 0.25 ? C.panelMid
                  : v < 0.45 ? C.panelLit
                  : v < 0.65 ? C.panelPeak
                  : v < 0.82 ? C.panelGlow
                  :             C.panelWhite;
      const ch    = v < 0.25 ? '░'
                  : v < 0.50 ? '▒'
                  : v < 0.75 ? '▓'
                  :             '█';

      // Only fill interior (keeps JSON small; borders come from grid layer)
      for (let dx = 1; dx < PANEL_W - 1; dx++)
        for (let dy = 1; dy < PANEL_H - 1; dy++)
          setCell(data, col*PANEL_W+dx, row*PANEL_H+dy, ch, color, 'transparent');
    }
  }

  return data;
}

// ─── Logo layer (static) ─────────────────────────────────────────────────────
function buildLogo() {
  const data = {};

  // Dark plate behind logo
  for (let x = LOGO_X - 2; x < LOGO_X + LOGO_TOTAL_W + 2; x++)
    for (let y = LOGO_Y - 2; y < LOGO_Y + LOGO_TOTAL_H + 2; y++)
      setCell(data, x, y, ' ', C.logoFg, C.logoBg);

  // Subtle glow border (1 cell outside plate)
  for (let x = LOGO_X - 3; x < LOGO_X + LOGO_TOTAL_W + 3; x++) {
    setCell(data, x, LOGO_Y - 3, '▄', C.logoGlow, 'transparent');
    setCell(data, x, LOGO_Y + LOGO_TOTAL_H + 2, '▀', C.logoGlow, 'transparent');
  }
  for (let y = LOGO_Y - 3; y <= LOGO_Y + LOGO_TOTAL_H + 2; y++) {
    setCell(data, LOGO_X - 3, y, '▌', C.logoGlow, 'transparent');
    setCell(data, LOGO_X + LOGO_TOTAL_W + 2, y, '▐', C.logoGlow, 'transparent');
  }

  // Letter pixels (2×2 per bitmap dot)
  WORD.forEach((letter, li) => {
    const lx = LOGO_X + li * (LETTER_W + GAP_W);
    const bitmap = FONT[letter];
    for (let py = 0; py < 5; py++)
      for (let px = 0; px < 5; px++) {
        if (!bitmap[py][px]) continue;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++)
            setCell(data, lx + px*2 + dx, LOGO_Y + py*2 + dy, '█', C.logoFg, 'transparent');
      }
  });

  // Tagline
  const tag = 'CUSTOMER ENGAGEMENT PLATFORM';
  const tx = Math.floor((W - tag.length) / 2);
  const ty = LOGO_Y + LOGO_TOTAL_H + 2;
  for (let i = 0; i < tag.length; i++)
    setCell(data, tx + i, ty, tag[i], C.logoGlow, 'transparent');

  return data;
}

// ─── Assemble session ─────────────────────────────────────────────────────────
const gridData   = buildGrid();
const logoData   = buildLogo();
const rippleContent = [];

for (let f = 0; f < TOTAL_FRAMES; f++) {
  rippleContent.push({
    id: `cf-r-${f}`,
    name: `f${f}`,
    startFrame: f,
    durationFrames: 1,
    data: buildRippleFrame(f),
  });
}

const mkLayer = (id, name, frames, extra = {}) => ({
  id, name,
  visible: true, solo: false, locked: false, opacity: 100,
  contentFrames: frames,
  propertyTracks: [],
  staticProperties: {
    'transform.anchorPoint.x': Math.floor(W / 2),
    'transform.anchorPoint.y': Math.floor(H / 2),
  },
  effectTracks: [],
  ...extra,
});

const session = {
  version: '2.1.0',
  name: 'Netcall Ripple Wall',
  description: 'Netcall brand animation — square ripple panel wall',
  metadata: { exportedAt: new Date().toISOString(), exportVersion: '2.1.0' },
  canvas: { width: W, height: H, canvasBackgroundColor: C.bg, showGrid: false },
  timeline: { frameRate: FPS, durationFrames: TOTAL_FRAMES, looping: true },
  layers: [
    mkLayer('layer-grid',   'Wall Grid',    [{ id:'cf-grid', name:'Grid', startFrame:0, durationFrames:TOTAL_FRAMES, data:gridData }]),
    mkLayer('layer-ripple', 'Ripple',       rippleContent),
    mkLayer('layer-logo',   'Netcall Logo', [{ id:'cf-logo', name:'Logo', startFrame:0, durationFrames:TOTAL_FRAMES, data:logoData }]),
  ],
  layerGroups: [],
  globalEffects: [],
  postEffectTracks: [],
};

// Compact JSON output
const out = 'netcall-ripple.session.json';
fs.writeFileSync(out, JSON.stringify(session));

const totalCells = Object.keys(gridData).length
  + Object.keys(logoData).length
  + rippleContent.reduce((s,f) => s + Object.keys(f.data).length, 0);

const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`Written ${out}  (${kb} KB)`);
console.log(`  ${W}×${H} canvas  |  ${TOTAL_FRAMES} frames @ ${FPS} fps`);
console.log(`  Grid cells: ${Object.keys(gridData).length.toLocaleString()}`);
console.log(`  Logo cells: ${Object.keys(logoData).length.toLocaleString()}`);
console.log(`  Ripple cells total: ${rippleContent.reduce((s,f) => s + Object.keys(f.data).length, 0).toLocaleString()}`);
console.log(`  Grand total: ${totalCells.toLocaleString()}`);
