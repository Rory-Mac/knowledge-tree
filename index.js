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
let offsetX = 0, offsetY = 0;
let scale = 0.2;

// navigation
let dragging = false;
let lastX, lastY;
let mouseDown = false;
let mouseMoved = false;
let downX = 0, downY = 0;
const CLICK_THRESHOLD = 5; // in pixels

canvas.addEventListener('mousedown', e => {
  mouseDown = true;
  mouseMoved = false;
  downX = lastX = e.clientX;
  downY = lastY = e.clientY;
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

  if (dragging) {
    offsetX += (e.clientX - lastX);
    offsetY += (e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
  }
});

canvas.addEventListener('mouseup', e => {
  dragging = false;

  // portal click only processed if user is not currently dragging
  if (!mouseMoved) {
    handlePortalClick(e);
  }

  mouseDown = false;
});

canvas.addEventListener('mouseleave', () => {
  dragging = false;
  mouseDown = false;
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

class Portal {
  constructor(x, y, r, label, articleHref, isEmpty) {
    this.x = x;
    this.y = y;
    this.r = r;

    this.label = label;
    this.href = articleHref;
    this.isEmpty = isEmpty;
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
    ctx.save();

    // radius — empty portals never grow
    const r = this.isEmpty ? sr : sr * this.hoverScale;

    // no clip/pad/img for empty
    if (!this.isEmpty) {
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // padding
      ctx.fillStyle = "black";
      ctx.fillRect(sx - r, sy - r, r*2, r*2);

      // inset image
      const inset = 0.5;
      const imgSize = r * 2 * inset;

      if (this.image?.complete) {
        ctx.drawImage(
          this.image,
          sx - imgSize / 2,
          sy - imgSize / 2,
          imgSize,
          imgSize
        );
      }

      // darken hover
      if (this.hover) {
        ctx.fillStyle = `rgba(0,0,0,0.35)`;
        ctx.fillRect(sx - r, sy - r, r*2, r*2);
      }
    }

    ctx.restore();

    // draw outline (if empty: fixed grey, no hover color)
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 10 * scale;
    ctx.stroke();

    // draw label overlay (if portal not empty)
    if (!this.isEmpty && this.hover) {
      ctx.font = "bold 14px Sans-Serif";
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.fillText(this.label, sx, sy + r + 20);
    }
  }

  contains(px, py) {
    const {sx, sy, sr} = this.screenPos();
    return (px - sx)**2 + (py - sy)**2 <= sr**2;
  }
}

const portalRadius = 200;
const portalHorizontalPadding = 200;
const portalVerticalPadding = 400;

// 0 -> No portal, 1 -> Portal, 2 -> Empty Portal 
const portalPositions = [
  [0,0,0,0,2,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,0,0],
  [0,1,1,1,1,0,0,1,1,1,1],
  [0,0,1,0,0,1,0,1,0,1,0],
  [0,0,1,1,1,1,1,1,1,0,0],
  [0,0,0,0,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,0,0],
  [0,0,0,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0],
  [0,1,0,1,1,0,1,0,0,0,0],
  [1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,2,2,2,0,0,0,0],
]

const portalNames = [
"Empty1",
"Org-Structs", 
"Web-Development", "Distributed-Systems", "Object-Oriented", "Data-Structures", "Economics", "Neural-Networks", "Project-Evolution", "Geopolitics",
"Computer-Networks", "Computational-Complexity", "Probability-Theory", "Game-Theory",
"Operating-Systems", "Multi-Processing", "Compilation", "Calculus", "Geometry", "Topology", "Linear-Algebra",
"Computer-Architecture", "Graph-Theory", "Abstract-Algebra",
"Digital-Circuits", "Set-Theory", "Category-Theory",
"Electrostatics", "Formal-Logic", "Formal-Language",
"Classical-Mechanics", "Wave-Mechanics", 
"Memory",
"Perception", "Music", "Dance", "Narratives", 
"Chemoreception", "Somatosensation", "Vision", "Audition", "Proprioception", "Ontology", "Emotion",
"Physical", "Intellectual", "Spiritual"
]

const portalLinks = [
  ["Empty1", "Web-Development"], ["Empty1", "Object-Oriented"], ["Empty1", "Object-Oriented"], ["Empty1", "Data-Structures"], ["Empty1", "Org-Structs"],
	["Org-Structs", "Project-Evolution"], ["Org-Structs", "Economics"],
	["Data-Structures", "Compilation"], ["Data-Structures", "Computational-Complexity"], ["Neural-Networks", "Linear-Algebra"], ["Neural-Networks", "Game-Theory"], ["Economics", "Probability-Theory"], ["Economics", "Game-Theory"], ["Project-Evolution", "Game-Theory"], ["Geopolitics", "Game-Theory"],
	["Web-Development", "Computer-Networks"], ["Distributed-Systems", "Computer-Networks"], ["Object-Oriented", "Compilation"], ["Computational-Complexity", "Calculus"], ["Probability-Theory", "Calculus"], ["Game-Theory", "Linear-Algebra"], ["Game-Theory", "Narratives"],
	["Multi-Processing", "Computer-Architecture"], ["Operating-Systems", "Computer-Architecture"], ["Computer-Networks", "Operating-Systems"], ["Computer-Networks", "Multi-Processing"], ["Compilation", "Computer-Architecture"], 
	["Calculus", "Abstract-Algebra"], ["Linear-Algebra", "Abstract-Algebra"], ["Geometry", "Abstract-Algebra"], ["Topology", "Abstract-Algebra"], 
	["Computer-Architecture", "Digital-Circuits"], ["Graph-Theory", "Set-Theory"], ["Graph-Theory", "Category-Theory"], ["Abstract-Algebra", "Category-Theory"], ["Abstract-Algebra", "Set-Theory"], 
	["Digital-Circuits", "Electrostatics"], ["Digital-Circuits", "Formal-Logic"], ["Set-Theory", "Formal-Logic"], ["Category-Theory", "Formal-Logic"], ["Category-Theory", "Formal-Language"], 
	["Electrostatics", "Classical-Mechanics"], ["Electrostatics", "Wave-Mechanics"],
  ["Classical-Mechanics", "Memory"], ["Wave-Mechanics", "Memory"], ["Formal-Logic", "Memory"], ["Formal-Language", "Memory"], 
  ["Memory", "Ontology"], ["Memory", "Perception"],
	["Perception", "Vision"], ["Perception", "Audition"], ["Perception", "Proprioception"], ["Perception", "Chemoreception"], ["Perception", "Somatosensation"],
  ["Music", "Audition"], ["Music", "Emotion"], ["Dance", "Proprioception"], ["Dance", "Emotion"], ["Narratives", "Emotion"], 
  ["Chemoreception", "Physical"], ["Somatosensation", "Physical"], ["Audition", "Physical"], ["Proprioception", "Physical"], ["Vision", "Physical"], ["Ontology", "Intellectual"], ["Emotion", "Spiritual"],
];

function generatePortals() {
  const portals = [];
  const nameToIndex = new Map();

  // generate portals
  let portalCount = -1;
  for (let row = 0; row < portalPositions.length; row++) {
    for (let col = 0; col < portalPositions[row].length; col++) {
      const id = portalPositions[row][col];
      if (id === 0) continue;
      
      portalCount += 1;

      const name = portalNames[portalCount];
      if (!name) {
        console.warn(`No name mapped for portal id ${id}`);
        continue;
      }

      const x = col * ((portalRadius * 2) + portalHorizontalPadding);
      const y = row * ((portalRadius * 2) + portalVerticalPadding);
      const article = `articles/${name}.html`;

      const isEmpty = id === 2;
      const portal = new Portal(x, y, portalRadius, name, article, isEmpty);

      nameToIndex.set(name, portals.length);
      portals.push(portal);
    }
  }

  // generate portal edges (links)
  const links = [];
  for (const link of portalLinks) {
    if (!Array.isArray(link) || link.length !== 2) continue;
    const [aName, bName] = link;
    const ai = nameToIndex.get(aName);
    const bi = nameToIndex.get(bName);
    if (ai != null && bi != null) {
      links.push([ai, bi]);
    } else {
      console.warn(`Link skipped: ${aName} ↔ ${bName}, missing portal.`);
    }
  }

  return { portals, links };
}

const { portals, links } = generatePortals();
window.portals = portals;
window.links = links;

function loadPortalImages(portals) {
  portals.forEach(p => {
    if (p.isEmpty) return;

    const img = new Image();
    img.onload = () => {
      p.image = img;
    };
    img.src = `assets/portals/${p.label}.png`;
  });
}

loadPortalImages(portals);

// clicked / hovered detection
canvas.addEventListener('mousemove', e => {
  portals.forEach(p => {
    const hov = p.isEmpty ? false : p.contains(e.clientX, e.clientY);
    p.hover = hov;
    p.targetHoverScale = hov ? 1.1 : 1;
  });
});

function handlePortalClick(e) {
  portals.forEach(p => {
    if (!p.isEmpty && p.contains(e.clientX, e.clientY)) {
      window.location.href = p.href;
    }
  });
}

function drawLinks() {
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 10 * scale;

  links.forEach(([aIndex, bIndex]) => {
    const A = portals[aIndex];
    const B = portals[bIndex];

    // anchors
    const P0 = { x: A.x, y: A.y + A.r };
    const P3 = { x: B.x, y: B.y - B.r };

    // curvature height in world space
    const h = (P3.y - P0.y) / 3;

    // control points for cubic
    const P1 = { x: P0.x, y: P0.y + h };
    const P2 = { x: P3.x, y: P3.y - h };

    const sx = x => x * scale + offsetX;
    const sy = y => y * scale + offsetY;

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

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
