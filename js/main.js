/* ScrollAlbum — landing site interactions
 *
 * 目玉は「縦スクロール量を横移動に変換するタイムライン」。アプリの核である
 * 横スクロール体験をそのままページ上で再現する。
 * 依存ライブラリなし（GitHub Pages にそのまま置ける）。
 */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- ナビの影 ---------- */
  var nav = document.querySelector(".nav");
  if (nav) {
    var onNav = function () { nav.classList.toggle("is-stuck", window.scrollY > 8); };
    onNav();
    window.addEventListener("scroll", onNav, { passive: true });
  }

  /* ---------- ヒーローの手描き下線 ---------- */
  var hero = document.querySelector(".hero");
  if (hero) requestAnimationFrame(function () { hero.classList.add("is-ready"); });

  /* ---------- 出現アニメーション ---------- */
  var revealables = document.querySelectorAll(".reveal");
  if (revealables.length) {
    if (reduced || !("IntersectionObserver" in window)) {
      revealables.forEach(function (el) { el.classList.add("in"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0.1 });
      revealables.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---------- 横スクロール・タイムライン ---------- */
  var timeline = document.querySelector(".timeline");
  var rail = timeline && timeline.querySelector(".rail");
  var bar = timeline && timeline.querySelector(".rail-progress i");

  if (timeline && rail) {
    // 動きを抑える設定・細い画面ではネイティブの横スクロールに切り替える。
    var narrow = window.matchMedia("(max-width: 720px)");

    var useFallback = function () { return reduced || narrow.matches; };

    var maxShift = 0;

    var measure = function () {
      // 最後のアイテムの右端が画面右端に来るまでの移動量。
      maxShift = Math.max(0, rail.scrollWidth - timeline.clientWidth);
      // sticky 区間の長さを中身の量に合わせる（枚数を変えても破綻しない）。
      if (!useFallback()) {
        var vh = window.innerHeight;
        timeline.style.height = (vh + maxShift * 0.92) + "px";
      } else {
        timeline.style.height = "";
      }
    };

    var update = function () {
      if (useFallback()) return;
      var rect = timeline.getBoundingClientRect();
      var total = timeline.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      var p = Math.min(1, Math.max(0, -rect.top / total));
      rail.style.transform = "translate3d(" + (-p * maxShift).toFixed(2) + "px,0,0)";
      if (bar) bar.style.width = (p * 100).toFixed(1) + "%";
    };

    var applyMode = function () {
      var fb = useFallback();
      timeline.classList.toggle("is-fallback", fb);
      if (fb) rail.style.transform = "";
      measure();
      update();
    };

    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { update(); ticking = false; });
    };

    applyMode();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", applyMode);
    if (narrow.addEventListener) narrow.addEventListener("change", applyMode);

    // 画像の読み込みで幅が変わるので、揃ってから測り直す。
    window.addEventListener("load", applyMode);
    rail.querySelectorAll("img").forEach(function (img) {
      if (!img.complete) img.addEventListener("load", measure, { once: true });
    });
  }

  /* ---------- App Store ギャラリー（ドラッグ / 矢印 / ドット） ---------- */
  document.querySelectorAll("[data-gallery]").forEach(function (root) {
    var track = root.querySelector(".gallery-track");
    var prev = root.querySelector("[data-prev]");
    var next = root.querySelector("[data-next]");
    var dots = root.querySelector(".dots");
    if (!track) return;

    var slides = Array.prototype.slice.call(track.children);

    if (dots) {
      slides.forEach(function () { dots.appendChild(document.createElement("i")); });
    }

    var step = function () {
      if (!slides.length) return track.clientWidth;
      var s = slides[0];
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
      return s.getBoundingClientRect().width + gap;
    };

    var sync = function () {
      var i = Math.round(track.scrollLeft / step());
      if (dots) {
        Array.prototype.forEach.call(dots.children, function (d, n) {
          d.classList.toggle("on", n === i);
        });
      }
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    };

    var go = function (dir) {
      track.scrollBy({ left: dir * step(), behavior: reduced ? "auto" : "smooth" });
    };

    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });
    track.addEventListener("scroll", function () {
      window.clearTimeout(track._t);
      track._t = window.setTimeout(sync, 60);
    }, { passive: true });

    // ポインタでのドラッグ横送り。
    var down = false, startX = 0, startLeft = 0, moved = 0;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch") return; // タッチはネイティブのスクロールに任せる
      down = true; moved = 0;
      startX = e.clientX; startLeft = track.scrollLeft;
      track.classList.add("is-dragging");
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      track.scrollLeft = startLeft - dx;
    });
    var release = function (e) {
      if (!down) return;
      down = false;
      track.classList.remove("is-dragging");
      try { track.releasePointerCapture(e.pointerId); } catch (_) {}
      sync();
    };
    track.addEventListener("pointerup", release);
    track.addEventListener("pointercancel", release);
    // ドラッグ直後のクリックを打ち消す。
    track.addEventListener("click", function (e) {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // 左右キー。
    track.setAttribute("tabindex", "0");
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    });

    sync();
    window.addEventListener("resize", sync);
  });

  /* ---------- 目次のスムーススクロール（ヘッダー分を引く） ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 78;
      window.scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" });
      history.replaceState(null, "", id);
    });
  });
})();
