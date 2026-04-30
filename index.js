const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');

let width, height;
function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// viewport state
let offsetX = 200, offsetY = -400;
let scale = 0.1;

// navigation
let dragging = false;
let lastX, lastY;
let mouseDown = false;
let mouseMoved = false;
let downX = 0, downY = 0;
const CLICK_THRESHOLD = 5; // in pixels

// editor mode (in-memory, resets on refresh)
let editorMode = false;
let draggingPortal = null;
let firstDoubleClickPortal = null;
const editorBtn = document.getElementById('editor-btn');
const logBtn = document.getElementById('log-btn');
editorBtn.addEventListener('click', () => {
  editorMode = !editorMode;
  editorBtn.classList.toggle('visible', editorMode);
  logBtn.classList.toggle('visible', editorMode);
  firstDoubleClickPortal = null;
});

logBtn.addEventListener('click', () => {
  const colSpacing = portalRadius * 2 + portalHorizontalPadding;
  const rowSpacing = portalRadius * 2 + portalVerticalPadding;
  const portalDescriptions = portals.map(p => [
    p.label,
    [Math.round(p.x / colSpacing), Math.round(p.y / rowSpacing)]
  ]);
  console.log(JSON.stringify(portalDescriptions));
  const linkDescriptions = links.map(([ai, bi, s, d]) => [portals[ai].label, portals[bi].label, s, d]);
  console.log(JSON.stringify(linkDescriptions));
});

const SIDE_OFFSETS = {
  t: { dx: 0,  dy: -1 },
  b: { dx: 0,  dy: 1  },
  l: { dx: -1, dy: 0  },
  r: { dx: 1,  dy: 0  },
};

function sideMidpoint(portal, side) {
  const off = SIDE_OFFSETS[side];
  return { x: portal.x + off.dx * portal.r, y: portal.y + off.dy * portal.r };
}

// pick the side of `portal` that faces `other` and is closest to the click
function chooseSide(portal, other, clickClientX, clickClientY) {
  const ranked = Object.keys(SIDE_OFFSETS)
    .map(s => {
      const mp = sideMidpoint(portal, s);
      return { side: s, mp, dOther: Math.hypot(mp.x - other.x, mp.y - other.y) };
    })
    .sort((a, b) => a.dOther - b.dOther)
    .slice(0, 2);

  const worldX = (clickClientX - offsetX) / scale;
  const worldY = (clickClientY - offsetY) / scale;
  ranked.sort((a, b) =>
    Math.hypot(a.mp.x - worldX, a.mp.y - worldY) -
    Math.hypot(b.mp.x - worldX, b.mp.y - worldY)
  );
  return ranked[0].side;
}

canvas.addEventListener('mousedown', e => {
  mouseDown = true;
  mouseMoved = false;
  downX = lastX = e.clientX;
  downY = lastY = e.clientY;

  if (editorMode) {
    const hit = portals.find(p => p.contains(e.clientX, e.clientY));
    if (hit) {
      draggingPortal = hit;
      return;
    }
  }

  dragging = true;
});

canvas.addEventListener('mousemove', e => {
  if (mouseDown) {
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) {
      mouseMoved = true;
    }
  }

  if (draggingPortal) {
    const worldX = (e.clientX - offsetX) / scale;
    const worldY = (e.clientY - offsetY) / scale;
    const colSpacing = portalRadius * 2 + portalHorizontalPadding;
    const rowSpacing = portalRadius * 2 + portalVerticalPadding;
    draggingPortal.x = Math.round(worldX / colSpacing) * colSpacing;
    draggingPortal.y = Math.round(worldY / rowSpacing) * rowSpacing;
    return;
  }

  if (dragging) {
    offsetX += (e.clientX - lastX);
    offsetY += (e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
  }
});

canvas.addEventListener('mouseup', e => {
  dragging = false;

  if (draggingPortal) {
    draggingPortal = null;
    mouseDown = false;
    return;
  }

  // portal click only processed if user is not currently dragging
  if (!mouseMoved) {
    handlePortalClick(e);
  }

  mouseDown = false;
});

