// a grey area — small enhancements: collage parallax and loop playback.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wide = window.matchMedia ? window.matchMedia('(min-width: 761px)') : { matches: true };

  // Parallax: collage shots move at different speeds while scrolling (desktop only).
  var shots = Array.prototype.slice.call(document.querySelectorAll('.shot[data-speed]'));
  if (shots.length && !reduce) {
    var ticking = false;
    var apply = function () {
      ticking = false;
      var y = window.scrollY || window.pageYOffset || 0;
      shots.forEach(function (el) {
        var s = parseFloat(el.getAttribute('data-speed')) || 0;
        el.style.transform = wide.matches ? 'translate3d(0,' + Math.round(-y * s) + 'px,0)' : '';
      });
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(apply); }
    }, { passive: true });
    window.addEventListener('resize', apply);
    apply();
  }

  // Loops: only play while on screen; never play when reduced motion is requested.
  var videos = Array.prototype.slice.call(document.querySelectorAll('video[autoplay]'));
  videos.forEach(function (v) { v.muted = true; });
  if (reduce) {
    videos.forEach(function (v) { v.removeAttribute('autoplay'); v.pause(); });
    return;
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function () {}); }
        else e.target.pause();
      });
    }, { rootMargin: '200px 0px' });
    videos.forEach(function (v) { io.observe(v); });
  }

  // Coded reveal: each collage shot is drawn as a grey "coded" version of its own
  // image or loop, which resolves into the real thing on hover (or, on touch screens,
  // when it reaches the middle of the screen). Style: pixels | dots | lines | off,
  // set in content/site.json, or try one with ?reveal=dots on the address.
  var param = null;
  try { param = new URLSearchParams(window.location.search).get('reveal'); } catch (e) {}
  var style = param || document.body.getAttribute('data-reveal') || 'pixels';
  if (style === 'off' || !shots.length || !window.HTMLCanvasElement) return;

  var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  var BG = [37, 37, 37];
  var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  shots.forEach(function (shot) {
    var media = shot.querySelector('img, video');
    if (!media) return;
    var isVideo = media.tagName === 'VIDEO';
    var cv = document.createElement('canvas');
    cv.className = 'code';
    cv.setAttribute('aria-hidden', 'true');
    shot.appendChild(cv);
    var ctx = cv.getContext('2d');
    var small = document.createElement('canvas');
    var sctx = small.getContext('2d', { willReadFrequently: true });

    var p = 0, target = 0, inView = false, running = false, lastT = 0, lastDraw = 0, dirty = true;

    function resize() {
      var r = shot.getBoundingClientRect();
      var d = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(r.width * d));
      cv.height = Math.max(1, Math.round(r.height * d));
      dirty = true;
    }
    function ready() {
      return isVideo ? media.readyState >= 2 && media.videoWidth > 0 : media.complete && media.naturalWidth > 0;
    }

    function draw() {
      var W = cv.width, H = cv.height;
      ctx.fillStyle = 'rgb(' + BG.join(',') + ')';
      ctx.fillRect(0, 0, W, H);
      if (!ready()) return false;
      var e = ease(p);
      var base = Math.max(10, W / 30);
      var cell = base * (1 - e) + Math.max(3, W / 160) * e;
      var cols = Math.max(4, Math.round(W / cell)), rows = Math.max(3, Math.round(H / cell));
      small.width = cols; small.height = rows;
      var sw = media.videoWidth || media.naturalWidth, sh = media.videoHeight || media.naturalHeight;
      var s = Math.max(cols / sw, rows / sh), dw = sw * s, dh = sh * s;
      sctx.drawImage(media, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
      var px = sctx.getImageData(0, 0, cols, rows).data;
      var cw = W / cols, ch = H / rows, gap = Math.max(1, cw * 0.12);
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var i = (y * cols + x) * 4;
          var l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
          l = Math.min(1, Math.pow(l, 0.7) * 1.25);
          if (style === 'dots') {
            var rad = (Math.min(cw, ch) / 2) * Math.sqrt(l) * 0.95;
            if (rad < 0.4) continue;
            ctx.fillStyle = 'rgb(214,214,214)';
            ctx.beginPath();
            ctx.arc(x * cw + cw / 2, y * ch + ch / 2, rad, 0, 6.2832);
            ctx.fill();
          } else if (style === 'lines') {
            var th = ch * 0.85 * l;
            if (th < 0.4) continue;
            ctx.fillStyle = 'rgb(214,214,214)';
            ctx.fillRect(x * cw, y * ch + (ch - th) / 2, cw + 0.5, th);
          } else {
            var q = Math.round(l * 6) / 6;
            var g = Math.round(BG[0] + q * (232 - BG[0]));
            ctx.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')';
            ctx.fillRect(x * cw, y * ch, cw - gap, ch - gap);
          }
        }
      }
      return true;
    }

    function frame(t) {
      var dt = lastT ? Math.min(64, t - lastT) : 16;
      lastT = t;
      var step = dt / 750;
      var moving = p !== target;
      if (moving) {
        p = target > p ? Math.min(target, p + step) : Math.max(target, p - step * 1.4);
        dirty = true;
      }
      cv.style.opacity = String(1 - Math.min(1, Math.max(0, (p - 0.55) / 0.45)));
      var fullyRevealed = p === 1;
      var videoTick = isVideo && !fullyRevealed && t - lastDraw > 41;
      if (!fullyRevealed && (dirty || videoTick)) {
        if (draw()) { dirty = false; lastDraw = t; }
      }
      var keepGoing = inView && (moving || (isVideo && !fullyRevealed) || dirty);
      if (keepGoing) window.requestAnimationFrame(frame);
      else { running = false; lastT = 0; }
    }
    function kick() {
      if (!running) { running = true; window.requestAnimationFrame(frame); }
    }
    function reveal(on) { target = on ? 1 : 0; kick(); }

    resize();
    window.addEventListener('resize', function () { resize(); kick(); });
    if (isVideo) media.addEventListener('loadeddata', function () { dirty = true; kick(); });
    else if (!media.complete) media.addEventListener('load', function () { dirty = true; kick(); });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) kick();
      }, { rootMargin: '100px 0px' }).observe(shot);
    } else { inView = true; kick(); }

    if (canHover) {
      shot.addEventListener('mouseenter', function () { reveal(true); });
      shot.addEventListener('mouseleave', function () { reveal(false); });
      shot.addEventListener('focus', function () { reveal(true); });
      shot.addEventListener('blur', function () { reveal(false); });
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        reveal(entries[0].isIntersecting);
      }, { rootMargin: '-38% 0px -38% 0px' }).observe(shot);
    }
  });
})();
