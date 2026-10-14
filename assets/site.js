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
})();
