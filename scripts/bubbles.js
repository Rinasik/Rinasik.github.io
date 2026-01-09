(() => {
  let animationId = null;
  // =========================
  // AudioManager
  // =========================
  class AudioManager {
    constructor() {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.lastTime = 0;
    }

    play(volume = 0.2) {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(600 + Math.random() * 200, now);

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);

      this.lastTime = performance.now();
    }

    canPlay(minInterval = 50) {
      return performance.now() - this.lastTime > minInterval;
    }
  }

  const audioManager = new AudioManager();

  // =========================
  // Dot
  // =========================
  class Dot {
    constructor(x, y, options = {}) {
      this.pos = { x, y };
      this.vel = { x: 0, y: 0 };
      this.radius = options.radius || 20 + Math.random() * 10;
      this.mass = options.mass || Math.random() / 10;
      this.color =
        options.color ||
        `rgba(243,18,96,${options.isMouse ? 1 : 0.1 + Math.random()})`;
      this.isMouse = options.isMouse || false;
    }

    draw(ctx) {
      if (!this.isMouse) {
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
      }

      ctx.beginPath();
      ctx.fillStyle = this.color;
      ctx.arc(this.pos.x, this.pos.y, this.radius, 0, 2 * Math.PI);
      ctx.fill();
    }

    clamp(width, height) {
      this.pos.x = Math.min(
        Math.max(this.pos.x, this.radius),
        width - this.radius
      );
      this.pos.y = Math.min(
        Math.max(this.pos.y, this.radius),
        height - this.radius
      );
    }
  }

  // =========================
  // PhysicsEngine
  // =========================
  class PhysicsEngine {
    constructor(dots, options) {
      this.dots = dots;
      this.sphereRad = options.sphereRad || 250;
      this.smallSphere = options.smallSphere || 10;
      this.smooth = options.smooth || 0.85;
      this.distanceExp = options.distanceExp || 1;
    }

    update() {
      this.dots.forEach((dot, i) => {
        if (dot.isMouse) return;

        let acc = { x: 0, y: 0 };

        this.dots.forEach((other, j) => {
          if (i === j) return;

          let dx = other.pos.x - dot.pos.x;
          let dy = other.pos.y - dot.pos.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;

          let force =
            ((dist - this.sphereRad) / Math.pow(dist, this.distanceExp)) *
            other.mass *
            dot.mass;

          if (other.isMouse) {
            let sumR = dot.radius + other.radius;
            force =
              dist > sumR + 2 * this.smallSphere
                ? other.mass / Math.pow(dist, this.distanceExp)
                : ((dist - sumR - this.smallSphere) /
                    Math.pow(dist, this.distanceExp)) *
                  other.mass;
          }

          acc.x += dx * force;
          acc.y += dy * force;

          // звуковой эффект
          if (Math.abs(force) > 0.002 && audioManager.canPlay()) {
            audioManager.play(Math.min(Math.abs(force) * 0.5, 0.3));
          }
        });

        dot.vel.x = dot.vel.x * this.smooth + acc.x;
        dot.vel.y = dot.vel.y * this.smooth + acc.y;
      });
    }
  }

  // =========================
  // CanvasManager
  // =========================
  class CanvasManager {
    constructor() {
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d");
      this.padding = { h: 10, w: 20 };
      document.body.style.backgroundColor = "#383838";
      document.body.style.padding = `${this.padding.h}px ${this.padding.w}px`;
      document.body.appendChild(this.canvas);
      this.resize();
      window.addEventListener("resize", () => this.resize());
    }

    resize() {
      this.width = window.innerWidth - 2 * this.padding.w;
      this.height = window.innerHeight - 2 * this.padding.h - 2;
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }

    clear() {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  // =========================
  // Game
  // =========================
  class Game {
    constructor() {
      this.dots = [];
      this.mouseDot = new Dot(400, 400, { radius: 50, mass: 1, isMouse: true });
      this.dots.push(this.mouseDot);

      this.canvasMgr = new CanvasManager();
      this.physics = new PhysicsEngine(this.dots, {
        sphereRad: 250,
        smallSphere: 10,
        smooth: 0.85,
        distanceExp: 1,
      });

      this.initUI();
      this.bindEvents();
      this.loop();

      window.cleanup = () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
        document.body.removeChild(this.canvasMgr.canvas);
        const uiDiv = document.getElementById("physics-ui");
        if (uiDiv) document.body.removeChild(uiDiv);
        this.dots.length = 0;
        window.removeEventListener("mousemove", this.mouseMoveHandler);
        window.removeEventListener("click", this.clickHandler);
        window.removeEventListener("resize", this.canvasMgr.resize);
      };
    }

    initUI() {
      const uiDiv = document.createElement("div");
      uiDiv.id = "physics-ui";
      uiDiv.style = `
        position: fixed; top:16px; right:16px;
        background: rgba(0,0,0,0.7); padding: 10px 14px;
        border-radius:6px; color:#fff; font-family:sans-serif; z-index:1000;
      `;
      uiDiv.innerHTML = `
        <label for="distanceExponent">Distance exponent: <span id="exp-value">1</span></label>
        <input type="range" id="distanceExponent" min="0.7" max="1.5" step="0.05" value="1" style="width:150px">
      `;
      document.body.appendChild(uiDiv);

      const slider = document.getElementById("distanceExponent");
      const label = document.getElementById("exp-value");

      slider.addEventListener("input", (e) => {
        this.physics.distanceExp = parseFloat(e.target.value);
        label.textContent = this.physics.distanceExp.toFixed(2);
      });
    }

    bindEvents() {
      document.body.addEventListener("click", (e) => {
        this.dots.push(
          new Dot(
            e.clientX - this.canvasMgr.padding.w,
            e.clientY - this.canvasMgr.padding.h
          )
        );
      });

      document.body.addEventListener("mousemove", (e) => {
        this.mouseDot.pos.x = e.clientX - this.canvasMgr.padding.w;
        this.mouseDot.pos.y = e.clientY - this.canvasMgr.padding.h;
      });
    }

    loop() {
      this.canvasMgr.clear();
      this.dots.forEach((dot) =>
        dot.clamp(this.canvasMgr.width, this.canvasMgr.height)
      );
      this.physics.update();
      this.dots.forEach((dot) => dot.draw(this.canvasMgr.ctx));
      animationId = requestAnimationFrame(() => this.loop());
    }
  }

  // =========================
  // Start game
  // =========================
  new Game();
})();