canvas.addEventListener('mouseleave', () => {
  dragging = false;
  mouseDown = false;
  draggingPortal = null;
});

// zoom 
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();

  const zoomIntensity = 0.1;
  const delta = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;

  // get mouse position in screen space
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // convert mouse position to world coordinates
  const worldX = (mouseX - offsetX) / scale;
  const worldY = (mouseY - offsetY) / scale;

  // apply zoom scale change
  scale *= delta;

  // convert back to screen space
  offsetX = mouseX - worldX * scale;
  offsetY = mouseY - worldY * scale;

});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
});

// touch / mobile navigation: single-finger pan, two-finger pinch zoom, tap-to-open
let touchPanLast = null;
let pinchPrev = null;
let touchDownPos = null;
let touchMoved = false;

function touchMidpoint(t1, t2) {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
}
function touchDistance(t1, t2) {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    touchPanLast = { x: t.clientX, y: t.clientY };
    touchDownPos = { x: t.clientX, y: t.clientY };
    touchMoved = false;
    pinchPrev = null;
  } else if (e.touches.length === 2) {
    const [a, b] = e.touches;
    const mid = touchMidpoint(a, b);
    pinchPrev = { dist: touchDistance(a, b), x: mid.x, y: mid.y };
    touchPanLast = null;
    touchMoved = true;
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 1 && touchPanLast) {
    const t = e.touches[0];
    offsetX += t.clientX - touchPanLast.x;
    offsetY += t.clientY - touchPanLast.y;
    touchPanLast = { x: t.clientX, y: t.clientY };
    if (touchDownPos) {
      const tdx = t.clientX - touchDownPos.x;
      const tdy = t.clientY - touchDownPos.y;
      if (Math.abs(tdx) > CLICK_THRESHOLD || Math.abs(tdy) > CLICK_THRESHOLD) {
        touchMoved = true;
      }
    }
  } else if (e.touches.length === 2 && pinchPrev) {
    const [a, b] = e.touches;
    const dist = touchDistance(a, b);
    const mid = touchMidpoint(a, b);

    // pan by midpoint motion
    offsetX += mid.x - pinchPrev.x;
    offsetY += mid.y - pinchPrev.y;

    // zoom around current midpoint
    const worldX = (mid.x - offsetX) / scale;
    const worldY = (mid.y - offsetY) / scale;
    scale *= dist / pinchPrev.dist;
    offsetX = mid.x - worldX * scale;
    offsetY = mid.y - worldY * scale;

    pinchPrev = { dist, x: mid.x, y: mid.y };
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (e.touches.length === 0) {
    if (touchDownPos && !touchMoved) {
      handlePortalClick({ clientX: touchDownPos.x, clientY: touchDownPos.y });
    }
    touchPanLast = null;
    touchDownPos = null;
    pinchPrev = null;
    touchMoved = false;
  } else if (e.touches.length === 1) {
    const t = e.touches[0];
    touchPanLast = { x: t.clientX, y: t.clientY };
    pinchPrev = null;
  }
});

canvas.addEventListener('touchcancel', () => {
  touchPanLast = null;
  touchDownPos = null;
  pinchPrev = null;
  touchMoved = false;
});

canvas.addEventListener('dblclick', e => {
  if (!editorMode) return;
  const hit = portals.find(p => p.contains(e.clientX, e.clientY));
  if (!hit) { firstDoubleClickPortal = null; return; }

  if (!firstDoubleClickPortal || firstDoubleClickPortal.portal === hit) {
    firstDoubleClickPortal = (firstDoubleClickPortal?.portal === hit)
      ? null
      : { portal: hit, clickX: e.clientX, clickY: e.clientY };
    return;
  }

  const src = firstDoubleClickPortal.portal;
  const dst = hit;
  const srcIdx = portals.indexOf(src);
  const dstIdx = portals.indexOf(dst);

  const existingIdx = links.findIndex(l =>
    (l[0] === srcIdx && l[1] === dstIdx) ||
    (l[0] === dstIdx && l[1] === srcIdx)
  );

  if (existingIdx !== -1) {
    links.splice(existingIdx, 1);
  } else {
    const srcSide = chooseSide(src, dst, firstDoubleClickPortal.clickX, firstDoubleClickPortal.clickY);
    const dstSide = chooseSide(dst, src, e.clientX, e.clientY);
    links.push([srcIdx, dstIdx, srcSide, dstSide]);
  }

  firstDoubleClickPortal = null;
});

