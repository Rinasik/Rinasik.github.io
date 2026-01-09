(() => {
  let animationId = null;
  const canvas = document.createElement("canvas");
  canvas.style.backgroundColor = "#020109";

  const ctx = canvas.getContext("2d");

  const mousePos = { x: 0, y: 0 };
  const parallax = { x: 0, y: 0 };
  const holeCenter = { x: 0, y: 0 };

  const extension = 0.15;
  const coef = 4;
  const count = 1000;
  const maxOrbit = 500;
  const minOrbit = 200;
  const orbitFactor = maxOrbit - minOrbit;
  const parallaxFactor = Math.PI / 10;

  function handleResize() {
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;

    holeCenter.x = window.innerWidth / 2;
    holeCenter.y = window.innerHeight / 2;
  }

  class Dot {
    constructor() {
      this.initialRadius = Math.random() * 5 + 5;
      this.radius = this.initialRadius;
      this.orbit = Math.random() * orbitFactor + minOrbit;
      /**
       * Должен в пределах от -Pi/2 до Pi/2
       */
      this.inclination =
        ((Math.PI - parallaxFactor) *
          Math.random() *
          (1 - (this.orbit - minOrbit) / minOrbit)) /
        2;
      this.angle = Math.random() * 2 * Math.PI;

      this.velocity = 50 * Math.sqrt(1 / Math.pow(this.orbit, 3));
      this.alpha = 1;
      this.color = `243, 18, 96`;
    }

    Draw(ctx, mousePos, center) {
      const cos = Math.cos(this.angle);
      const sin = Math.sin(this.angle);

      const parallaxedInclination =
        this.inclination + parallaxFactor * parallax.y;

      const x = this.orbit * cos + center.x;
      const y =
        Math.sin(parallaxedInclination) * this.orbit * sin +
        center.y -
        (parallax.x * cos * this.orbit) / 5;

      const distance = Math.hypot(mousePos.x - x, mousePos.y - y);

      if (distance > coef * this.initialRadius) {
        if (this.radius > this.initialRadius) {
          this.radius -= extension * this.initialRadius;
          this.alpha += extension;
        }
      } else {
        if (this.radius < 2 * this.initialRadius) {
          this.radius += extension * this.initialRadius;
          this.alpha -= extension;
        }
        ctx.beginPath();

        ctx.strokeStyle = `rgb(${this.color})`;
        ctx.arc(x, y, this.radius, 0, 2 * Math.PI);

        ctx.stroke();
      }
      ctx.beginPath();

      ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;

      const size =
        Math.sin(((this.angle + Math.PI / 2) / 2) % Math.PI) *
        Math.cos(parallaxedInclination % (Math.PI / 2)) *
        this.radius;
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fill();
    }

    UpdatePosition() {
      this.angle = (this.angle + this.velocity) % (2 * Math.PI);
    }
  }

  const dots = [];

  function updateDots(ctx) {
    dots.map((dot) => dot.Draw(ctx, mousePos, holeCenter));
    dots.map((dot) => dot.UpdatePosition());
  }

  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Отрисовка центра притяжения
    const gradient = ctx.createRadialGradient(
      holeCenter.x,
      holeCenter.y,
      50,
      holeCenter.x,
      holeCenter.y,
      300
    );
    gradient.addColorStop(0, "rgba(255, 191,3,1)");
    gradient.addColorStop(0.15, "rgba(255, 191,3,1)");
    gradient.addColorStop(0.2, "rgba(255, 108,3,1)");
    gradient.addColorStop(0.4, "rgba(255, 90,3,1)");
    gradient.addColorStop(1, "#020109");

    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(holeCenter.x, holeCenter.y, 300, 0, 2 * Math.PI);
    ctx.fill();

    updateDots(ctx);

    animationId = requestAnimationFrame(drawFrame);
  }

  function handleMove(e) {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;

    parallax.x = e.clientX / holeCenter.x - 1;
    parallax.y = e.clientY / holeCenter.y - 1;
  }

  function init() {
    canvas.width = canvas.width * 3;
    canvas.height = canvas.height * 3;
    ctx.scale(3, 3);

    for (let i = 0; i < count; ++i) {
      dots.push(new Dot());
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMove);

    document.body.appendChild(canvas);

    drawFrame();

    window.cleanup = () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }

      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMove);

      dots.length = 0;

      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }

  init();
})();
