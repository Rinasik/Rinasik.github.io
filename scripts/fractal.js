(() => {
  // ================= Canvas setup =================
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  canvas.style.touchAction = "none";
  document.body.appendChild(canvas);

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  // ================= Mandelbrot params =================
  let scale = 3.5;
  let offsetX = -2.5;
  let offsetY = -1.0;

  const BASE_ITER = 300;
  const MAX_ITER = 4000;
  const LOW_RES_MAX_ITER = 9000;

  // ================= State =================
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let zoomTimeout = null;

  let renderToken = 0;
  let pendingWorkers = 0;

  const WORKER_COUNT = navigator.hardwareConcurrency || 4;
  const workers = [];

  // ================= Low-res grid =================
  const NET_X = 64;
  const NET_Y = 64;
  let lowIter = 50;

  // ================= LUT =================
  const LUT_SIZE = 2048;
  const LUT = new Uint8ClampedArray(LUT_SIZE * 3);
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1);
    LUT[i * 3] = 80 + t * 175;
    LUT[i * 3 + 1] = 30 + t * 100;
    LUT[i * 3 + 2] = 120 + t * 135;
  }

  function getColorLUT(t) {
    const idx = Math.min(Math.floor(t * (LUT_SIZE - 1)), LUT_SIZE - 1) * 3;
    return [LUT[idx], LUT[idx + 1], LUT[idx + 2]];
  }

  function canZoomIn() {
    return lowIter < LOW_RES_MAX_ITER;
  }

  // ================= Worker =================
  const workerCode = `
    self.onmessage = async function(e){
      const { token, w, h, scale, offsetX, offsetY, maxIter, startY, endY, tileSize, LUT } = e.data;

      const off = new OffscreenCanvas(w, endY - startY);
      const ctx = off.getContext('2d');
      const img = ctx.createImageData(w, endY - startY);
      const lut = new Uint8ClampedArray(LUT);

      for(let ty=0; ty<endY-startY; ty+=tileSize){
        for(let tx=0; tx<w; tx+=tileSize){
          const tH = Math.min(tileSize, endY - startY - ty);
          const tW = Math.min(tileSize, w - tx);

          for(let py=0; py<tH; py++){
            for(let px=0; px<tW; px++){
              const x0 = (tx + px)/w * scale + offsetX;
              const y0 = (startY + ty + py)/h * scale + offsetY;
              let x = 0, y = 0, iter = 0;
              while(iter < maxIter && x*x + y*y < 4){
                const xt = x*x - y*y + x0;
                y = 2*x*y + y0;
                x = xt;
                iter++;
              }
              const idx = ((ty + py) * w + (tx + px)) * 4;
              if(iter === maxIter){
                img.data[idx] = img.data[idx+1] = img.data[idx+2] = 30;
              }else{
                const t = iter/maxIter;
                const lutIdx = Math.floor(t * (lut.length/3 - 1)) * 3;
                img.data[idx] = lut[lutIdx];
                img.data[idx+1] = lut[lutIdx+1];
                img.data[idx+2] = lut[lutIdx+2];
              }
              img.data[idx+3] = 255;
            }
          }
        }
      }

      const bitmap = await createImageBitmap(img);
      postMessage({ token, startY, bitmap }, [bitmap]);
    };
  `;
  const workerURL = URL.createObjectURL(new Blob([workerCode], { type: "application/javascript" }));
  for (let i = 0; i < WORKER_COUNT; i++) workers.push(new Worker(workerURL));

  // ================= Low-res =================
  function renderLowRes() {
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, width, height);

    lowIter = Math.min(
      Math.floor(50 + 200 * Math.pow(Math.log10(3.5 / scale), 2)),
      LOW_RES_MAX_ITER
    );

    for (let i = 0; i < NET_X; i++) {
      for (let j = 0; j < NET_Y; j++) {
        const x0 = (i / NET_X) * scale + offsetX;
        const y0 = (j / NET_Y) * scale + offsetY;

        let x = 0, y = 0, iter = 0;
        while (iter < lowIter && x * x + y * y < 4) {
          const xt = x * x - y * y + x0;
          y = 2 * x * y + y0;
          x = xt;
          iter++;
        }

        const t = iter / lowIter;
        const [r, g, b] = iter === lowIter ? [34, 34, 34] : getColorLUT(t);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(
          (i / NET_X) * width,
          (j / NET_Y) * height,
          width / NET_X + 1,
          height / NET_Y + 1
        );
      }
    }
  }

  // ================= Progressive High-res =================
  function progressiveHighRes() {
    const myToken = ++renderToken;
    const targetIter = Math.min(BASE_ITER + Math.floor(Math.log10(3.5 / scale) * 1000), MAX_ITER);

    const tileSize = 64;
    const imgHeight = height;

    pendingWorkers = WORKER_COUNT;
    const imgBitmaps = new Array(WORKER_COUNT);
    const rows = Math.ceil(height / WORKER_COUNT);

    workers.forEach((w, i) => {
      const startY = i * rows;
      const endY = Math.min(startY + rows, height);

      w.onmessage = (e) => {
        if (e.data.token !== myToken) return;
        imgBitmaps[i] = e.data.bitmap;
        if (--pendingWorkers === 0) {
          imgBitmaps.forEach((b, idx) => ctx.drawImage(b, 0, idx * rows));
        }
      };

      w.postMessage({
        token: myToken,
        w: width,
        h: height,
        scale,
        offsetX,
        offsetY,
        maxIter: targetIter,
        startY,
        endY,
        tileSize,
        LUT,
      });
    });
  }

  function scheduleHighRes() {
    clearTimeout(zoomTimeout);
    zoomTimeout = setTimeout(progressiveHighRes, 200);
  }

  // ================= Input =================
  const onMouseDown = (e) => { isDragging = true; dragStart.x = e.clientX; dragStart.y = e.clientY; };
  const onMouseMove = (e) => {
    if (!isDragging) return;
    offsetX -= ((e.clientX - dragStart.x) / width) * scale;
    offsetY -= ((e.clientY - dragStart.y) / height) * scale;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    renderLowRes();
    scheduleHighRes();
  };
  const onMouseUp = () => (isDragging = false);

  const onWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0 && !canZoomIn()) return;
    const oldScale = scale;
    scale *= e.deltaY < 0 ? 0.9 : 1.1;
    offsetX += (oldScale - scale) * (e.clientX / width);
    offsetY += (oldScale - scale) * (e.clientY / height);
    renderLowRes();
    scheduleHighRes();
  };

  // ================= Touch support =================
  let touchStartDist = 0;
  let touchStartScale = 0;
  let isTouchZoom = false;

  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      dragStart.x = e.touches[0].clientX;
      dragStart.y = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      isTouchZoom = true;
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDist = Math.hypot(dx, dy);
      touchStartScale = scale;
    }
  };

  const onTouchMove = (e) => {
    e.preventDefault();
    if (isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      offsetX -= ((touch.clientX - dragStart.x) / width) * scale;
      offsetY -= ((touch.clientY - dragStart.y) / height) * scale;
      dragStart.x = touch.clientX;
      dragStart.y = touch.clientY;
      renderLowRes();
      scheduleHighRes();
    } else if (isTouchZoom && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const zoomFactor = touchStartDist / dist;
      const oldScale = scale;
      scale = touchStartScale * zoomFactor;
      offsetX += (oldScale - scale) * 0.5;
      offsetY += (oldScale - scale) * 0.5;
      renderLowRes();
      scheduleHighRes();
    }
  };

  const onTouchEnd = (e) => {
    if (e.touches.length === 0) {
      isDragging = false;
      isTouchZoom = false;
    }
  };

  const onResize = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    renderLowRes();
    scheduleHighRes();
  };

  // ================= Attach events =================
  canvas.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd);

  window.addEventListener("resize", onResize);

  // ================= Cleanup =================
  window.cleanup = () => {
    clearTimeout(zoomTimeout);
    workers.forEach((w) => w.terminate());
    canvas.remove();

    canvas.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    canvas.removeEventListener("wheel", onWheel);

    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchmove", onTouchMove);
    canvas.removeEventListener("touchend", onTouchEnd);

    window.removeEventListener("resize", onResize);
  };

  // ================= Start =================
  renderLowRes();
  scheduleHighRes();
})();