class Portal {
  constructor(x, y, r, label, articleHref) {
    this.x = x;
    this.y = y;
    this.r = r;

    this.label = label;
    this.href = articleHref;
    this.hover = false;
    this.image = null;

    this.hoverScale = 1;        // current scale
    this.targetHoverScale = 1;  // target scale
  }

  update(dt) {
    const speed = 10; // higher = snappier, lower = slower
    this.hoverScale += (this.targetHoverScale - this.hoverScale) * Math.min(1, dt * speed);
  }

  screenPos() {
    return {
      sx: this.x * scale + offsetX,
      sy: this.y * scale + offsetY,
      sr: this.r * scale
    };
  }

  draw() {
    const {sx, sy, sr} = this.screenPos();
    const r = sr * this.hoverScale;

    ctx.fillStyle = "black";
    ctx.fillRect(sx - r, sy - r, r*2, r*2);

    if (this.mipmaps) {
      const pad = r * portalImagePadding;
      const ir = r - pad;
      const targetPx = ir * 2;
      let level = this.mipmaps[0];
      for (const m of this.mipmaps) {
        if (m.width >= targetPx) level = m;
        else break;
      }
      ctx.drawImage(level, sx - ir, sy - ir, ir*2, ir*2);
    }

    if (this.hover) {
      ctx.fillStyle = `rgba(0,0,0,0.35)`;
      ctx.fillRect(sx - r, sy - r, r*2, r*2);
    }

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 10 * scale;
    //ctx.strokeRect(sx - r, sy - r, r*2, r*2);
  }

  drawLabel() {
    const {sx, sy, sr} = this.screenPos();
    const r = sr * this.hoverScale;
    ctx.font = "bold 14px Sans-Serif";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(this.label, sx, sy + r + 20);
  }

  contains(px, py) {
    const {sx, sy, sr} = this.screenPos();
    return Math.abs(px - sx) <= sr && Math.abs(py - sy) <= sr;
  }
}

const portalRadius = 200;
const portalHorizontalPadding = 200;
const portalVerticalPadding = 200;
const portalImagePadding = 0.2;

// list of portal tuples [name index, portal grid coord]
const portalPositions = [["Org-Structs",[10,-5]],["Web-Development",[5,-5]],["Distributed-Systems",[4,-5]],["Object-Oriented",[2,-4]],["Data-Structures",[6,-3]],["Economics",[9,-3]],["Neural-Networks",[3,7]],["Project-Evolution",[10,-3]],["Geopolitics",[11,-3]],["Computer-Networks",[4,-3]],["Computational-Complexity",[7,-1]],["Probability-Theory",[8,6]],["Game-Theory",[11,-1]],["Operating-Systems",[4,-1]],["λ-Calculus",[1,7]],["Functional-Programming",[1,-3]],["Imperative-Programming",[2,-3]],["Multi-Processing",[5,-1]],["Compilation",[3,-1]],["Calculus",[7,8]],["Geometry",[9,10]],["Automata-Theory",[2,7]],["Causality",[10,10]],["Topology",[9,8]],["Linear-Algebra",[7,10]],["Graph-Theory",[9,11]],["Number-Theory",[6,10]],["Computer-Architecture",[4,1]],["Algebra",[8,10]],["Narratives",[11,0]],["Digital-Circuits",[4,2]],["Abstract-Algebra",[8,8]],["Electrostatics",[5,4]],["Set-Theory",[8,12]],["Category-Theory",[9,6]],["The-Self",[11,2]],["Memory",[7,15]],["Number-Systems",[7,12]],["Classical-Mechanics",[5,6]],["Wave-Mechanics",[6,4]],["Fluid-Mechanics",[8,4]],["Formal-Logic",[4,12]],["Formal-Language",[8,14]],["Perception",[5,17]],["Music",[8,17]],["Dance",[7,17]],["Markov-Process",[3,5]],["Agency",[11,8]],["Audition",[8,19]],["Proprioception",[7,19]],["Vision",[6,19]],["Somatosensation",[5,19]],["Chemoreception",[4,19]],["Ontology",[9,13]],["Belief",[11,10]],["Emotion",[9,19]]];

