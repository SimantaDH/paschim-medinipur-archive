/* =====================================================================
   Chitragāthā — deep map

   A real map of West Bengal, drawn as SVG from Census 2011 district
   boundaries (DataMeet India community, CC BY 4.0 — credited on the
   Credits page). No tile server, no map library, no runtime dependency
   on anyone else's infrastructure: the whole thing is one JSON of path
   data plus this file, so it keeps working exactly as long as the rest
   of the site does.

   Each page declares its own sites in a <div data-deepmap> element, and
   the component zooms between the state, the district, and individual
   fieldwork locations by animating the SVG viewBox.
   ===================================================================== */
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";

  function reducedMotion() {
    return document.documentElement.getAttribute("data-motion") === "reduced" ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function DeepMap(host, data) {
    this.host = host;
    this.data = data;
    this.proj = data.projection;
    this.sites = JSON.parse(host.getAttribute("data-sites") || "[]");
    this.focusName = host.getAttribute("data-focus") || "Pashchim Medinipur";
    this.anim = null;
    this.activeSite = -1;
    this.build();
  }

  DeepMap.prototype.project = function (lat, lon) {
    var p = this.proj;
    return {
      x: (lon - p.lon0) * p.kx * p.scale + p.pad,
      y: (p.lat1 - lat) * p.scale + p.pad
    };
  };

  // viewBox for a lat/lon bounding box, padded, keeping the frame's aspect
  DeepMap.prototype.boxFor = function (bbox, padFrac) {
    var a = this.project(bbox[3], bbox[0]), b = this.project(bbox[1], bbox[2]);
    var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    var w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    var pad = (padFrac === undefined ? 0.08 : padFrac);
    x -= w * pad; y -= h * pad; w *= (1 + pad * 2); h *= (1 + pad * 2);
    return this.fit(x, y, w, h);
  };

  // widen or heighten a box so it matches the viewport's aspect ratio,
  // otherwise the browser letterboxes it and the zoom looks off-centre
  DeepMap.prototype.fit = function (x, y, w, h) {
    var r = this.frame.clientWidth / Math.max(1, this.frame.clientHeight);
    if (!isFinite(r) || r <= 0) r = 1;
    if (w / h < r) { var nw = h * r; x -= (nw - w) / 2; w = nw; }
    else { var nh = w / r; y -= (nh - h) / 2; h = nh; }
    return [x, y, w, h];
  };

  DeepMap.prototype.build = function () {
    var self = this;
    var vb = this.data.viewBox.split(" ").map(Number);

    this.frame = document.createElement("div");
    this.frame.className = "dm-frame";
    this.host.appendChild(this.frame);

    var svg = el("svg", {
      viewBox: this.data.viewBox,
      preserveAspectRatio: "xMidYMid meet",
      role: "img",
      "aria-label": "Map of West Bengal with the fieldwork locations in Paschim Medinipur marked"
    }, this.frame);
    this.svg = svg;
    this.home = this.fit(vb[0], vb[1], vb[2], vb[3]);

    var defs = el("defs", {}, svg);
    var glow = el("filter", { id: "dm-glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
    el("feGaussianBlur", { stdDeviation: "6", result: "b" }, glow);
    var mg = el("feMerge", {}, glow);
    el("feMergeNode", { in: "b" }, mg);
    el("feMergeNode", { in: "SourceGraphic" }, mg);

    this.gGrid = el("g", { class: "dm-grid" }, svg);
    this.gDistricts = el("g", { class: "dm-districts" }, svg);
    this.gMarkers = el("g", { class: "dm-markers" }, svg);
    this.buildGrid();

    // --- districts -------------------------------------------------
    this.focusBbox = null;
    this.data.districts.forEach(function (d) {
      var p = el("path", {
        d: d.d,
        class: "dm-district" + (d.focus ? " dm-focus" : ""),
        "data-name": d.name
      }, self.gDistricts);
      if (d.focus) {
        self.focusBbox = d.bbox;
        p.setAttribute("filter", "url(#dm-glow)");
      }
      p.addEventListener("mouseenter", function () { self.showHint(d.name); });
      p.addEventListener("mouseleave", function () { self.hideHint(); });
    });

    // --- site markers ----------------------------------------------
    this.markerEls = this.sites.map(function (s, i) {
      var pt = self.project(s.lat, s.lon);
      var g = el("g", {
        class: "dm-marker",
        transform: "translate(" + pt.x.toFixed(1) + "," + pt.y.toFixed(1) + ")",
        tabindex: "0",
        role: "button",
        "aria-label": s.name + " — " + (s.participants ? s.participants.length : 0) + " participants"
      }, self.gMarkers);
      // a generous invisible hit area: the visible pin is deliberately small,
      // but a 5px target is unusable with a finger and awkward with a mouse
      // Everything inside this inner group is drawn at a fixed size and then
      // scaled as one, so the pin, its halo and the label keep their exact
      // relationship to each other at every zoom level. Scaling them
      // separately let the label drift away from its own pin.
      var inner = el("g", { class: "dm-scale" }, g);
      el("circle", { class: "dm-hit", r: 18 }, inner);
      el("circle", { class: "dm-pulse", r: 10 }, inner);
      el("circle", { class: "dm-pin", r: 5 }, inner);
      el("text", { class: "dm-label", y: -13, "text-anchor": "middle" }, inner).textContent = s.name;
      g.__inner = inner;
      function open(e) { e.stopPropagation(); self.focusSite(i); }
      g.addEventListener("click", open);
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); }
      });
      return g;
    });

    // --- chrome: controls, popup, hint ------------------------------
    this.buildControls();

    this.popup = document.createElement("div");
    this.popup.className = "dm-popup";
    this.popup.setAttribute("role", "dialog");
    this.popup.setAttribute("aria-live", "polite");
    this.frame.appendChild(this.popup);

    this.hint = document.createElement("div");
    this.hint.className = "dm-hint";
    this.frame.appendChild(this.hint);

    svg.addEventListener("click", function () { self.closePopup(); });
    window.addEventListener("resize", function () {
      self.home = self.fit(vb[0], vb[1], vb[2], vb[3]);
    });

    // open on the district, so the first thing you see is the fieldwork area
    this.setView(this.focusBbox ? this.boxFor(this.focusBbox, 0.18) : this.home, false);
    this.setActiveChip("district");
  };

  // A quarter-degree graticule. It only appears once you are zoomed past
  // the whole state, where the district fill would otherwise be a blank
  // field of colour with a pin floating in it and nothing to read position
  // against. These are real parallels and meridians, not decoration.
  DeepMap.prototype.buildGrid = function () {
    var p = this.proj, step = 0.25;
    var latTop = p.lat1, latBot = p.lat1 - (this.data.height - p.pad * 2) / p.scale;
    var lonLeft = p.lon0, lonRight = p.lon0 + (this.data.width - p.pad * 2) / (p.kx * p.scale);
    var lat = Math.ceil(latBot / step) * step;
    for (; lat <= latTop; lat += step) {
      var a = this.project(lat, lonLeft), b2 = this.project(lat, lonRight);
      el("line", { x1: a.x.toFixed(1), y1: a.y.toFixed(1), x2: b2.x.toFixed(1), y2: b2.y.toFixed(1) }, this.gGrid);
    }
    var lon = Math.ceil(lonLeft / step) * step;
    for (; lon <= lonRight; lon += step) {
      var c = this.project(latTop, lon), d = this.project(latBot, lon);
      el("line", { x1: c.x.toFixed(1), y1: c.y.toFixed(1), x2: d.x.toFixed(1), y2: d.y.toFixed(1) }, this.gGrid);
    }
  };

  // Distance per user unit is constant: the projection fixes it, so the bar
  // only has to pick a round number of kilometres that lands at a sensible
  // width on screen.
  DeepMap.prototype.drawScaleBar = function (k) {
    if (!this.scaleBar) {
      this.scaleBar = document.createElement("div");
      this.scaleBar.className = "dm-scalebar";
      this.scaleBar.innerHTML = '<span class="dm-scalebar-rule"></span><span class="dm-scalebar-text"></span>';
      this.frame.appendChild(this.scaleBar);
    }
    var kmPerUnit = 111.32 / this.proj.scale;
    var kmPerPx = kmPerUnit * k;
    var choices = [1, 2, 5, 10, 25, 50, 100, 200, 500];
    var pick = choices[choices.length - 1], px = 0;
    for (var i = 0; i < choices.length; i++) {
      var w = choices[i] / kmPerPx;
      if (w >= 70 && w <= 190) { pick = choices[i]; px = w; break; }
      if (w > 190) { pick = choices[i]; px = w; break; }
      pick = choices[i]; px = w;
    }
    this.scaleBar.querySelector(".dm-scalebar-rule").style.width = Math.round(px) + "px";
    this.scaleBar.querySelector(".dm-scalebar-text").textContent = pick + " km";
  };

  DeepMap.prototype.buildControls = function () {
    var self = this;
    var bar = document.createElement("div");
    bar.className = "dm-controls";
    this.chips = {};

    function chip(key, label, handler) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "dm-chip";
      b.textContent = label;
      b.addEventListener("click", function (e) { e.stopPropagation(); handler(); });
      bar.appendChild(b);
      self.chips[key] = b;
      return b;
    }

    chip("state", "West Bengal", function () {
      self.closePopup();
      self.setView(self.home, true);
      self.setActiveChip("state");
    });
    if (this.focusBbox) {
      chip("district", "Paschim Medinipur", function () {
        self.closePopup();
        self.setView(self.boxFor(self.focusBbox, 0.18), true);
        self.setActiveChip("district");
      });
    }
    this.sites.forEach(function (s, i) {
      chip("site" + i, s.short || s.name, function () { self.focusSite(i); });
    });

    this.host.insertBefore(bar, this.frame);
  };

  DeepMap.prototype.setActiveChip = function (key) {
    for (var k in this.chips) if (this.chips.hasOwnProperty(k)) {
      this.chips[k].classList.toggle("active", k === key);
    }
  };

  DeepMap.prototype.focusSite = function (i) {
    var s = this.sites[i];
    if (!s) return;
    var pt = this.project(s.lat, s.lon);
    var span = s.span || 0.30; // degrees across — keep context in frame
    var half = span * this.proj.kx * this.proj.scale / 2;
    this.setView(this.fit(pt.x - half, pt.y - half, half * 2, half * 2), true);
    this.setActiveChip("site" + i);
    this.openPopup(i);
    this.markerEls.forEach(function (m, j) { m.classList.toggle("active", i === j); });
  };

  DeepMap.prototype.openPopup = function (i) {
    var s = this.sites[i];
    this.activeSite = i;
    var parts = (s.participants || []).map(function (p) {
      return '<li><b>' + p.name + '</b><span>' + p.role + '</span></li>';
    }).join("");
    this.popup.innerHTML =
      '<button type="button" class="dm-popup-close" aria-label="Close">&times;</button>' +
      '<p class="dm-popup-kicker">' + (s.kicker || "Fieldwork location") + '</p>' +
      '<h4>' + s.name + '</h4>' +
      (s.where ? '<p class="dm-popup-where">' + s.where + '</p>' : "") +
      '<p class="dm-popup-coords">' + this.formatCoord(s.lat, "NS") + " · " +
      this.formatCoord(s.lon, "EW") + (s.pin ? ' · PIN ' + s.pin : "") + '</p>' +
      (parts ? '<ul class="dm-popup-people">' + parts + "</ul>" : "") +
      (s.note ? '<p class="dm-popup-note">' + s.note + "</p>" : "");
    var self = this;
    this.popup.querySelector(".dm-popup-close").addEventListener("click", function (e) {
      e.stopPropagation(); self.closePopup();
    });
    this.popup.classList.add("open");
  };

  DeepMap.prototype.closePopup = function () {
    this.popup.classList.remove("open");
    this.activeSite = -1;
    this.markerEls.forEach(function (m) { m.classList.remove("active"); });
  };

  DeepMap.prototype.formatCoord = function (v, axis) {
    var hemi = v >= 0 ? axis[0] : axis[1];
    v = Math.abs(v);
    var d = Math.floor(v), m = Math.floor((v - d) * 60), s = Math.round((((v - d) * 60) - m) * 60);
    if (s === 60) { s = 0; m += 1; }
    return d + "° " + m + "′ " + s + "″ " + hemi;
  };

  DeepMap.prototype.showHint = function (name) {
    this.hint.textContent = name;
    this.hint.classList.add("in");
  };
  DeepMap.prototype.hideHint = function () { this.hint.classList.remove("in"); };

  DeepMap.prototype.setView = function (box, animate) {
    var self = this;
    if (this.anim) { cancelAnimationFrame(this.anim); this.anim = null; }
    var apply = function (b) {
      self.svg.setAttribute("viewBox", b.map(function (v) { return v.toFixed(1); }).join(" "));
      // One SVG user unit per on-screen pixel, whatever the zoom. Scaling
      // against the home viewBox instead made the pins a fixed 2px, because
      // this state is tall and narrow and its fitted box is very wide.
      var k = b[2] / Math.max(1, self.frame.clientWidth);
      // Zoomed out to the whole state the three Ghatal-area pins sit almost
      // on top of each other, so their labels collide into noise. Drop the
      // labels at that range and let the pins speak for themselves.
      var showLabels = k < 1.0;
      self.markerEls.forEach(function (m) {
        if (m.__inner) m.__inner.setAttribute("transform", "scale(" + k.toFixed(4) + ")");
        m.classList.toggle("dm-nolabel", !showLabels);
      });
      self.gGrid.setAttribute("stroke-width", (k * 0.8).toFixed(3));
      self.gGrid.classList.toggle("in", k < 1.0);
      self.drawScaleBar(k);
    };
    if (!animate || reducedMotion() || !this.current) {
      this.current = box.slice();
      apply(box);
      return;
    }
    var from = this.current.slice(), to = box.slice(), t0 = performance.now(), dur = 900;
    (function step(now) {
      var t = Math.min(1, (now - t0) / dur), e = easeInOutCubic(t);
      var b = from.map(function (v, i) { return v + (to[i] - v) * e; });
      apply(b);
      self.current = b;
      if (t < 1) self.anim = requestAnimationFrame(step);
      else { self.current = to; self.anim = null; }
    })(t0);
  };

  // ---------------------------------------------------------------
  function init() {
    var hosts = document.querySelectorAll("[data-deepmap]");
    if (!hosts.length) return;
    var src = hosts[0].getAttribute("data-deepmap");
    fetch(src)
      .then(function (r) {
        if (!r.ok) throw new Error("map data " + r.status);
        return r.json();
      })
      .then(function (data) {
        hosts.forEach(function (h) {
          try { new DeepMap(h, data); }
          catch (err) { fail(h, err); }
        });
      })
      .catch(function (err) { hosts.forEach(function (h) { fail(h, err); }); });
  }

  function fail(host, err) {
    host.innerHTML = '<p class="small-note">The map could not load here (' +
      (err && err.message ? err.message : "unknown error") +
      '). The locations are listed in the text below, with full coordinates.</p>';
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
