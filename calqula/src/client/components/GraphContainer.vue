<template>
  <div :class="theme" class="graph-container">
    <!-- Reset -->
    <button @click="resetView" class="reset-btn">
      <span class="material-symbols-outlined">reset_focus</span>
    </button>

    <!-- Drawing surface -->
    <canvas ref="canvasEl"></canvas>

    <!-- Error overlay -->
    <div v-if="errorMessage" class="error-msg">{{ errorMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, type Ref } from 'vue';

// ——— Types ———————————————————————————————————————————————————————
interface GraphConfig {
  funktion: string;
  color?: string;
}
interface PointConfig {
  x: number;
  y: number;
  color?: string;
}
interface Config {
  view: { center: { x: number; y: number }; scale: number };
  graphs: Record<string, GraphConfig>;
  points: Record<string, PointConfig>;
}

enum Theme {
  Dark = 'dark',
  Light = 'light',
}

// ——— Props ———————————————————————————————————————————————————————
const props = defineProps<{ config: Config; theme?: Theme }>();

// ——— Canvas & state ——————————————————————————————————————————————
const canvasEl: Ref<HTMLCanvasElement | null> = ref(null);
const errorMessage = ref<string>('');
let ctx!: CanvasRenderingContext2D;
let width = 0;
let height = 0;

const view = reactive<{ center: { x: number; y: number }; scale: number }>({
  center: { x: 0, y: 0 },
  scale: 10,
});
const graphs = reactive<
  Record<string, { funktion: string; color?: string; assignedColor: string }>
>({});
const points = reactive<
  Record<string, { x: number; y: number; color?: string }>
>({});

const defaultColors = ['red', 'green', 'blue', 'orange', 'purple', 'brown'];
const usedColors = new Set<string>();

type LabelBox = { x: number; y: number; width: number; height: number };
let labelBoxes: LabelBox[] = [];
const candidateOffsets: [number, number][] = [
  [8, -8],
  [8, 8],
  [-8, -8],
  [-8, 8],
  [0, -12],
];

let lastMousePos: { x: number; y: number } | null = null;
let hoverTooltip: { text: string; screenX: number; screenY: number } | null =
  null;
let closestHoverDistance = Infinity;

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let viewStart = {
  center: { x: view.center.x, y: view.center.y },
  scale: view.scale,
};
let lastTouchDist: number | null = null;
let initialConfig: Config | null = null;

// ——— Utility functions —————————————————————————————————————————————
function isOverlap(a: LabelBox, b: LabelBox): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

function drawNonOverlappingLabel(
  x: number,
  y: number,
  text: string,
  offsets: [number, number][] = candidateOffsets,
): void {
  const fw = ctx.measureText(text).width;
  const fh = 12;
  for (const off of offsets) {
    const lx = x + off[0];
    const ly = y + off[1];
    if (lx < 0 || lx + fw > width || ly < 0 || ly + fh > height) continue;
    const box: LabelBox = { x: lx, y: ly, width: fw, height: fh };
    if (!labelBoxes.some((b) => isOverlap(b, box))) {
      labelBoxes.push(box);
      ctx.fillText(text, lx + fw / 2, ly + fh);
      return;
    }
  }
  // Fallback
  const [ox, oy] = offsets[0];
  const lx = Math.max(0, Math.min(width - fw, x + ox));
  const ly = Math.max(0, Math.min(height - fh, y + oy));
  labelBoxes.push({ x: lx, y: ly, width: fw, height: fh });
  ctx.fillText(text, lx + fw / 2, ly + fh);
}

function worldToScreen(x: number, y: number): { x: number; y: number } {
  const sf = width / (2 * view.scale);
  return {
    x: (x - view.center.x) * sf + width / 2,
    y: height / 2 - (y - view.center.y) * sf,
  };
}

function screenToWorld(x: number, y: number): { x: number; y: number } {
  const sf = width / (2 * view.scale);
  return {
    x: (x - width / 2) / sf + view.center.x,
    y: (height / 2 - y) / sf + view.center.y,
  };
}

function draw(): void {
  ctx.clearRect(0, 0, width, height);
  labelBoxes = [];
  hoverTooltip = null;
  closestHoverDistance = Infinity;
  drawGrid();
  for (const lbl in graphs) drawGraph(lbl, graphs[lbl]);
  for (const lbl in points) drawPoint(lbl, points[lbl]);
  if (hoverTooltip) drawTooltip(hoverTooltip);
}

function drawGrid(): void {
  ctx.lineWidth = 1;
  ctx.strokeStyle = document.body.classList.contains('light') ? '#bbb' : '#555';
  ctx.fillStyle = document.body.classList.contains('light') ? '#333' : '#ddd';
  ctx.font = '10px Roboto';

  const margin = 10;
  const s0 = worldToScreen(0, 0);
  let rawX = s0.x,
    rawY = s0.y;
  let labelXY = Math.max(margin, Math.min(height - margin, rawY));
  let labelYX = Math.max(margin, Math.min(width - margin, rawX));

  let step = Math.pow(10, Math.floor(Math.log10(view.scale / 5)));
  if (step * (width / (2 * view.scale)) < 30) step *= 2;

  // Vertical lines
  for (
    let x = Math.floor((view.center.x - view.scale) / step) * step;
    x <= view.center.x + view.scale;
    x += step
  ) {
    const sx = worldToScreen(x, 0).x;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
    ctx.fillText(x.toFixed(2), sx + 2, labelXY + 5);
  }

  // Horizontal lines
  const worldH = view.scale * 2 * (height / width);
  for (
    let y = Math.floor((view.center.y - worldH / 2) / step) * step;
    y <= view.center.y + worldH / 2;
    y += step
  ) {
    const sy = worldToScreen(0, y).y;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
    ctx.fillText(y.toFixed(2), labelYX + 4, sy - 2);
  }

  // Axes
  ctx.lineWidth = 2;
  ctx.strokeStyle = document.body.classList.contains('light') ? '#888' : '#aaa';
  if (rawX >= 0 && rawX <= width) {
    ctx.beginPath();
    ctx.moveTo(rawX, 0);
    ctx.lineTo(rawX, height);
    ctx.stroke();
  }
  if (rawY >= 0 && rawY <= height) {
    ctx.beginPath();
    ctx.moveTo(0, rawY);
    ctx.lineTo(width, rawY);
    ctx.stroke();
  }
}

function drawGraph(
  label: string,
  graph: { funktion: string; color?: string; assignedColor: string },
): void {
  let expr = graph.funktion
    .trim()
    .replace(/^[yY]=/, '')
    .replace(/\^/g, '**');
  let f: (x: number) => number;
  try {
    f = new Function('x', 'with(Math){return ' + expr + '}') as (
      x: number,
    ) => number;
    f(0);
  } catch {
    return;
  }

  const color = graph.color || graph.assignedColor;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  const stepX = (view.scale * 2) / width;
  let first = true;
  const startX = view.center.x - view.scale;
  const endX = view.center.x + view.scale;

  for (let x = startX; x <= endX; x += stepX) {
    let y: number;
    try {
      y = f(x);
    } catch {
      continue;
    }
    const p = worldToScreen(x, y);
    if (first) {
      ctx.moveTo(p.x, p.y);
      first = false;
    } else {
      ctx.lineTo(p.x, p.y);
    }

    // Hover detection
    if (!isDragging && lastMousePos) {
      const d = Math.hypot(p.x - lastMousePos.x, p.y - lastMousePos.y);
      if (d < 10 && d < closestHoverDistance) {
        closestHoverDistance = d;
        hoverTooltip = {
          text: `${label}: (${x.toFixed(2)}, ${y.toFixed(2)})`,
          screenX: p.x,
          screenY: p.y,
        };
      }
    }
  }
  ctx.stroke();

  // Label placement
  let R = view.scale / 3;
  const cx = view.center.x,
    cy = view.center.y;
  let inter = null as { x: number; y: number } | null;
  while (!inter && R < view.scale * 2) {
    inter = findIntersection(f, R, cx, cy, startX, endX, (endX - startX) / 100);
    R += view.scale / 50;
  }
  if (!inter) inter = { x: cx, y: f(cx) };
  const sp = worldToScreen(inter.x, inter.y);

  // Normal for offset
  let dx = 0,
    dy = 0;
  try {
    const h = view.scale / 100;
    dx = (f(inter.x + h) - f(inter.x - h)) / (2 * h);
    dy = 1;
  } catch {
    dy = 0;
  }
  const norm = Math.hypot(dx, dy);
  dx /= norm;
  dy /= norm;
  const off = { x: -dy * 10, y: -dx * 10 };
  let lx = sp.x + off.x,
    ly = sp.y + off.y;
  lx = Math.max(5, Math.min(width - 5, lx));
  ly = Math.max(5, Math.min(height - 5, ly));

  ctx.fillStyle = color;
  ctx.font = '12px Roboto';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = document.body.classList.contains('dark')
    ? 'rgba(255,255,255,0.8)'
    : 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(label, lx, ly);
  ctx.shadowColor = 'transparent';
}

function findIntersection(
  f: (x: number) => number,
  R: number,
  cx: number,
  cy: number,
  x0: number,
  x1: number,
  st: number,
): { x: number; y: number } | null {
  let px = x0;
  let pd = Math.hypot(px - cx, f(px) - cy);
  for (let x = x0 + st; x <= x1; x += st) {
    const d = Math.hypot(x - cx, f(x) - cy);
    if ((pd - R) * (d - R) < 0) {
      const t = (R - pd) / (d - pd);
      return { x: px + t * (x - px), y: f(px + t * (x - px)) };
    }
    px = x;
    pd = d;
  }
  return null;
}

function drawPoint(
  label: string,
  pt: { x: number; y: number; color?: string },
): void {
  const ptC =
    pt.color || (document.body.classList.contains('dark') ? '#ddd' : '#000');
  const p = worldToScreen(pt.x, pt.y);
  ctx.fillStyle = ptC;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '12px Roboto';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = document.body.classList.contains('dark')
    ? 'rgba(255,255,255,0.8)'
    : 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(label, p.x + 5, p.y - 5);
  ctx.shadowColor = 'transparent';
}

function drawTooltip(t: {
  text: string;
  screenX: number;
  screenY: number;
}): void {
  const pad = 6;
  ctx.font = '12px Roboto';
  const tw = ctx.measureText(t.text).width;
  const bw = tw + pad * 2;
  const bh = 20;
  let x = t.screenX + 10;
  let y = t.screenY - bh - 10;
  x = Math.max(0, Math.min(width - bw, x));
  y = Math.max(0, Math.min(height - bh, y));

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  roundRect(ctx, x, y, bw, bh, 4, true, false);
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.text, x + bw / 2, y + bh / 2);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: boolean,
  stroke: boolean,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function getTouchDist(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function validateData(data: unknown): asserts data is Config {
  if (
    typeof data !== 'object' ||
    data === null ||
    !(data as any).view ||
    typeof (data as any).view.scale !== 'number' ||
    typeof (data as any).view.center?.x !== 'number' ||
    typeof (data as any).view.center?.y !== 'number'
  )
    throw new Error('Missing or invalid view parameters.');
  if (typeof (data as any).graphs !== 'object')
    throw new Error('Missing graphs object.');
  if (typeof (data as any).points !== 'object')
    throw new Error('Missing points object.');
}

function initialize(): void {
  errorMessage.value = '';
  try {
    validateData(props.config);
    // View
    view.center.x = props.config.view.center.x;
    view.center.y = props.config.view.center.y;
    view.scale = props.config.view.scale;
    // Graphs
    usedColors.clear();
    Object.keys(props.config.graphs).forEach((label) => {
      const g = props.config.graphs[label];
      const assigned =
        g.color || defaultColors.find((c) => !usedColors.has(c)) || 'black';
      usedColors.add(assigned);
      graphs[label] = {
        funktion: g.funktion,
        color: g.color,
        assignedColor: assigned,
      };
    });
    // Points
    Object.keys(props.config.points).forEach((label) => {
      const p = props.config.points[label];
      points[label] = { x: p.x, y: p.y, color: p.color };
    });
    // Backup
    initialConfig = JSON.parse(JSON.stringify(props.config));
    draw();
  } catch (e: any) {
    errorMessage.value = e.message || String(e);
  }
}

function resetView(): void {
  if (!initialConfig) return;
  view.center.x = initialConfig.view.center.x;
  view.center.y = initialConfig.view.center.y;
  view.scale = initialConfig.view.scale;
  Object.keys(initialConfig.graphs).forEach((label) => {
    const g0 = initialConfig!.graphs[label];
    graphs[label].funktion = g0.funktion;
    graphs[label].color = g0.color;
    graphs[label].assignedColor = g0.color || graphs[label].assignedColor;
  });
  Object.keys(initialConfig.points).forEach((label) => {
    const p0 = initialConfig!.points[label];
    points[label].x = p0.x;
    points[label].y = p0.y;
    points[label].color = p0.color;
  });
  draw();
}

function resize(): void {
  if (!canvasEl.value) return;
  const rect = canvasEl.value.getBoundingClientRect();
  width = canvasEl.value.width = rect.width;
  height = canvasEl.value.height = rect.height;
  draw();
}

function onMouseDown(e: MouseEvent): void {
  isDragging = true;
  dragStart = { x: e.clientX, y: e.clientY };
  viewStart = {
    center: { x: view.center.x, y: view.center.y },
    scale: view.scale,
  };
}

function onMouseMove(e: MouseEvent): void {
  lastMousePos = { x: e.clientX, y: e.clientY };
  if (isDragging) {
    const sf = width / (2 * view.scale);
    view.center.x = viewStart.center.x - (e.clientX - dragStart.x) / sf;
    view.center.y = viewStart.center.y + (e.clientY - dragStart.y) / sf;
  }
  draw();
}

function onMouseUp(): void {
  isDragging = false;
}

function onTouchStart(e: TouchEvent): void {
  if (e.touches.length === 1) {
    isDragging = true;
    dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    viewStart = {
      center: { x: view.center.x, y: view.center.y },
      scale: view.scale,
    };
  } else if (e.touches.length === 2) {
    isDragging = false;
    lastTouchDist = getTouchDist(e.touches);
  }
}

function onTouchMove(e: TouchEvent): void {
  e.preventDefault();
  if (e.touches.length === 1 && isDragging) {
    const dx = e.touches[0].clientX - dragStart.x;
    const dy = e.touches[0].clientY - dragStart.y;
    const sf = width / (2 * view.scale);
    view.center.x = viewStart.center.x - dx / sf;
    view.center.y = viewStart.center.y + dy / sf;
  } else if (e.touches.length === 2) {
    const nd = getTouchDist(e.touches);
    view.scale *= lastTouchDist! / nd;
    lastTouchDist = nd;
  }
  draw();
}

function onTouchEnd(e: TouchEvent): void {
  if (e.touches.length < 2) {
    lastTouchDist = null;
    isDragging = false;
  }
}

function onWheel(e: WheelEvent): void {
  e.preventDefault();
  const mw = screenToWorld(e.clientX, e.clientY);
  const factor = e.deltaY > 0 ? 1.1 : 0.9;
  view.scale *= factor;
  view.center.x = mw.x - (e.clientX - width / 2) / (width / (2 * view.scale));
  view.center.y = mw.y + (e.clientY - height / 2) / (width / (2 * view.scale));
  draw();
}

onMounted(() => {
  if (!canvasEl.value) return;
  ctx = canvasEl.value.getContext('2d')!;
  window.addEventListener('resize', resize);
  resize();
  initialize();

  const c = canvasEl.value;
  c.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  c.addEventListener('touchstart', onTouchStart, { passive: false });
  c.addEventListener('touchmove', onTouchMove, { passive: false });
  c.addEventListener('touchend', onTouchEnd);
  c.addEventListener('wheel', onWheel, { passive: false });
});

// React to external config changes
watch(() => props.config, initialize, { deep: true });
// Apply theme
watch(
  () => props.theme,
  (t = Theme.Dark) => {
    document.body.classList.toggle('dark', t === Theme.Dark);
    document.body.classList.toggle('light', t === Theme.Light);
  },
  { immediate: true },
);
</script>

<!-- Global resets and theme — not scoped so they actually apply 
<style>

</style>
-->
<!-- Component-scoped styling -->
<style scoped>
.graph-container {
  width: 90%;
  padding-top: 90%;
  position: relative;
  margin: auto;
}

canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.reset-btn {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  padding: 8px 12px;
  font-size: 14px;
  background-color: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.reset-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.reset-btn:active {
  transform: scale(0.98);
}

.reset-btn .material-symbols-outlined {
  vertical-align: middle;
  color: red;
}

.error-msg {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  padding: 20px;
  border: 1px solid #fff;
  z-index: 20;
  transition: opacity 0.3s;
}

body.light .error-msg {
  background: rgba(255, 255, 255, 0.9);
  color: #000;
  border-color: #000;
}
</style>

<!-- resets and theme-->
<style scoped>
html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  font-family: 'Roboto', sans-serif;
}

body.dark {
  background-color: #1e1e1e;
  color: #ddd;
}

body.light {
  background-color: #fff;
  color: #333;
}
</style>