// portal links formatted as [src portal name, dest portal name, src side, dest side]
// sides: "l" left, "r" right, "t" top, "b" bottom — spline exits src, enters dst
const portalLinks = [["Org-Structs","Project-Evolution","b","t"],["Org-Structs","Economics","b","t"],["Data-Structures","Computational-Complexity","b","t"],["Economics","Game-Theory","b","t"],["Project-Evolution","Game-Theory","b","t"],["Geopolitics","Game-Theory","b","t"],["Web-Development","Computer-Networks","b","t"],["Distributed-Systems","Computer-Networks","b","t"],["Multi-Processing","Computer-Architecture","b","t"],["Operating-Systems","Computer-Architecture","b","t"],["Computer-Networks","Operating-Systems","b","t"],["Computer-Networks","Multi-Processing","b","t"],["Compilation","Computer-Architecture","b","t"],["Computer-Architecture","Digital-Circuits","b","t"],["Electrostatics","Classical-Mechanics","b","t"],["Belief","Agency","t","b"],["Belief","Emotion","b","t"],["Emotion","Dance","t","b"],["Emotion","Music","t","b"],["Chemoreception","Perception","t","b"],["Vision","Perception","t","b"],["Somatosensation","Perception","t","b"],["Proprioception","Perception","t","b"],["Audition","Perception","t","b"],["Proprioception","Dance","t","b"],["Audition","Music","t","b"],["Perception","Memory","t","b"],["Formal-Language","Set-Theory","t","b"],["Formal-Logic","Formal-Language","b","t"],["Formal-Language","Memory","b","t"],["Number-Systems","Formal-Language","b","t"],["Set-Theory","Graph-Theory","t","b"],["Algebra","Abstract-Algebra","t","b"],["Abstract-Algebra","Linear-Algebra","b","t"],["Number-Theory","Number-Systems","b","t"],["Linear-Algebra","Number-Systems","b","t"],["Algebra","Number-Systems","b","t"],["Formal-Language","Ontology","t","b"],["Topology","Geometry","b","t"],["Topology","Category-Theory","t","b"],["Category-Theory","Abstract-Algebra","b","t"],["Algebra","Calculus","t","b"],["Geometry","Graph-Theory","b","t"],["Classical-Mechanics","Linear-Algebra","b","t"],["Calculus","Classical-Mechanics","t","b"],["Probability-Theory","Calculus","b","t"],["Wave-Mechanics","Classical-Mechanics","b","t"],["Digital-Circuits","Formal-Logic","b","t"],["Electrostatics","Digital-Circuits","t","b"],["Ontology","Belief","t","b"],["Ontology","Causality","t","b"],["Causality","Agency","t","b"],["Markov-Process","Automata-Theory","b","t"],["Neural-Networks","Linear-Algebra","b","t"],["Formal-Logic","Neural-Networks","t","b"],["Classical-Mechanics","Fluid-Mechanics","t","b"],["Classical-Mechanics","Perception","b","t"],["The-Self","Narratives","t","b"],["Agency","The-Self","t","b"],["Game-Theory","Narratives","b","t"],["Fluid-Mechanics","The-Self","t","b"],["λ-Calculus","Functional-Programming","t","b"],["λ-Calculus","Formal-Logic","b","t"],["Automata-Theory","Formal-Logic","b","t"],["Imperative-Programming","Automata-Theory","b","t"],["Object-Oriented","Imperative-Programming","b","t"],["Imperative-Programming","Compilation","b","t"],["Functional-Programming","Compilation","b","t"],["Computational-Complexity","Calculus","b","t"]];

