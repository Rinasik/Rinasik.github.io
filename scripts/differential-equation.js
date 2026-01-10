(() => {
  let animationId = null;

  const canvas = document.createElement("canvas");
  canvas.style.backgroundColor = "#230041";
  document.body.appendChild(canvas);
  const gl = canvas.getContext("webgl");
  if (!gl) {
    alert("WebGL not supported");
    return;
  }

  // ======================
  // Размеры
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener("resize", resize);
  resize();

  // ======================
  // Шейдеры
  const vsSource = `
    attribute vec2 a_position;
    uniform vec2 u_resolution;
    void main() {
      vec2 zeroToOne = a_position / u_resolution;
      vec2 clipSpace = zeroToOne * 2.0 - 1.0;
      gl_Position = vec4(clipSpace.x, -clipSpace.y, 0, 1);
      gl_PointSize = 2.0;
    }
  `;

  const fsSource = `
    precision mediump float;
    uniform float u_alpha;
    void main() {
      gl_FragColor = vec4(1.0, 0.54, 0.0, u_alpha);
    }
  `;

  function createShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  function createProgram(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(p));
    }
    return p;
  }

  const program = createProgram(
    createShader(gl.VERTEX_SHADER, vsSource),
    createShader(gl.FRAGMENT_SHADER, fsSource)
  );

  gl.useProgram(program);
  const posLoc = gl.getAttribLocation(program, "a_position");
  const resLoc = gl.getUniformLocation(program, "u_resolution");
  const alphaLoc = gl.getUniformLocation(program, "u_alpha");

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // ======================
  // DIFFUR LOGIC
  const ALPHA = 0.02;
  const NET_FREQUENCY_X = 56;
  const NET_FREQUENCY_Y = 26;

  class DiffEq {
    constructor(name, velocityFunc) {
      this.name = name;
      this.velocityFunc = velocityFunc;
    }
    compute(dot, canvas) {
      return this.velocityFunc(dot, canvas);
    }
  }

  const diffEqs = [
    new DiffEq("Default", (dot, canvas) => ({
      vx: Math.cos(ALPHA * (dot.y - canvas.height / 2)),
      vy: Math.sin(ALPHA * (dot.x - canvas.width / 2)),
    })),
    new DiffEq("Random", () => ({
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
    })),
    new DiffEq("Radial Pulse", (dot, canvas) => {
      const dx = dot.x - canvas.width / 2;
      const dy = dot.y - canvas.height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = Math.sin(performance.now() * 0.002) * 2;
      return { vx: (dx / dist) * speed, vy: (dy / dist) * speed };
    }),
    new DiffEq("Hypnotic Swirl", (dot, canvas) => {
      const dx = dot.x - canvas.width / 2;
      const dy = dot.y - canvas.height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      return {
        vx: (-dy / dist) * Math.sin(dist * 0.05) * 2,
        vy: (dx / dist) * Math.cos(dist * 0.05) * 2,
      };
    }),
    new DiffEq("Cylinder Flow", (dot, canvas) => {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const R = 100,
        U = 2;
      const dx = dot.x - cx;
      const dy = dot.y - cy;
      const r2 = dx * dx + dy * dy || 1;
      const theta = Math.atan2(dy, dx);
      const vr = U * (1 - (R * R) / r2) * Math.cos(theta);
      const vtheta = -U * (1 + (R * R) / r2) * Math.sin(theta);
      return {
        vx: vr * Math.cos(theta) - vtheta * Math.sin(theta),
        vy: vr * Math.sin(theta) + vtheta * Math.cos(theta),
      };
    }),
  ];

  let currentDiffEq = diffEqs[0];

  // ======================
  // DOT CLASS с хвостом
  class Dot {
    constructor(x, y, diffEq) {
      this.x = x;
      this.y = y;
      this.diffEq = diffEq;
      this.vel_x = 0;
      this.vel_y = 0;
      this.tail = [];
      this.maxTail = 15;
    }

    update() {
      const { vx, vy } = this.diffEq.compute(this, canvas);
      this.vel_x = vx;
      this.vel_y = vy;
      this.x += vx;
      this.y += vy;

      this.tail.push({ x: this.x, y: this.y });
      if (this.tail.length > this.maxTail) this.tail.shift();
    }
  }

  function wrap(dot) {
    const W = canvas.width,
      H = canvas.height;
    if (dot.x < -0.5 * W) dot.x += 2 * W;
    if (dot.x > 1.5 * W) dot.x -= 2 * W;
    if (dot.y < -0.5 * H) dot.y += 2 * H;
    if (dot.y > 1.5 * H) dot.y -= 2 * H;
  }

  let dots = [];
  function initDots() {
    dots = [];
    const dx = canvas.width / NET_FREQUENCY_X;
    const dy = canvas.height / NET_FREQUENCY_Y;
    for (let i = -NET_FREQUENCY_X / 2; i < 1.5 * NET_FREQUENCY_X; i++) {
      for (let j = -8; j < NET_FREQUENCY_Y + 10; j++) {
        dots.push(new Dot(dx * i, dy * j, currentDiffEq));
      }
    }
  }
  initDots();

  // ======================
  // UI SELECT
  const ui = document.createElement("div");
  ui.style = `position: fixed; top:16px; right:16px; background: rgba(0,0,0,0.7);
            padding:10px;border-radius:6px; z-index:1000; color:#fff; font-family:sans-serif;`;
  const select = document.createElement("select");
  diffEqs.forEach((d, i) => {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = d.name;
    select.appendChild(o);
  });
  select.onchange = (e) => {
    currentDiffEq = diffEqs[+e.target.value];
    dots.forEach((d) => (d.diffEq = currentDiffEq));
  };
  ui.appendChild(select);
  document.body.appendChild(ui);

  // ======================
  // DRAW LOOP
  function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(35 / 255, 0, 65 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const verts = [];
    const alphas = [];

    dots.forEach((dot) => {
      dot.update();
      wrap(dot);
      dot.tail.forEach((pos, i) => {
        verts.push(pos.x, pos.y);
        alphas.push((i + 1) / dot.tail.length);
      });
    });

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    gl.uniform2f(resLoc, canvas.width, canvas.height);

    for (let i = 0; i < verts.length / 2; i++) {
      gl.uniform1f(alphaLoc, alphas[i]);
      gl.drawArrays(gl.POINTS, i, 1);
    }

    animationId = requestAnimationFrame(draw);
  }

  draw();

  // ======================
  // CLEANUP
  window.cleanup = () => {
    if (animationId !== null) cancelAnimationFrame(animationId);
    animationId = null;
    window.removeEventListener("resize", resize);
    dots.length = 0;
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (ui.parentNode) ui.parentNode.removeChild(ui);
  };
})();
