(() => {
  let animationId = null;
  const uiDiv = document.createElement("div");

  class Metrica {
    constructor({ height, width }) {
      this._height = height;
      this._width = width;
    }
    get width() {
      return this._width;
    }
    get height() {
      return this._height;
    }

    set width(newValue) {
      this._width = newValue;
    }

    set height(newValue) {
      this._height = newValue;
    }
  }

  class XoY {
    constructor({ x, y }) {
      this._y = y;
      this._x = x;
    }
    get x() {
      return this._x;
    }
    get y() {
      return this._y;
    }

    set x(newValue) {
      this._x = newValue;
    }

    set y(newValue) {
      this._y = newValue;
    }
  }

  class MouseDot {
    constructor() {
      this.pos = new XoY({ x: 400, y: 400 });
      this.radius = 50;
      this.mass = 1;

      this.isMouse = true;
    }
    draw(ctx) {
      let height = this.pos.y;
      let width = this.pos.x;

      if (width - this.radius < 0) {
        width = this.radius;
      } else if (width + this.radius > metrica.width) {
        width = metrica.width - this.radius;
      }

      if (height - this.radius < 0) {
        height = this.radius;
      } else if (height + this.radius > metrica.height) {
        height = metrica.height - this.radius;
      }

      ctx.beginPath();
      ctx.fillStyle = "#f31260";

      ctx.arc(width, height, this.radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  class Dot {
    constructor({ x, y }) {
      this.pos = new XoY({ y, x });
      this.vel = new XoY({ x: 0, y: 0 });

      this.radius = Math.random() * 10 + 20;
      this.mass = Math.random() / 10;

      const alpha = Math.random() + 0.1;

      this.color = `rgba(243, 18, 96, ${alpha})`;

      this.isMouse = false;
    }

    draw(ctx) {
      this.pos.x += this.vel.x;
      this.pos.y += this.vel.y;

      ctx.globalAplha = this.alpha;

      ctx.beginPath();
      ctx.fillStyle = this.color;

      ctx.arc(this.pos.x, this.pos.y, this.radius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.globalAplha = 1;
    }
  }

  const canvas = document.createElement("canvas");

  const ctx = canvas.getContext("2d");

  const hPadding = 10;
  const wPadding = 20;
  document.body.style.backgroundColor = "#383838";
  document.body.style.padding = `${hPadding}px ${wPadding}px`;

  const sphereRad = 250;
  const smallSphere = 10;
  const smooth = 0.85;
  let distanceExponent = 1;

  let metrica = new Metrica(document.body.getBoundingClientRect());
  const mouseDot = new MouseDot();

  const dots = [mouseDot];

  const updateDots = (ctx) => {
    dots.map((currentDot, currIndex) => {
      if (currentDot.isMouse) {
        return;
      }
      let acc = new XoY({ x: 0, y: 0 });

      dots.map((calcDot, index) => {
        if (currIndex === index) {
          return;
        }
        const delta = new XoY({
          x: calcDot.pos.x - currentDot.pos.x,
          y: calcDot.pos.y - currentDot.pos.y,
        });
        const dist = Math.sqrt(delta.x * delta.x + delta.y * delta.y) || 1;

        let force =
          ((dist - sphereRad) / Math.pow(dist, distanceExponent)) *
          calcDot.mass *
          currentDot.mass;

        if (calcDot.isMouse) {
          const sumOfRadius = currentDot.radius + calcDot.radius;

          if (dist > sumOfRadius + 2 * smallSphere) {
            force = calcDot.mass / Math.pow(dist, distanceExponent);
          } else {
            force =
              ((dist - sumOfRadius - smallSphere) /
                Math.pow(dist, distanceExponent)) *
              calcDot.mass;
          }
        }

        acc.x += delta.x * force;
        acc.y += delta.y * force;
      });

      currentDot.vel.x = currentDot.vel.x * smooth + acc.x;
      currentDot.vel.y = currentDot.vel.y * smooth + acc.y;
    });

    dots.map((dot) => dot.draw(ctx));
  };

  const init = () => {
    const handleResize = () => {
      const height = window.innerHeight;
      const width = window.innerWidth;

      metrica = new Metrica({
        width: width - 2 * wPadding,
        height: height - 2 * hPadding - 2,
      });
      document.body.style.height = `${height - 2 * hPadding - 2}px`;
    };

    const handleClick = (event) => {
      dots.push(
        new Dot({
          y: event.clientY - hPadding,
          x: event.clientX - wPadding,
        })
      );
    };

    const handleMove = (event) => {
      mouseDot.pos = new XoY({
        y: event.clientY - hPadding,
        x: event.clientX - wPadding,
      });
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    window.addEventListener("mousemove", handleMove);
    window.document.body.addEventListener("click", handleClick);

    document.body.appendChild(canvas);

    uiDiv.id = "physics-ui";
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
    uiDiv.innerHTML = `
      <label for="distanceExponent">Distance exponent: <span id="exp-value">1</span></label>
      <input type="range" id="distanceExponent" min="0.7" max="1.5" step="0.05" value="1" style="width:150px">
    `;
    document.body.appendChild(uiDiv);

    const expSlider = document.getElementById("distanceExponent");
    const expValue = document.getElementById("exp-value");

    expSlider.addEventListener("input", (e) => {
      distanceExponent = parseFloat(e.target.value);
      expValue.textContent = distanceExponent.toFixed(2);
    });

    draw();

    window.cleanup = () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }

      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMove);
      document.body.removeEventListener("click", handleClick);

      dots.length = 0;

      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }

      document.body.removeChild(uiDiv);
    };
  };

  const draw = () => {
    canvas.height = metrica.height;
    canvas.width = metrica.width;

    ctx.clearRect(0, 0, metrica.width, metrica.height);
    updateDots(ctx);

    animationId = requestAnimationFrame(draw);
  };

  init();
})();