function generatePortals() {
  const portals = [];
  const nameToIndex = new Map();

  // generate portals
  for (const [name, [col, row]] of portalPositions) {

    if (!name) {
      console.warn(`No name mapped for portal id ${id}`);
      continue;
    }
    
    const x = col * ((portalRadius * 2) + portalHorizontalPadding);
    const y = row * ((portalRadius * 2) + portalVerticalPadding);
    const article = `articles/${name}.html`;
    
    const portal = new Portal(x, y, portalRadius, name, article);
    nameToIndex.set(name, portals.length);
    portals.push(portal);
  }

  // generate portal edges (links)
  const links = [];
  for (const link of portalLinks) {
    if (!Array.isArray(link) || link.length !== 4) continue;
    const [aName, bName, srcSide, dstSide] = link;
    const ai = nameToIndex.get(aName);
    const bi = nameToIndex.get(bName);
    if (ai != null && bi != null) {
      links.push([ai, bi, srcSide, dstSide]);
    } else {
      console.warn(`Link skipped: ${aName} ↔ ${bName}, missing portal.`);
    }
  }

  return { portals, links };
}

const { portals, links } = generatePortals();
window.portals = portals;
window.links = links;

function buildMipmaps(img) {
  const levels = [img];
  let prev = img;
  let w = img.width, h = img.height;
  while (w > 2 && h > 2) {
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(prev, 0, 0, w, h);
    levels.push(c);
    prev = c;
  }
  return levels;
}

function loadPortalImages(portals) {
  portals.forEach(p => {
    const img = new Image();
    img.onload = () => {
      p.mipmaps = buildMipmaps(img);
    };
    img.src = `assets/portals/${p.label}.png`;
  });
}

loadPortalImages(portals);

// clicked / hovered detection
canvas.addEventListener('mousemove', e => {
  portals.forEach(p => {
    const hov = p.contains(e.clientX, e.clientY);
    p.hover = hov;
    p.targetHoverScale = hov ? 1.1 : 1;
  });
});

function handlePortalClick(e) {
  if (editorMode) return;
  portals.forEach(p => {
    if (p.contains(e.clientX, e.clientY)) {
      window.location.href = p.href;
    }
  });
}

function drawLinks() {
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 10 * scale;

  const sx = x => x * scale + offsetX;
  const sy = y => y * scale + offsetY;

  links.forEach(([aIndex, bIndex, srcSide, dstSide]) => {
    const A = portals[aIndex];
    const B = portals[bIndex];

    const P0 = sideMidpoint(A, srcSide);
    const P3 = sideMidpoint(B, dstSide);
    const dist = Math.hypot(P3.x - P0.x, P3.y - P0.y);
    const off = dist / 3;
    const sO = SIDE_OFFSETS[srcSide];
    const dO = SIDE_OFFSETS[dstSide];
    const P1 = { x: P0.x + sO.dx * off, y: P0.y + sO.dy * off };
    const P2 = { x: P3.x + dO.dx * off, y: P3.y + dO.dy * off };

    ctx.beginPath();
    ctx.moveTo(sx(P0.x), sy(P0.y));
    ctx.bezierCurveTo(
      sx(P1.x), sy(P1.y),
      sx(P2.x), sy(P2.y),
      sx(P3.x), sy(P3.y)
    );
    ctx.stroke();
  });
}

let lastTime = performance.now();

function animate(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  drawLinks();

  portals.forEach(p => {
    p.update(dt);
    p.draw();
  });

  portals.forEach(p => {
    if (p.hover) p.drawLabel();
  });

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
