(() => {
  let animationId = null;
  const canvas = document.createElement("canvas");
  canvas.style.backgroundColor = "#30303f";

  const ctx = canvas.getContext("2d");

  const colors = ["#00b3ff", "#e9692c", "#F31260"];

  class Torch {
    constructor(canvas) {
      this.x = canvas.width / 2;
      this.y = canvas.height / 2;
      this.radius = 1000;
      this.color = "#ffffefe3";
      this.firstSphere = "#bfbfbf20";
      this.secondSphere = `#bfbfbf02`;
    }

    draw(ctx, isIntersect) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = this.color;
      ctx.fill();

      if (!isIntersect) {
        const gradient = ctx.createRadialGradient(
          this.x,
          this.y,
          0,
          this.x,
          this.y,
          this.radius
        );
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        gradient.addColorStop(0, this.firstSphere);
        gradient.addColorStop(1, this.secondSphere);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }

    move(event) {
      this.x = event.clientX;
      this.y = event.clientY;
    }
  }

  class Cube {
    constructor() {
      this.border = 20 + Math.random() * 80;
      this.rotation = Math.random() / 2;

      this.speed = 1 + Math.random() * 2;

      this.tlx = canvas.width * Math.random();
      this.tly = -this.border;
      this.coordinates = this.calcCordinates();
      this.isIntersect = false;

      this.color = colors[Math.ceil(Math.random() * 3) - 1];
      this.shadowColor = "#30303f";
      this.shadow = 2000;
    }

    drawFigure(ctx) {
      const coordinates = this.coordinates;

      ctx.beginPath();
      ctx.moveTo(coordinates[0][0], coordinates[0][1]);
      ctx.lineTo(coordinates[1][0], coordinates[1][1]);
      ctx.lineTo(coordinates[3][0], coordinates[3][1]);
      ctx.lineTo(coordinates[2][0], coordinates[2][1]);
      ctx.lineTo(coordinates[0][0], coordinates[0][1]);
      ctx.fillStyle = this.color;
      ctx.fill();

      this.isIntersect = ctx.isPointInPath(torch.x, torch.y);
    }

    drawShadow(ctx, torch) {
      const coordinates = this.coordinates;

      if (!this.isIntersect) {
        var points = [];
        coordinates.forEach((dot) => {
          const angle = Math.atan2(-torch.y + dot[1], -torch.x + dot[0]);
          const endX = dot[0] + this.shadow * Math.cos(angle);
          const endY = dot[1] + this.shadow * Math.sin(angle);
          points.push({
            endX: endX,
            endY: endY,
            startX: dot[0],
            startY: dot[1],
          });
        });

        ctx.beginPath();
        ctx.moveTo(points[0].startX, points[0].startY);
        ctx.lineTo(points[3].startX, points[3].startY);
        ctx.lineTo(points[3].endX, points[3].endY);
        ctx.lineTo(points[0].endX, points[0].endY);
        ctx.fillStyle = this.shadowColor;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(points[1].startX, points[1].startY);
        ctx.lineTo(points[2].startX, points[2].startY);
        ctx.lineTo(points[2].endX, points[2].endY);
        ctx.lineTo(points[1].endX, points[1].endY);
        ctx.fillStyle = this.shadowColor;
        ctx.fill();
      }
    }

    move() {
      this.tlx += this.speed;
      this.tly += this.speed;

      this.coordinates = this.calcCordinates();
    }

    calcCordinates() {
      return [
        [this.tlx, this.tly],
        [
          this.tlx + this.border * Math.cos(this.rotation),
          this.tly - this.border * Math.sin(this.rotation),
        ],
        [
          this.tlx + this.border * Math.sin(this.rotation),
          this.tly + this.border * Math.cos(this.rotation),
        ],
        [
          this.tlx +
            this.border * (Math.sin(this.rotation) + Math.cos(this.rotation)),
          this.tly +
            this.border * (-Math.sin(this.rotation) + Math.cos(this.rotation)),
        ],
      ];
    }
  }

  const torch = new Torch(canvas);
  let cubes = [new Cube(), new Cube(), new Cube()];

  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isIntersect = cubes.map((cube) => cube.isIntersect).includes(true);

    torch.draw(ctx, isIntersect);
    cubes = cubes.reduce((acc, elem) => {
      elem.move();
      if (
        elem.tlx - elem.border > canvas.width ||
        elem.tly - elem.border > canvas.height
      ) {
        acc.push(new Cube());
      } else {
        acc.push(elem);
      }

      acc[acc.length - 1].drawShadow(ctx, torch);

      return acc;
    }, []);

    cubes.forEach((cube) => cube.drawFigure(ctx));

    animationId = requestAnimationFrame(drawFrame);
  }

  function handleResize() {
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
  }

  function init() {
    handleResize();
    window.addEventListener("resize", handleResize);
    document.addEventListener("mousemove", torch.move.bind(torch));

    document.body.appendChild(canvas);

    drawFrame();

    window.cleanup = () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }

      window.removeEventListener("resize", handleResize);
      document.removeEventListener("mousemove", torch.move);

      canvas.remove();
    };
  }

  init();
})();
