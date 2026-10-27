/* =====================================================================
   From Oral Tradition to Digital Archive — shared behaviour
   No build step, no framework, no external JS dependency except the
   optional Google Translate embed script (loaded lazily, same-origin
   safe) — kept in line with the Endings Project "no fragile stack"
   principle already used across this project.
   ===================================================================== */
(function(){
  "use strict";
  document.documentElement.classList.add("js-ready");

  /* ---------------- theme (dark / light) ---------------- */
  var THEME_KEY = "pma-theme";
  function applyTheme(t){
    document.documentElement.setAttribute("data-theme", t);
    try{ localStorage.setItem(THEME_KEY, t); }catch(e){}
    var btn = document.getElementById("theme-toggle");
    if(btn) btn.setAttribute("aria-pressed", t === "dark");
  }
  function initTheme(){
    var saved = null;
    try{ saved = localStorage.getItem(THEME_KEY); }catch(e){}
    var prefers = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(saved || prefers);
  }
  function toggleTheme(){
    var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(cur);
  }

  /* ---------------- font-size scaling ---------------- */
  var FS_KEY = "pma-fontscale";
  var FS_STEPS = [0.9, 1, 1.1, 1.22, 1.35];
  function applyFs(idx){
    document.documentElement.style.setProperty("--fs", FS_STEPS[idx]);
    try{ localStorage.setItem(FS_KEY, idx); }catch(e){}
  }
  function initFs(){
    var idx = 1;
    try{ var s = localStorage.getItem(FS_KEY); if(s !== null) idx = parseInt(s,10); }catch(e){}
    if(isNaN(idx) || idx < 0 || idx >= FS_STEPS.length) idx = 1;
    applyFs(idx);
    return idx;
  }
  function initFsControls(){
    var idx = initFs();
    function readout(){
      var el = document.getElementById("fs-readout");
      if(el) el.textContent = Math.round(FS_STEPS[idx] * 100) + "%";
    }
    function step(delta){
      idx = Math.max(0, Math.min(FS_STEPS.length - 1, idx + delta));
      applyFs(idx); readout();
    }
    // The nav keeps A-/A+ on wide screens; the drawer carries its own pair
    // so the controls survive on a phone, where the top bar has no room.
    ["fs-minus", "fs-minus-2"].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.addEventListener("click", function(){ step(-1); });
    });
    ["fs-plus", "fs-plus-2"].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.addEventListener("click", function(){ step(1); });
    });
    readout();
  }

  /* ---------------- mobile nav ---------------- */
  function initMobileNav(){
    var burger = document.getElementById("nav-burger");
    var links = document.getElementById("nav-links");
    if(!burger || !links) return;
    burger.addEventListener("click", function(){
      links.classList.toggle("open");
      burger.setAttribute("aria-expanded", links.classList.contains("open"));
    });
    links.querySelectorAll("a").forEach(function(a){
      a.addEventListener("click", function(){ links.classList.remove("open"); });
    });
  }

  /* ---------------- reveal on scroll ---------------- */
  function initReveal(){
    var items = document.querySelectorAll(".reveal");
    if(!items.length) return;
    // GSAP + ScrollTrigger drive a smoother, staggered reveal when available;
    // IntersectionObserver is the safety net if the CDN script didn't load.
    if(window.gsap && window.ScrollTrigger){
      gsap.registerPlugin(ScrollTrigger);
      // group items by their nearest section/grid so siblings stagger together
      var groups = {};
      items.forEach(function(el, i){
        var host = el.closest("section, .wrap") || document.body;
        if(!host.__revealId) host.__revealId = "rg" + (i);
        (groups[host.__revealId] = groups[host.__revealId] || []).push(el);
      });
      Object.keys(groups).forEach(function(k){
        var els = groups[k];
        ScrollTrigger.batch(els, {
          start: "top 88%",
          once: true,
          onEnter: function(batch){
            batch.forEach(function(el){ el.classList.add("in"); });
          }
        });
      });
      return;
    }
    if(!("IntersectionObserver" in window)){
      items.forEach(function(el){ el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, {threshold:.12});
    items.forEach(function(el){ io.observe(el); });
  }

  /* ---------------- 3D tilt parallax (mouse-driven, cheap "3D" depth cue) ---------------- */
  function initTilt(){
    var els = document.querySelectorAll(".tilt-3d");
    if(!els.length) return;
    var isTouch = window.matchMedia && window.matchMedia("(hover: none)").matches;
    if(isTouch) return;
    document.addEventListener("mousemove", function(e){
      var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      var dx = (e.clientX - cx) / cx, dy = (e.clientY - cy) / cy;
      els.forEach(function(el){
        var depth = parseFloat(el.getAttribute("data-depth")) || 10;
        var rx = (-dy * depth).toFixed(2), ry = (dx * depth).toFixed(2);
        el.style.transform = "rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
      });
    }, {passive:true});
  }

  /* ---------------- welcome gate (curiosity checkbox) ---------------- */
  function initGate(){
    var overlay = document.getElementById("gate-overlay");
    if(!overlay) return;
    var SEEN_KEY = "pma-gate-seen";
    var seen = false;
    try{ seen = sessionStorage.getItem(SEEN_KEY) === "1"; }catch(e){}
    if(seen){ overlay.classList.add("hide"); overlay.style.display="none"; return; }

    var checkbox = document.getElementById("gate-checkbox");
    var enterBtn = document.getElementById("gate-enter");
    var skipBtn = document.getElementById("gate-skip");
    if(checkbox && enterBtn){
      checkbox.addEventListener("change", function(){
        enterBtn.classList.toggle("ready", checkbox.checked);
      });
    }
    function dismiss(){
      overlay.classList.add("hide");
      try{ sessionStorage.setItem(SEEN_KEY, "1"); }catch(e){}
      setTimeout(function(){ overlay.style.display="none"; }, 650);
    }
    if(enterBtn) enterBtn.addEventListener("click", function(){ if(checkbox && !checkbox.checked) return; dismiss(); });
    if(skipBtn) skipBtn.addEventListener("click", dismiss);
    // auto-advance the 2-3s animated welcome moment, then reveal the question
    var intro = document.getElementById("gate-intro");
    var question = document.getElementById("gate-question");
    if(intro && question){
      setTimeout(function(){
        intro.style.display = "none";
        question.style.display = "block";
      }, 2400);
    }
  }

  /* ---------------- accessibility & reading options ----------------
     Four independent switches, each written onto <html> as a data-
     attribute that the stylesheet keys off, and each remembered in this
     browser only. "Reduce motion" starts switched on if the operating
     system already asks for it, so we honour that preference before the
     reader has to find this panel. */
  var A11Y = [
    { id: "opt-contrast",  attr: "data-contrast",  on: "high",     key: "pma-contrast"  },
    { id: "opt-motion",    attr: "data-motion",    on: "reduced",  key: "pma-motion"    },
    { id: "opt-font",      attr: "data-font",      on: "readable", key: "pma-font"      },
    { id: "opt-underline", attr: "data-underline", on: "on",       key: "pma-underline" }
  ];
  var ATKINSON = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap";
  function loadReadableFont(){
    if(document.getElementById("atkinson-font")) return;
    var l = document.createElement("link");
    l.id = "atkinson-font"; l.rel = "stylesheet"; l.href = ATKINSON;
    document.head.appendChild(l);
  }
  function applyOption(opt, on){
    if(on){
      document.documentElement.setAttribute(opt.attr, opt.on);
      if(opt.id === "opt-font") loadReadableFont();
    } else {
      document.documentElement.removeAttribute(opt.attr);
    }
    try{ localStorage.setItem(opt.key, on ? "1" : "0"); }catch(e){}
  }
  function initA11yOptions(){
    var systemReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    A11Y.forEach(function(opt){
      var saved = null;
      try{ saved = localStorage.getItem(opt.key); }catch(e){}
      var on = saved === null
        ? (opt.id === "opt-motion" ? !!systemReduced : false)
        : saved === "1";
      applyOption(opt, on);
      var box = document.getElementById(opt.id);
      if(box){
        box.checked = on;
        box.addEventListener("change", function(){ applyOption(opt, box.checked); });
      }
    });
  }
  function initA11yDrawer(){
    var drawer = document.getElementById("a11y-drawer");
    var scrim = document.getElementById("a11y-scrim");
    var openBtn = document.getElementById("a11y-toggle");
    var closeBtn = document.getElementById("a11y-close");
    var footerBtn = document.getElementById("footer-a11y-open");
    if(!drawer || !openBtn) return;
    var lastFocus = null;
    function open(){
      lastFocus = document.activeElement;
      scrim.hidden = false;
      requestAnimationFrame(function(){ drawer.classList.add("open"); });
      openBtn.setAttribute("aria-expanded", "true");
      initTranslate();
      var first = drawer.querySelector("input, button");
      if(first) first.focus();
    }
    function close(){
      drawer.classList.remove("open");
      openBtn.setAttribute("aria-expanded", "false");
      scrim.hidden = true;
      if(lastFocus && lastFocus.focus) lastFocus.focus();
    }
    openBtn.addEventListener("click", function(){
      drawer.classList.contains("open") ? close() : open();
    });
    if(footerBtn) footerBtn.addEventListener("click", open);
    if(closeBtn) closeBtn.addEventListener("click", close);
    if(scrim) scrim.addEventListener("click", close);
    document.addEventListener("keydown", function(e){
      if(e.key === "Escape" && drawer.classList.contains("open")) close();
    });
  }

  /* ---------------- text-to-speech narrator ---------------- */
  var synth = window.speechSynthesis;
  var currentUtterance = null;
  function stopNarration(){
    if(synth){ synth.cancel(); }
    document.querySelectorAll(".narrate-btn.speaking").forEach(function(b){
      b.classList.remove("speaking");
      b.textContent = b.getAttribute("data-label") || "▶ Narrate this section";
    });
  }
  /* Narration language. "auto" is the honest default: the narrator reads
     whatever is actually on screen, so once a reader has switched the page
     to Bengali through the translate control, the Bengali voice is picked
     up automatically. Forcing a language is still offered, with a plain
     note when the chosen voice and the on-screen script disagree or when
     no Bengali voice is installed on the device. */
  var NLANG_KEY = "pma-narrate-lang";
  var narrateLang = "auto";
  var BENGALI_RE = /[ঀ-৿]/;
  function voiceFor(langPrefix){
    if(!synth) return null;
    var voices = synth.getVoices() || [];
    return voices.filter(function(v){
      return v.lang && v.lang.toLowerCase().indexOf(langPrefix) === 0;
    })[0] || null;
  }
  function updateVoiceNote(){
    var note = document.getElementById("narrate-voice-note");
    if(!note) return;
    if(!synth){ note.textContent = "This browser has no speech synthesis, so the Narrate buttons are hidden."; return; }
    var bn = voiceFor("bn");
    if(narrateLang === "bn" && !bn){
      note.textContent = "No Bengali voice is installed in this browser, so Bengali narration can't be spoken here. Bengali captions and the translated page still work.";
    } else if(narrateLang === "bn"){
      note.textContent = "Using " + bn.name + ". Translate the page to বাংলা above so the words match the voice.";
    } else if(narrateLang === "en"){
      note.textContent = "Narration will always use an English voice, whichever language the page is showing.";
    } else {
      note.textContent = bn
        ? "The narrator follows the page: English text is read in English, Bengali text in " + bn.name + "."
        : "The narrator follows the page. No Bengali voice is installed in this browser, so Bengali text would be read by the default voice.";
    }
  }
  function initNarrateLangSwitch(){
    try{ narrateLang = localStorage.getItem(NLANG_KEY) || "auto"; }catch(e){}
    var btns = Array.prototype.slice.call(document.querySelectorAll(".nlang-btn"));
    btns.forEach(function(b){
      b.classList.toggle("active", b.getAttribute("data-nlang") === narrateLang);
      b.addEventListener("click", function(){
        narrateLang = b.getAttribute("data-nlang");
        try{ localStorage.setItem(NLANG_KEY, narrateLang); }catch(e){}
        btns.forEach(function(x){ x.classList.toggle("active", x === b); });
        stopNarration();
        updateVoiceNote();
      });
    });
    updateVoiceNote();
    if(synth) synth.addEventListener && synth.addEventListener("voiceschanged", updateVoiceNote);
    if(synth && !synth.addEventListener) synth.onvoiceschanged = updateVoiceNote;
  }
  function initNarration(){
    if(!synth){ document.querySelectorAll(".narrate-btn").forEach(function(b){ b.style.display="none"; }); return; }
    document.querySelectorAll(".narrate-btn").forEach(function(btn){
      btn.setAttribute("data-label", btn.textContent);
      if(!btn.parentNode.classList.contains("narrate-row")){
        var row = document.createElement("div");
        row.className = "narrate-row";
        btn.parentNode.insertBefore(row, btn);
        row.appendChild(btn);
      }
      btn.addEventListener("click", function(){
        if(btn.classList.contains("speaking")){ stopNarration(); return; }
        stopNarration();
        var targetSel = btn.getAttribute("data-target");
        var el = targetSel ? document.querySelector(targetSel) : null;
        var text = el ? el.innerText : "";
        if(!text) return;

        var textIsBengali = BENGALI_RE.test(text);
        var wanted = narrateLang === "auto" ? (textIsBengali ? "bn" : "en") : narrateLang;
        var voice = voiceFor(wanted);
        if(wanted === "bn" && !voice){
          setNarrateHint(btn, "No Bengali voice installed in this browser.");
          return;
        }
        if(wanted === "bn" && !textIsBengali){
          setNarrateHint(btn, "This section is still in English — switch the page to বাংলা first.");
          return;
        }
        var utt = new SpeechSynthesisUtterance(text);
        utt.rate = 0.98; utt.pitch = 1;
        if(voice){ utt.voice = voice; utt.lang = voice.lang; }
        utt.onend = function(){ btn.classList.remove("speaking"); btn.textContent = btn.getAttribute("data-label"); };
        currentUtterance = utt;
        btn.classList.add("speaking");
        btn.textContent = "■ Stop narration";
        synth.speak(utt);
      });
    });
  }
  function setNarrateHint(btn, msg){
    var row = btn.parentNode;
    var hint = row.querySelector(".narrate-note");
    if(!hint){
      hint = document.createElement("span");
      hint.className = "narrate-note";
      row.appendChild(hint);
    }
    hint.textContent = msg;
    clearTimeout(hint.__t);
    hint.__t = setTimeout(function(){ hint.textContent = ""; }, 6000);
  }

  /* ---------------- generative music engine (Web Audio, 100% synthesized — no sample files, no copyrighted audio) ----------------
     A small original composition system, not just a drone: a raga-flavoured
     scale (Bhairavi-leaning), a lookahead step sequencer for the melody, a
     two-note tanpura-style drone, and synthesized percussion. Three
     variants share this engine — "common" (home + general pages), "gajan"
     (more percussive, dhak-like pulse), and "patachitra" (gentler, solo
     plucked melody, no percussion) — selected from <body data-sound-scene>. */
  var audioCtx = null, ambientNodes = [], ambientOn = false, ambientTimer = null;
  var masterGain = null, ambientVolume = 0.75;
  var SOUND_KEY = "pma-sound";
  var SOUND_VOL_KEY = "pma-sound-volume";
  var ROOT = 146.83; // D3 — tanpura-style root
  function noteFreq(semitones){ return ROOT * Math.pow(2, semitones/12); }
  var BHAIRAVI = [0,1,3,5,7,8,10,12]; // S r g M P d n S'

  function pluck(ctx, dest, freq, t, dur, gainPeak, wave){
    var osc = ctx.createOscillator();
    osc.type = wave || "triangle";
    osc.frequency.setValueAtTime(freq, t);
    var filt = ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.setValueAtTime(freq*6, t); filt.frequency.exponentialRampToValueAtTime(freq*1.5, t+dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gainPeak, t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    osc.connect(filt).connect(g).connect(dest);
    osc.start(t); osc.stop(t+dur+0.05);
  }
  function dhakHit(ctx, dest, t, soft){
    var bufferSize = ctx.sampleRate * 0.25;
    var buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for(var i=0;i<bufferSize;i++){ d[i] = (Math.random()*2-1) * Math.pow(1 - i/bufferSize, 2); }
    var noise = ctx.createBufferSource(); noise.buffer = buf;
    var filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = soft ? 900 : 1800;
    var ng = ctx.createGain(); ng.gain.setValueAtTime(soft ? 0.05 : 0.11, t); ng.gain.exponentialRampToValueAtTime(0.0001, t+0.22);
    noise.connect(filt).connect(ng).connect(dest);
    noise.start(t);
    var osc = ctx.createOscillator(); osc.type = "sine";
    osc.frequency.setValueAtTime(soft ? 90 : 70, t); osc.frequency.exponentialRampToValueAtTime(40, t+0.18);
    var og = ctx.createGain(); og.gain.setValueAtTime(soft ? 0.06 : 0.14, t); og.gain.exponentialRampToValueAtTime(0.0001, t+0.3);
    osc.connect(og).connect(dest);
    osc.start(t); osc.stop(t+0.32);
  }

  function buildAmbient(ctx, scene){
    scene = scene || "common";
    var nodes = [];
    // Output chain: everything lands on a master gain, then a compressor
    // that catches the dhak peaks so raising the level doesn't clip.
    var master = ctx.createGain();
    master.gain.value = ambientVolume * 3.0;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 24; comp.ratio.value = 6;
    comp.attack.value = 0.004; comp.release.value = 0.22;
    master.connect(comp); comp.connect(ctx.destination);
    masterGain = master;
    nodes.push(master, comp);

    // Drone — root + fifth, detuned pair per note for a tanpura shimmer
    var droneFreqs = scene === "gajan" ? [ROOT, ROOT*1.5, ROOT*2] : [ROOT, ROOT*1.5];
    droneFreqs.forEach(function(freq){
      [0, 0.6].forEach(function(detune){
        var osc = ctx.createOscillator();
        osc.type = "sine"; osc.frequency.value = freq + detune;
        var g = ctx.createGain(); g.gain.value = 0.028;
        osc.connect(g).connect(master);
        osc.start();
        nodes.push(osc, g);
      });
    });

    // Soft air/noise bed, very low — a field-recording texture, fully synthesized
    var bufferSize = 2 * ctx.sampleRate;
    var noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for(var i=0;i<bufferSize;i++){ data[i] = (Math.random()*2-1) * 0.4; }
    var noise = ctx.createBufferSource(); noise.buffer = noiseBuffer; noise.loop = true;
    var filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 420; filter.Q.value = 0.6;
    var noiseGain = ctx.createGain(); noiseGain.gain.value = 0.012;
    noise.connect(filter).connect(noiseGain).connect(master);
    noise.start();
    nodes.push(noise, filter, noiseGain);

    // Lookahead step sequencer. The Gajan setting is the one you hear on
    // most of the site: an eight-beat cycle with a weighted dhak pattern,
    // a kanshi (small bell) marking the first beat of every cycle, and a
    // melody built from short phrases that rest between them rather than
    // wandering note by note — closer to how the line actually breathes
    // than an unbroken random walk. Still entirely synthesized: no sample,
    // no recording, nothing copyrighted.
    var gajan = scene === "gajan";
    var stepDur = gajan ? 0.30 : 0.62;
    var nextStepTime = ctx.currentTime + 0.1;
    var degree = 3, beat = 0;
    var percussionOn = scene !== "patachitra";
    var melodyGainPeak = scene === "patachitra" ? 0.07 : 0.05;
    // dhak cycle of 8: 2 = firm stroke, 1 = soft stroke, 0 = rest
    var DHAK = [2, 0, 1, 0, 2, 1, 1, 0];
    // phrase shapes as scale-degree offsets, picked one at a time
    var PHRASES = [[0,1,2,1], [0,2,3,2], [4,3,2,0], [2,3,4,5], [5,4,2,1], [0,-1,0,2]];
    var phrase = null, phrasePos = 0, restBeats = 0, phraseRoot = 3;
    var schedulerId = setInterval(function(){
      while(nextStepTime < ctx.currentTime + 0.3){
        var t = nextStepTime, cyclePos = beat % 8;

        if(gajan){
          // melody in phrases, with a breath between them
          if(restBeats > 0){
            restBeats--;
          } else if(!phrase){
            phrase = PHRASES[Math.floor(Math.random()*PHRASES.length)];
            phrasePos = 0;
            phraseRoot = Math.max(0, Math.min(4, phraseRoot + (Math.floor(Math.random()*3) - 1)));
          } else {
            var deg = Math.max(0, Math.min(BHAIRAVI.length-1, phraseRoot + phrase[phrasePos]));
            pluck(ctx, master, noteFreq(BHAIRAVI[deg] + 24), t, stepDur*2.6, melodyGainPeak, "sine");
            // an occasional grace note just before the beat
            if(Math.random() > 0.78 && deg > 0){
              pluck(ctx, master, noteFreq(BHAIRAVI[deg-1] + 24), t - 0.06, 0.12, melodyGainPeak*0.5, "sine");
            }
            phrasePos++;
            if(phrasePos >= phrase.length){ phrase = null; restBeats = 2 + Math.floor(Math.random()*4); }
          }
          var hit = DHAK[cyclePos];
          if(hit === 2) dhakHit(ctx, master, t, false);
          else if(hit === 1) dhakHit(ctx, master, t, true);
          // kanshi: a bright bell on the first beat of the cycle
          if(cyclePos === 0 && beat % 16 === 0){
            pluck(ctx, master, noteFreq(31), t, 2.2, 0.05, "triangle");
            pluck(ctx, master, noteFreq(36), t, 1.8, 0.03, "triangle");
          }
        } else {
          if(Math.random() > 0.3){
            var step = Math.floor(Math.random()*3) - 1;
            degree = Math.max(0, Math.min(BHAIRAVI.length-1, degree + step));
            var oct = scene === "patachitra" ? 12 : 24;
            pluck(ctx, master, noteFreq(BHAIRAVI[degree] + oct), t, stepDur*1.8, melodyGainPeak, scene==="patachitra" ? "triangle" : "sine");
          }
          if(percussionOn && beat % 11 === 0) pluck(ctx, master, noteFreq(12), t, 1.6, 0.05, "triangle");
        }
        beat = (beat + 1) % 48;
        nextStepTime += stepDur;
      }
    }, 120);
    nodes.push({stop:function(){ clearInterval(schedulerId); }});
    return nodes;
  }
  function stopAmbient(){
    ambientNodes.forEach(function(n){
      try{ if(n.stop) n.stop(); }catch(e){}
      try{ if(n.disconnect) n.disconnect(); }catch(e){}
    });
    ambientNodes = [];
  }
  function setAmbient(on){
    ambientOn = on;
    try{ localStorage.setItem(SOUND_KEY, on ? "1":"0"); }catch(e){}
    var fab = document.getElementById("sound-fab");
    if(fab) fab.setAttribute("aria-pressed", on);
    var fabOn = document.getElementById("sound-icon-on");
    var fabOff = document.getElementById("sound-icon-off");
    if(fabOn && fabOff){ fabOn.style.display = on ? "block":"none"; fabOff.style.display = on ? "none":"block"; }
    if(on){
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if(audioCtx.state === "suspended") audioCtx.resume();
      stopAmbient();
      var scene = document.body.getAttribute("data-sound-scene") || "common";
      ambientNodes = buildAmbient(audioCtx, scene);
    } else {
      stopAmbient();
    }
  }
  function setAmbientVolume(v){
    ambientVolume = Math.max(0, Math.min(1, v));
    try{ localStorage.setItem(SOUND_VOL_KEY, String(ambientVolume)); }catch(e){}
    if(masterGain && audioCtx){
      masterGain.gain.setTargetAtTime(ambientVolume * 3.0, audioCtx.currentTime, 0.05);
    }
  }
  /* A browser will not let a page make noise until the visitor has
     interacted with it. The old behaviour was to give up at that point and
     wait for another deliberate press of the speaker — which meant the
     soundscape died on every single page navigation and had to be switched
     on again by hand. Instead: remember the choice, and the moment the
     visitor does anything at all on the new page, pick the music back up
     where it left off. Still never plays for someone who hasn't asked. */
  function armAmbientResume(){
    var events = ["pointerdown", "keydown", "wheel", "touchstart"];
    function go(){
      events.forEach(function(ev){ window.removeEventListener(ev, go, true); });
      if(!ambientOn) setAmbient(true);
    }
    events.forEach(function(ev){ window.addEventListener(ev, go, true); });
  }
  function initAmbient(){
    var fab = document.getElementById("sound-fab");
    if(!fab) return;
    try{
      var v = parseFloat(localStorage.getItem(SOUND_VOL_KEY));
      if(!isNaN(v)) ambientVolume = Math.max(0, Math.min(1, v));
    }catch(e){}
    var slider = document.getElementById("opt-volume");
    if(slider){
      slider.value = String(Math.round(ambientVolume * 100));
      slider.addEventListener("input", function(){
        setAmbientVolume(parseInt(slider.value, 10) / 100);
        if(!ambientOn && parseInt(slider.value, 10) > 0) setAmbient(true);
      });
    }
    var saved = "0";
    try{ saved = localStorage.getItem(SOUND_KEY) || "0"; }catch(e){}
    if(saved === "1"){
      // keep the icon showing "on" so the page matches the remembered choice
      ambientOn = false;
      var fabOn = document.getElementById("sound-icon-on");
      var fabOff = document.getElementById("sound-icon-off");
      if(fabOn && fabOff){ fabOn.style.display = "block"; fabOff.style.display = "none"; }
      fab.setAttribute("aria-pressed", "true");
      armAmbientResume();
    } else {
      hintSoundOnce(fab);
    }
    fab.addEventListener("click", function(){ setAmbient(!ambientOn); dismissSoundHint(); });
  }
  /* A one-off nudge, the first time someone visits, so the speaker button
     isn't a mystery icon in the corner. Shown once per browser. */
  function hintSoundOnce(fab){
    var HINT_KEY = "pma-sound-hinted";
    var seen = false;
    try{ seen = localStorage.getItem(HINT_KEY) === "1"; }catch(e){}
    if(seen) return;
    var hint = document.createElement("div");
    hint.className = "sound-hint";
    hint.innerHTML = "<b>Turn on the soundscape</b><span>A Gajan dhak piece, generated live in your browser.</span>";
    document.body.appendChild(hint);
    setTimeout(function(){ hint.classList.add("in"); }, 1200);
    setTimeout(dismissSoundHint, 14000);
    try{ localStorage.setItem(HINT_KEY, "1"); }catch(e){}
  }
  function dismissSoundHint(){
    var h = document.querySelector(".sound-hint");
    if(h){ h.classList.remove("in"); setTimeout(function(){ if(h.parentNode) h.parentNode.removeChild(h); }, 400); }
  }

  /* ---------------- Google Translate (Bengali / English) ---------------- */
  window.googleTranslateElementInit = function(){
    new google.translate.TranslateElement({
      pageLanguage: "en",
      includedLanguages: "en,bn",
      layout: google.translate.TranslateElement.InlineLayout.SIMPLE
    }, "google_translate_element");
  };
  /* The embed can simply fail to arrive — a blocked network, an offline
     reader, a firewall, or a region where it isn't served. When that
     happens the Language section would otherwise sit there empty, with no
     way to tell whether it is loading or broken. So: say that it is
     loading, and if nothing renders, fall back to a plain link that opens
     this page through Google Translate without needing the script at all. */
  function translateFallback(mount){
    var url = encodeURIComponent(location.href);
    mount.innerHTML =
      '<p class="small-note" style="margin:0 0 .5rem;">The in-page translate widget could not load here — this link does the same job in a new tab.</p>' +
      '<a class="btn small outline" target="_blank" rel="noopener" href="https://translate.google.com/translate?sl=en&amp;tl=bn&amp;u=' + url + '">Open this page in বাংলা ↗</a>';
  }
  function initTranslate(){
    var mount = document.getElementById("google_translate_element");
    if(!mount) return;
    if(document.getElementById("google-translate-script")) return;
    mount.innerHTML = '<p class="small-note" style="margin:0;">Loading the translate control…</p>';
    var s = document.createElement("script");
    s.id = "google-translate-script";
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    s.onerror = function(){ translateFallback(mount); };
    document.body.appendChild(s);
    setTimeout(function(){
      // the widget replaces the mount's contents when it initialises
      if(!mount.querySelector("select, .goog-te-gadget, iframe")) translateFallback(mount);
    }, 3500);
  }

  /* ---------------- footprint filter (Explore / sources page) ---------------- */
  function initFootprintFilter(){
    var bar = document.getElementById("fp-filters");
    var grid = document.getElementById("fp-grid");
    var count = document.getElementById("fp-count");
    if(!bar || !grid) return;
    var items = grid.querySelectorAll(".fp-item");
    function apply(cat){
      var n = 0;
      items.forEach(function(it){
        var show = cat === "all" || it.getAttribute("data-cat") === cat;
        it.style.display = show ? "" : "none";
        if(show) n++;
      });
      if(count) count.textContent = n + " source" + (n===1?"":"s") + " shown";
    }
    bar.querySelectorAll(".filter-chip").forEach(function(chip){
      chip.addEventListener("click", function(){
        bar.querySelectorAll(".filter-chip").forEach(function(c){ c.classList.remove("active"); });
        chip.classList.add("active");
        apply(chip.getAttribute("data-cat"));
      });
    });
    apply("all");
  }

  /* ---------------- citation tabs ---------------- */
  function initCiteTabs(){
    var bar = document.querySelector(".cite-tab-bar");
    if(!bar) return;
    var tabs = bar.querySelectorAll(".cite-tab");
    var boxes = document.querySelectorAll(".cite-box[data-fmt]");
    tabs.forEach(function(tab){
      tab.addEventListener("click", function(){
        tabs.forEach(function(t){ t.classList.remove("active"); });
        tab.classList.add("active");
        var fmt = tab.getAttribute("data-fmt");
        boxes.forEach(function(b){ b.style.display = b.getAttribute("data-fmt") === fmt ? "block" : "none"; });
      });
    });
  }

  /* ---------------- copy to clipboard ---------------- */
  function initCopyButtons(){
    document.querySelectorAll(".copy-btn").forEach(function(btn){
      btn.addEventListener("click", function(){
        var targetSel = btn.getAttribute("data-copy-target");
        var el = targetSel ? document.querySelector(targetSel) : btn.closest(".cite-box");
        var text = el ? el.innerText.trim() : "";
        if(!text) return;
        navigator.clipboard && navigator.clipboard.writeText(text).then(function(){
          var orig = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(function(){ btn.textContent = orig; }, 1600);
        });
      });
    });
  }

  /* ---------------- scroll progress bar ---------------- */
  function initScrollProgress(){
    var bar = document.getElementById("scroll-progress");
    if(!bar) return;
    var ticking = false;
    function update(){
      var h = document.documentElement;
      var scrollTop = h.scrollTop || document.body.scrollTop;
      var height = (h.scrollHeight - h.clientHeight) || 1;
      var pct = Math.min(100, Math.max(0, (scrollTop / height) * 100));
      bar.style.width = pct + "%";
      ticking = false;
    }
    window.addEventListener("scroll", function(){
      if(!ticking){ requestAnimationFrame(update); ticking = true; }
    }, {passive:true});
    window.addEventListener("resize", update, {passive:true});
    update();
  }

  /* ---------------- cursor-glow on cards (single delegated listener, cheap) ---------------- */
  function initCardGlow(){
    var isTouch = window.matchMedia && window.matchMedia("(hover: none)").matches;
    if(isTouch) return;
    var selector = ".card,.hub-card,.av-card,.team-card,.participant-card";
    document.addEventListener("pointermove", function(e){
      var el = e.target.closest ? e.target.closest(selector) : null;
      if(!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left) + "px");
      el.style.setProperty("--my", (e.clientY - r.top) + "px");
    }, {passive:true});
  }

  /* ---------------- count-up stat numbers (plays once, when scrolled into view) ---------------- */
  function initCountUp(){
    var items = document.querySelectorAll(".count-up[data-count]");
    if(!items.length) return;
    function run(el){
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      var suffix = el.getAttribute("data-suffix") || "";
      var dur = 1100, start = null;
      function ease(x){ return 1 - Math.pow(1 - x, 3); }
      function step(ts){
        if(start === null) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var val = Math.round(target * ease(p));
        el.textContent = val + suffix;
        if(p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    if(!("IntersectionObserver" in window)){
      items.forEach(function(el){ el.textContent = el.getAttribute("data-count") + (el.getAttribute("data-suffix") || ""); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ run(e.target); io.unobserve(e.target); }
      });
    }, {threshold:.5});
    items.forEach(function(el){ io.observe(el); });
  }

  /* ---------------- reading-room tabs ---------------- */
  function initTabs(){
    document.querySelectorAll(".tab-btn").forEach(function(btn){
      btn.addEventListener("click", function(){
        var scope = btn.closest(".wrap") || document;
        var targetId = "tab-" + btn.getAttribute("data-tab");
        scope.querySelectorAll(".tab-btn").forEach(function(b){ b.classList.remove("active"); });
        scope.querySelectorAll(".tab-panel").forEach(function(p){ p.classList.remove("active"); });
        btn.classList.add("active");
        var panel = document.getElementById(targetId);
        if(panel) panel.classList.add("active");
      });
    });
  }

  /* ---------------- init ---------------- */
  document.addEventListener("DOMContentLoaded", function(){
    initTheme();
    initFsControls();
    initMobileNav();
    initA11yOptions();
    initA11yDrawer();
    initReveal();
    initTilt();
    initScrollProgress();
    initCardGlow();
    initCountUp();
    initGate();
    initNarration();
    initNarrateLangSwitch();
    initAmbient();
    // Google Translate is loaded lazily, only when a reader actually opens
    // the language panel — so nothing third-party is fetched otherwise.

    initFootprintFilter();
    initTabs();
    initCiteTabs();
    initCopyButtons();
    var themeBtn = document.getElementById("theme-toggle");
    if(themeBtn) themeBtn.addEventListener("click", toggleTheme);
  });
})();
