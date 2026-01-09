(() => {
  let animationId = null;
  const canvas = document.createElement("canvas");
  canvas.style.backgroundColor = "#230041";

  const ALPHA = 0.012;

  const NET_FREQUENCY_X = 60;
  const NET_FREQUENCY_Y = 30;
  const EXTRA_POINTS = 15;

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

  const ctx = canvas.getContext("2d");

  let dots = [];
  const dotsAplha = [];
  const dotsColor = [];

  class Dot {
    constructor(initial_x, initial_y) {
      this.x = initial_x;
      this.y = initial_y;
      this.trail = [];
    }

    Draw(ctx) {
      this.trail.forEach(([x, y], index) => {
        if (index % TRAIL_DIVISION) {
          return;
        }

        const prepared_index = index / TRAIL_DIVISION;

        ctx.fillStyle = `rgba(${dotsColor[prepared_index]}, ${dotsAplha[prepared_index]})`;
        ctx.fillRect(x, y, 2, 2);
      });

      ctx.beginPath();
      ctx.fillStyle = `rgba(${DOT_START}, 1)`;
      ctx.fillRect(this.x, this.y, 3, 3);
    }

    UpdateVelocity() {
      const { width, height } = canvas.getBoundingClientRect();

      this.vel_x = Math.cos(ALPHA * (this.y - height / 2));
      this.vel_y = Math.sin(ALPHA * this.x - width / 2);
    }

    UpdateCoordinates() {
      this.trail.length == TRAIL_LENGTH && this.trail.shift();
      this.trail.push([this.x, this.y]);

      this.x += this.vel_x;
      this.y += this.vel_y;
    }
  }

  function initDots(width, height) {
    const deltax = width / NET_FREQUENCY_X;
    const deltay = height / NET_FREQUENCY_Y;

    for (
      let i = -EXTRA_POINTS / 2;
      i < NET_FREQUENCY_X + 1 + EXTRA_POINTS / 2;
      ++i
    ) {
      for (
        let j = -EXTRA_POINTS / 2;
        j < NET_FREQUENCY_Y + 1 + EXTRA_POINTS / 2;
        ++j
      ) {
        dots.push(new Dot(deltax * i, deltay * j));
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

  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    dots.forEach((dot) => {
      dot.Draw(ctx);
      dot.UpdateVelocity();
      dot.UpdateCoordinates();
    });

    animationId = requestAnimationFrame(drawFrame);
  }

  function handleResize() {
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;

    dots = [];
    initDots(window.innerWidth, window.innerHeight);
  }

  function init() {
    canvas.width = canvas.width * 3;
    canvas.height = canvas.height * 3;
    ctx.scale(3, 3);

    handleResize();
    window.addEventListener("resize", handleResize);

    document.body.appendChild(canvas);

    drawFrame();

    window.cleanup = () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }

      window.removeEventListener("resize", handleResize);

      dots.length = 0;
      dotsAplha.length = 0;
      dotsColor.length = 0;

      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }

  init();
})();
