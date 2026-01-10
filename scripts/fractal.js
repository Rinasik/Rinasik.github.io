(() => {
  // ===== Canvas setup =====
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  document.body.appendChild(canvas);

  let width = window.innerWidth;
  let height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  // ===== Mandelbrot params =====
  let scale = 3.5;
  let offsetX = -2.5;
  let offsetY = -1.0;
  const BASE_ITER = 500;

  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let zoomTimeout = null;
  const WORKER_COUNT = navigator.hardwareConcurrency || 4;

  let workers = [];
  let pendingWorkers = 0;

  // ===== Low-res grid fixed =====
  const NET_X = 64;
  const NET_Y = 64;
  let lowIter = 50;

  // ===== Web Worker code =====
  const workerCode = `
    self.onmessage = function(e){
      const {w,h,scale,offsetX,offsetY,maxIter,startY,endY} = e.data;
      const image = new Uint8ClampedArray((endY-startY)*w*4);

      function hslToRgb(h,s,l){
        let r,g,b;
        if(s===0){r=g=b=l;}
        else{
          const hue2rgb=(p,q,t)=>{
            if(t<0)t+=1;if(t>1)t-=1;
            if(t<1/6)return p+(q-p)*6*t;
            if(t<1/2)return q;
            if(t<2/3)return p+(q-p)*(2/3-t)*6;
            return p;
          };
          const q=l<0.5?l*(1+s):l+s-l*s;
          const p=2*l-q;
          r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
        }
        return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
      }

      for(let py=startY; py<endY; py++){
        for(let px=0; px<w; px++){
          const x0 = px/w*scale + offsetX;
          const y0 = py/h*scale + offsetY;
          let x=0,y=0,iter=0;
          while(iter<maxIter && x*x + y*y < 16){
            const xt = x*x - y*y + x0;
            y = 2*x*y + y0;
            x = xt;
            iter++;
          }
          const idx = ((py-startY)*w + px)*4;
          const tcol = iter/maxIter;
          if(iter===maxIter){image[idx]=30;image[idx+1]=30;image[idx+2]=30;image[idx+3]=255;}
          else{
            const hue = 280 + tcol*120;
            const lightness = 40 + tcol*30;
            const sat = 80;
            const c = hslToRgb(hue/360,sat/100,lightness/100);
            image[idx] = c[0];image[idx+1] = c[1];image[idx+2] = c[2];image[idx+3] = 255;
          }
        }
      }
      postMessage({startY,endY,image}, [image.buffer]);
    }
  `;
  const blob = new Blob([workerCode], { type: "application/javascript" });
  const workerURL = URL.createObjectURL(blob);
  for (let i = 0; i < WORKER_COUNT; i++) workers.push(new Worker(workerURL));

  // ===== Adaptive low-res render (64x64) =====
  function renderLowResGrid() {
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, width, height);

    lowIter = 50 + Math.floor(100 * Math.pow(Math.log10(3.5 / scale), 2));

    for (let i = 0; i < NET_X; i++) {
      for (let j = 0; j < NET_Y; j++) {
        const px = (i / NET_X) * width;
        const py = (j / NET_Y) * height;

        const x0 = (i / NET_X) * scale + offsetX;
        const y0 = (j / NET_Y) * scale + offsetY;
        let x = 0,
          y = 0,
          iter = 0;
        while (iter < lowIter && x * x + y * y < 16) {
          const xt = x * x - y * y + x0;
          y = 2 * x * y + y0;
          x = xt;
          iter++;
        }
        const tcol = iter / lowIter;
        let r, g, b;
        if (iter === lowIter) {
          r = g = b = 30;
        } else {
          const hue = 280 + tcol * 120;
          const lightness = 40 + tcol * 30;
          const sat = 80;
          [r, g, b] = hslToRgb(hue / 360, sat / 100, lightness / 100);
        }
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(px, py, width / NET_X + 1, height / NET_Y + 1);
      }
    }
  }

  // ===== High-res progressive render (после окончания движения) =====
  function renderHighRes() {
    const offW = width;
    const offH = height;
    let workerResults = new Array(WORKER_COUNT);
    pendingWorkers = WORKER_COUNT;

    const iter = Math.min(
      BASE_ITER + Math.floor(Math.log10(3.5 / scale) * 1000),
      4000
    );

    console.log(iter);

    const rowsPerWorker = Math.ceil(offH / WORKER_COUNT);
    workers.forEach((w, i) => {
      const startY = i * rowsPerWorker;
      const endY = Math.min(startY + rowsPerWorker, offH);
      w.onmessage = function (e) {
        const { startY, endY, image } = e.data;
        workerResults[i] = { startY, endY, image };
        pendingWorkers--;
        if (pendingWorkers === 0) drawWorkerResults(workerResults, offW, offH);
      };
      w.postMessage({
        w: offW,
        h: offH,
        scale,
        offsetX,
        offsetY,
        maxIter: iter,
        startY,
        endY,
      });
    });
  }

  function drawWorkerResults(workerResults, offW, offH) {
    const imgData = ctx.createImageData(offW, offH);
    workerResults.forEach((res) => {
      const { startY, endY, image } = res;
      imgData.data.set(image, startY * offW * 4);
    });
    ctx.putImageData(imgData, 0, 0);
  }

  function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // ===== Mouse pan =====
  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
  });
  window.addEventListener("mouseup", () => {
    isDragging = false;
  });
  window.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      offsetX -= (dx / width) * scale;
      offsetY -= (dy / height) * scale;
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
      renderLowResGrid();
      scheduleHighRes();
    }
  });

  // ===== Zoom =====
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const mouseX = e.clientX / width;
    const mouseY = e.clientY / height;
    const oldScale = scale;
    if (e.deltaY < 0) scale /= zoomFactor;
    else scale *= zoomFactor;
    offsetX += (oldScale - scale) * mouseX;
    offsetY += (oldScale - scale) * mouseY;
    renderLowResGrid();
    scheduleHighRes();
  });

  // ===== Schedule high-res after movement =====
  function scheduleHighRes() {
    if (zoomTimeout) clearTimeout(zoomTimeout);
    zoomTimeout = setTimeout(() => {
      renderHighRes();
    }, 200);
  }

  // ===== Resize =====
  function onResize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    renderLowResGrid();
    scheduleHighRes();
  }
  window.addEventListener("resize", onResize);

  // ===== Cleanup =====
  window.cleanup = () => {
    if (zoomTimeout) clearTimeout(zoomTimeout);
    workers.forEach((w) => w.terminate());
    workers = [];
    canvas.remove();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("mousemove", () => {});
    window.removeEventListener("mouseup", () => {});
    canvas.removeEventListener("mousedown", () => {});
    canvas.removeEventListener("wheel", () => {});
  };

  // ===== Initial render =====
  renderLowResGrid();
})();
