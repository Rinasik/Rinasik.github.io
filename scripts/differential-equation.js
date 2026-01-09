(() => {
  let animationId = null;
  const canvas = document.createElement("canvas");
  canvas.style.backgroundColor = "#230041";
  const ctx = canvas.getContext("2d");

  const ALPHA = 0.02;
  const NET_FREQUENCY_X = 56;
  const NET_FREQUENCY_Y = 26;

  const DOT_START_R = 255;
  const DOT_START_G = 137;
  const DOT_START_B = 0;
  const DOT_START = `${DOT_START_R}, ${DOT_START_G}, ${DOT_START_B}`;

  const DOT_END_R = 35;
  const DOT_END_G = 0;
  const DOT_END_B = 65;
  const DOT_END = `${DOT_END_R}, ${DOT_END_G}, ${DOT_END_B}`;

  const TRAIL_LENGTH = 40;
  const TRAIL_FACTOR = 10;
  const TRAIL_DIVISION = TRAIL_LENGTH / TRAIL_FACTOR;

  let dots = [];
  const dotsAplha = [];
  const dotsColor = [];

  // ----------------------------
  // Класс дифференциального уравнения
  class DiffEq {
    constructor(name, velocityFunc) {
      this.name = name;
      this.velocityFunc = velocityFunc; // (dot, canvas) => { vx, vy }
    }

    compute(dot, canvas) {
      return this.velocityFunc(dot, canvas);
    }
  }

  // ----------------------------
  // Примеры диффуров
  const diffEqs = [
    new DiffEq("Default", (dot, canvas) => {
      const { width, height } = canvas.getBoundingClientRect();
      return {
        vx: Math.cos(ALPHA * (dot.y - height / 2)),
        vy: Math.sin(ALPHA * (dot.x - width / 2)),
      };
    }),
    new DiffEq("Random", (dot) => {
      return { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 };
    }),
    new DiffEq("Radial Pulse", (dot, canvas) => {
      const { width, height } = canvas.getBoundingClientRect();
      const dx = dot.x - width / 2;
      const dy = dot.y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = Math.sin(performance.now() * 0.002) * 2;
      return { vx: (dx / dist) * speed, vy: (dy / dist) * speed };
    }),
    new DiffEq("Hypnotic Swirl", (dot, canvas) => {
      const { width, height } = canvas.getBoundingClientRect();
      const dx = dot.x - width / 2;
      const dy = dot.y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      return {
        vx: (-dy / dist) * Math.sin(dist * 0.05) * 2,
        vy: (dx / dist) * Math.cos(dist * 0.05) * 2,
      };
    }),
    new DiffEq("Cylinder Flow", (dot, canvas) => {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const R = 100; // радиус цилиндра
      const U = 2; // скорость потока

      const dx = dot.x - cx;
      const dy = dot.y - cy;
      const r2 = dx * dx + dy * dy;
      const r = Math.sqrt(r2) || 1;

      // Поток вокруг цилиндра: потенциал + вихрь
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

  // ----------------------------
  // Класс точки
  class Dot {
    constructor(initial_x, initial_y, diffEq) {
      this.x = initial_x;
      this.y = initial_y;
      this.trail = [];
      this.vel_x = 0;
      this.vel_y = 0;
      this.diffEq = diffEq;
    }

    Draw(ctx) {
      this.trail.forEach(([x, y], index) => {
        if (index % TRAIL_DIVISION !== 0) return;
        const prepared_index = index / TRAIL_DIVISION;
        ctx.fillStyle = `rgba(${dotsColor[prepared_index]}, ${dotsAplha[prepared_index]})`;
        ctx.fillRect(x, y, 2, 2);
      });

      ctx.beginPath();
      ctx.fillStyle = `rgba(${DOT_START}, 1)`;
      ctx.fillRect(this.x, this.y, 3, 3);
    }

    UpdateVelocity(canvas) {
      const { vx, vy } = this.diffEq.compute(this, canvas);
      this.vel_x = vx;
      this.vel_y = vy;
    }

    UpdateCoordinates() {
      if (this.trail.length === TRAIL_LENGTH) this.trail.shift();
      this.trail.push([this.x, this.y]);
      this.x += this.vel_x;
      this.y += this.vel_y;
    }
  }

  function handleWrapAround(dot, canvas) {
    const W = canvas.width;
    const H = canvas.height;

    if (dot.x < -0.5*W) dot.x += 2 * W;
    if (dot.x > 1.5*W) dot.x -= 2 * W;
    if (dot.y < -0.5*H) dot.y += 2 * H;
    if (dot.y > 1.5*H) dot.y -= 2 * H;
  }

  // ----------------------------
  // Инициализация точек
  function initDots(width, height) {
    const deltax = width / NET_FREQUENCY_X;
    const deltay = height / NET_FREQUENCY_Y;

    for (let i = -NET_FREQUENCY_X / 2; i < 1.5 * NET_FREQUENCY_X + 1; ++i) {
      for (let j = -8; j < NET_FREQUENCY_Y + 10; ++j) {
        dots.push(new Dot(deltax * i, deltay * j, currentDiffEq));
      }
    }

    for (let i = 0; i < TRAIL_FACTOR; ++i) {
      dotsAplha.push(0.5 + (i * 0.5) / TRAIL_FACTOR);
    }

    for (let i = TRAIL_FACTOR; i >= 1; --i) {
      const r = Math.ceil(
        DOT_START_R + (i * (DOT_END_R - DOT_START_R)) / TRAIL_FACTOR
      );
      const g = Math.ceil(
        DOT_START_G + (i * (DOT_END_G - DOT_START_G)) / TRAIL_FACTOR
      );
      const b = Math.ceil(
        DOT_START_B + (i * (DOT_END_B - DOT_START_B)) / TRAIL_FACTOR
      );
      dotsColor.push(`${r}, ${g}, ${b}`);
    }
  }

  // ----------------------------
  // Отрисовка кадра
  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dots.forEach((dot) => {
      dot.Draw(ctx);
      dot.UpdateVelocity(canvas);
      dot.UpdateCoordinates();
      handleWrapAround(dot, canvas);
    });

    animationId = requestAnimationFrame(drawFrame);
  }

  // ----------------------------
  // Обработка ресайза
  function handleResize() {
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
    dots = [];
    initDots(canvas.width, canvas.height);
  }

  // ----------------------------
  // UI для диффуров
  const uiDiv = document.createElement("div");
  uiDiv.style = `
    position: fixed;
    top: 16px;
    right: 16px;
    background: rgba(0,0,0,0.7);
    padding: 10px 14px;
    border-radius: 6px;
    color: #fff;
    font-family: sans-serif;
    z-index: 1000;
  `;

  const select = document.createElement("select");
  diffEqs.forEach((d, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = d.name;
    select.appendChild(opt);
  });

  select.addEventListener("change", (e) => {
    const idx = parseInt(e.target.value);
    currentDiffEq = diffEqs[idx];
    dots.forEach((dot) => (dot.diffEq = currentDiffEq));
  });

  uiDiv.appendChild(select);
  document.body.appendChild(uiDiv);

  // ----------------------------
  // Инициализация
  function init() {
    handleResize();
    window.addEventListener("resize", handleResize);
    document.body.appendChild(canvas);

    drawFrame();

    // ----------------------------
    // Очистка
    window.cleanup = () => {
      if (animationId !== null) cancelAnimationFrame(animationId);
      animationId = null;

      window.removeEventListener("resize", handleResize);

      dots.length = 0;
      dotsAplha.length = 0;
      dotsColor.length = 0;

      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (uiDiv.parentNode) uiDiv.parentNode.removeChild(uiDiv);
    };
  }

  init();
})();
