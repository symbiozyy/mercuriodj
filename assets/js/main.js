/* MERCÚRIO — interações */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem storage */ } },
  };
  let lang = store.get("mercurio-lang") === "en" ? "en" : "pt";
  const t = (pt, en) => (lang === "en" ? en : pt);

  /* ---------- Set do site (SoundCloud) ----------
     O deck carrega as faixas do perfil (PROFILE_URL), monta a lista "Todos os
     sets" e já abre no set em destaque: a faixa cujo título contém FEATURED.
     Para abrir em outro set, troque FEATURED (ex.: "New Set"). */
  const PROFILE_URL = "https://soundcloud.com/mercurio-dj";
  const FEATURED = "The Next Chapter";
  const MUSIC_VOLUME = 70; // 0–100
  const FADE_MS = 1400;
  const soundBtn = $("#soundBtn");
  const deck = $(".deck");
  const deckTitle = $("#deckTitle");
  const deckTime = $("#deckTime");
  const deckHint = $("#deckHint");
  const deckList = $("#deckList");

  const PLAYER_OPTS = { color: "#00f0ff", hide_related: true, show_comments: false, show_user: true, show_reposts: false, show_teaser: false, visual: false };
  const widgetSrc = (url) =>
    "https://w.soundcloud.com/player/?" + new URLSearchParams({ url, auto_play: "false", ...PLAYER_OPTS });
  const fmt = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600);
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0"), ss = String(s % 60).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };
  const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const music = (() => {
    const frame = $("#scPlayer");
    const SC = window.SC;
    let widget = null, ready = false, playing = false, wanted = false, ducked = false;
    let vol = 0, fadeTimer = 0, playCheck = 0, currentId = null;

    const setVol = (v) => { vol = v; widget?.setVolume(v); };
    const ramp = (to, done) => {
      clearInterval(fadeTimer);
      const from = vol, t0 = performance.now();
      fadeTimer = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / FADE_MS);
        setVol(from + (to - from) * k);
        if (k === 1) { clearInterval(fadeTimer); done?.(); }
      }, 50);
    };
    const paint = () => {
      soundBtn.setAttribute("aria-pressed", String(wanted && !ducked));
      deck.classList.toggle("is-live", playing);
      $$(".deck__item", deckList).forEach((b) => b.classList.toggle("is-current", b.dataset.id === String(currentId)));
    };
    const sync = () => {
      if (!ready) { paint(); return; }
      if (wanted && !ducked) {
        if (!playing) setVol(0);
        widget.play();
        ramp(MUSIC_VOLUME);
        // iOS às vezes bloqueia o play disparado de fora do player
        clearTimeout(playCheck);
        playCheck = setTimeout(() => {
          if (!playing && wanted && !ducked) deckHint.textContent = t("Toque no ▶ do player para liberar o áudio.", "Tap ▶ on the player to unlock audio.");
        }, 3500);
      } else if (playing) {
        ramp(0, () => widget.pause());
      }
      paint();
    };
    const readCurrent = () => widget.getCurrentSound((s) => {
      if (!s) return;
      currentId = s.id;
      deckTitle.textContent = s.title;
      paint();
    });

    if (!SC || !frame) {
      deckHint.textContent = t("Não foi possível carregar o SoundCloud.", "Could not load SoundCloud.");
      return { start() {}, toggle() {}, duck() {}, load() {} };
    }

    frame.src = widgetSrc(PROFILE_URL);
    widget = SC.Widget(frame);
    const markReady = () => { ready = true; deckHint.textContent = ""; readCurrent(); sync(); };
    // o widget do perfil entrega as faixas aos poucos: espera completar,
    // monta a lista e troca o player para o set em destaque
    const boot = () => {
      let tries = 0;
      const read = () => widget.getSounds((sounds) => {
        sounds = sounds || [];
        const list = sounds.filter((s) => s && s.title && s.permalink_url);
        if ((!list.length || list.length < sounds.length) && tries++ < 12) { setTimeout(read, 500); return; }
        render(list);
        const pick = list.find((s) => norm(s.title).includes(norm(FEATURED)));
        if (pick) widget.load(pick.permalink_url, { ...PLAYER_OPTS, auto_play: false, callback: markReady });
        else markReady();
      });
      read();
    };
    let booted = false;
    widget.bind(SC.Widget.Events.READY, () => { if (!booted) { booted = true; boot(); } });
    const slow = setTimeout(() => {
      if (!ready) deckHint.textContent = t("Carregando o set…", "Loading the set…");
    }, 4000);
    widget.bind(SC.Widget.Events.PLAY, () => {
      clearTimeout(slow);
      playing = true;
      deckHint.textContent = "";
      readCurrent();
      // play pelo próprio player do SoundCloud conta como "som ligado"
      if (!wanted) { wanted = true; setVol(MUSIC_VOLUME); }
      paint();
    });
    widget.bind(SC.Widget.Events.PAUSE, () => {
      playing = false;
      // pausa manual no player (sem fade nosso em andamento) desliga o som
      if (vol > 1 && !ducked) wanted = false;
      paint();
    });
    widget.bind(SC.Widget.Events.FINISH, () => { playing = false; paint(); });
    widget.bind(SC.Widget.Events.PLAY_PROGRESS, (e) => { deckTime.textContent = fmt(e.currentPosition); });

    return {
      // chamados a partir de um clique, então o navegador libera o áudio
      start() { wanted = true; sync(); },
      toggle() { wanted = !(wanted && (playing || !ready)); sync(); },
      duck(on) { if (ducked !== on) { ducked = on; sync(); } },
      load(url) {
        wanted = true; ducked = false;
        deckHint.textContent = "";
        widget.load(url, { ...PLAYER_OPTS, auto_play: true,
          callback: () => { ready = true; setVol(MUSIC_VOLUME); readCurrent(); } });
      },
      get currentId() { return currentId; },
    };
  })();
  soundBtn.addEventListener("click", () => music.toggle());

  /* ---------- Lista de sets do perfil ---------- */
  function render(list) {
    if (!list.length) { deckList.hidden = true; return; }
    deckList.innerHTML = "";
    list.forEach((s, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "deck__item";
      b.dataset.id = s.id;
      b.innerHTML = `<span class="deck__idx">${String(i + 1).padStart(2, "0")}</span><span class="deck__name"></span><span class="deck__dur">${fmt(s.duration || s.full_duration || 0)}</span>`;
      $(".deck__name", b).textContent = s.title;
      b.classList.toggle("is-current", String(s.id) === String(music.currentId));
      b.addEventListener("click", () => music.load(s.permalink_url));
      li.append(b);
      deckList.append(li);
    });
    deckList.hidden = false;
  }

  /* ---------- Intro: boot + entrar com ou sem som ---------- */
  const BOOT = [
    ["> MERCURIO.SYS v2.6", ""],
    ["> carregando bassline", " ........ [OK]"],
    ["> sincronizando offbeat", " ...... [OK]"],
    ["> BPM 142 → 145", " ............. [OK]"],
    ["> sinal: zona leste · SP", " ...... [OK]"],
  ];
  const boot = $("#boot");
  if (reduced) boot.innerHTML = BOOT.map(([a, b]) => `${a}<span class="ok">${b}</span>`).join("\n");
  else {
    let i = 0;
    const line = () => {
      if (i >= BOOT.length || document.documentElement.classList.contains("is-loaded")) return;
      const [a, b] = BOOT[i++];
      boot.innerHTML += (i > 1 ? "\n" : "") + a + `<span class="ok">${b}</span>`;
      setTimeout(line, 260);
    };
    setTimeout(line, 200);
  }
  const enter = (withSound) => {
    if (withSound) music.start();
    document.documentElement.classList.add("is-loaded");
  };
  $("#enterSound").addEventListener("click", () => enter(true));
  $("#enterMute").addEventListener("click", () => enter(false));
  $("#enterSound").focus({ preventScroll: true });

  /* ---------- Navegação ---------- */
  const nav = $("#nav");
  const burger = $("#burger");
  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const setMenu = (open) => {
    nav.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };
  burger.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  /* ---------- Reveal ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal").forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    el.style.setProperty("--d", `${Math.min(sibs.indexOf(el), 6) * 0.08}s`);
    io.observe(el);
  });

  /* ---------- Brilho do cursor ---------- */
  const glow = $(".cursor-glow");
  let mx = innerWidth / 2, my = innerHeight / 2;
  if (matchMedia("(hover: hover)").matches && !reduced) {
    let gx = mx, gy = my;
    addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    const follow = () => {
      gx += (mx - gx) * 0.12; gy += (my - gy) * 0.12;
      glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      requestAnimationFrame(follow);
    };
    follow();
  }

  /* ---------- HUD: relógio + BPM ---------- */
  const clock = $("#clock");
  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour12: false });
  };
  tick(); setInterval(tick, 1000);
  const bpm = $("#bpm");
  if (!reduced) {
    let b = 142, dir = 1;
    setInterval(() => {
      b += dir;
      if (b >= 145 || b <= 142) dir = -dir;
      bpm.textContent = b;
    }, 1600);
  }

  /* ---------- Grid em perspectiva + partículas (hero) ---------- */
  const canvas = $("#grid");
  const ctx = canvas.getContext("2d");
  const hero = $(".hero");
  let W, H, dpr, parts = [], heroVisible = true, offset = 0;
  const COLORS = ["0,240,255", "180,77,255", "255,43,214", "232,255,58", "230,236,245"];
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.width = hero.offsetWidth * dpr;
    H = canvas.height = hero.offsetHeight * dpr;
    const n = Math.round(Math.min(120, (hero.offsetWidth * hero.offsetHeight) / 11000));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.62,
      s: (Math.random() * 1.3 + 0.4) * dpr, v: (Math.random() * 0.5 + 0.15) * dpr,
      c: COLORS[(Math.random() * COLORS.length) | 0], t: Math.random() * Math.PI * 2,
    }));
  };
  resize();
  addEventListener("resize", resize);
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
  const draw = () => {
    if (heroVisible) {
      ctx.clearRect(0, 0, W, H);
      const horizon = H * 0.64 + (my / innerHeight - 0.5) * 20 * dpr;
      const vx = W / 2 + (mx / innerWidth - 0.5) * 80 * dpr;
      // chão
      const g = ctx.createLinearGradient(0, horizon, 0, H);
      g.addColorStop(0, "rgba(255,43,214,0)");
      g.addColorStop(1, "rgba(122,44,255,.18)");
      ctx.fillStyle = g;
      ctx.fillRect(0, horizon, W, H - horizon);
      ctx.lineWidth = dpr;
      // linhas que convergem no ponto de fuga
      ctx.strokeStyle = "rgba(0,240,255,.28)";
      ctx.beginPath();
      for (let i = -14; i <= 14; i++) {
        ctx.moveTo(vx + i * W * 0.012, horizon);
        ctx.lineTo(W / 2 + i * W * 0.11, H);
      }
      ctx.stroke();
      // linhas horizontais andando na direção de quem vê
      offset = (offset + 0.006) % 1;
      for (let i = 0; i < 14; i++) {
        const k = ((i + offset) / 14) ** 2.2;
        const y = horizon + (H - horizon) * k;
        ctx.strokeStyle = `rgba(255,43,214,${0.1 + k * 0.45})`;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      // linha do horizonte
      ctx.strokeStyle = "rgba(0,240,255,.7)";
      ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 14 * dpr;
      ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(W, horizon); ctx.stroke();
      ctx.shadowBlur = 0;
      // partículas subindo (vapor de mercúrio)
      for (const p of parts) {
        p.y -= p.v; p.t += 0.04;
        if (p.y < -10) { p.y = horizon; p.x = Math.random() * W; }
        ctx.fillStyle = `rgba(${p.c},${0.35 + Math.sin(p.t) * 0.3})`;
        ctx.fillRect(p.x, p.y, p.s * 1.6, p.s * 1.6);
      }
    }
    if (!reduced) requestAnimationFrame(draw);
  };
  draw();

  /* ---------- Tilt no retrato ---------- */
  $$(".tilt").forEach((el) => {
    if (reduced || !matchMedia("(hover: hover)").matches) return;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  });

  /* ---------- Vídeos: arquivos locais + Google Drive ---------- */
  const reelsWrap = $("#reels");
  const driveId = (v) => {
    v = (v || "").trim();
    const m = v.match(/\/d\/([\w-]{20,})/) || v.match(/[?&]id=([\w-]{20,})/);
    return m ? m[1] : (/^[\w-]{20,}$/.test(v) ? v : "");
  };
  $$(".reel--drive", reelsWrap).forEach((reel) => {
    const id = driveId(reel.dataset.drive);
    if (!id) { reel.hidden = true; return; }
    reel.dataset.driveId = id;
    const poster = $(".reel__poster", reel);
    if (!poster.getAttribute("src")) {
      // miniatura gerada pelo próprio Drive; se falhar, usa um pôster local
      poster.addEventListener("error", () => { poster.src = "assets/img/poster-hero.jpg"; }, { once: true });
      poster.src = `https://drive.google.com/thumbnail?id=${id}&sz=w720`;
    }
  });
  const reels = $$(".reel", reelsWrap).filter((r) => !r.hidden);
  reelsWrap.dataset.count = reels.length;

  const stopDrive = (reel) => {
    $("iframe", reel)?.remove();
    reel.classList.remove("is-playing");
  };
  const stopOthers = (keep) => reels.forEach((r) => {
    if (r === keep) return;
    if (r.classList.contains("reel--drive")) stopDrive(r);
    else $("video", r).pause();
  });
  let duckTimer = 0;
  const duckForVideos = () => {
    clearTimeout(duckTimer);
    duckTimer = setTimeout(() => {
      const watching = reels.some((r) =>
        r.classList.contains("reel--drive") ? r.classList.contains("is-playing") : !$("video", r).paused);
      document.documentElement.classList.toggle("is-watching", watching);
      music.duck(watching);
    }, 120);
  };

  reels.forEach((reel) => {
    if (reel.classList.contains("reel--drive")) {
      // O Drive não avisa quando o vídeo toca/pausa (iframe de outro domínio),
      // então a música abaixa ao abrir o player e volta ao clicar em "parar".
      $(".reel__play", reel).addEventListener("click", () => {
        stopOthers(reel);
        const f = Object.assign(document.createElement("iframe"), {
          src: `https://drive.google.com/file/d/${reel.dataset.driveId}/preview`,
          title: $("h3", reel).textContent, allow: "autoplay; fullscreen", allowFullscreen: true,
        });
        $(".reel__phone", reel).append(f);
        reel.classList.add("is-playing");
        duckForVideos();
      });
      $(".reel__stop", reel).addEventListener("click", () => { stopDrive(reel); duckForVideos(); });
      return;
    }
    const video = $("video", reel);
    $(".reel__play", reel).addEventListener("click", () => {
      stopOthers(reel);
      video.controls = true;
      video.play().catch(() => {});
    });
    video.addEventListener("play", () => {
      reel.classList.add("is-playing");
      stopOthers(reel);
    });
    video.addEventListener("ended", () => { reel.classList.remove("is-playing"); video.controls = false; });
    // música sai em fade quando um vídeo toca e volta em fade quando ele para
    ["play", "pause", "ended"].forEach((ev) => video.addEventListener(ev, duckForVideos));
  });

  /* ---------- Lightbox ---------- */
  const tiles = $$("#masonry .tile");
  const lb = $("#lightbox");
  const lbImg = $("img", lb);
  let idx = 0, lastFocus = null;
  const show = (i) => {
    idx = (i + tiles.length) % tiles.length;
    const img = $("img", tiles[idx]);
    lbImg.src = tiles[idx].href;
    lbImg.alt = img.alt;
  };
  const close = () => { lb.hidden = true; document.body.style.overflow = ""; lastFocus?.focus(); };
  tiles.forEach((tile, i) => tile.addEventListener("click", (e) => {
    e.preventDefault();
    lastFocus = tile;
    show(i);
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    $(".lightbox__close", lb).focus();
  }));
  $(".lightbox__close", lb).addEventListener("click", close);
  $(".lightbox__nav--prev", lb).addEventListener("click", () => show(idx - 1));
  $(".lightbox__nav--next", lb).addEventListener("click", () => show(idx + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(idx - 1);
    if (e.key === "ArrowRight") show(idx + 1);
  });

  /* ---------- Idioma PT / EN ---------- */
  const langBtn = $("#langBtn");
  const applyLang = () => {
    $$("[data-en]").forEach((el) => {
      if (el.dataset.pt === undefined) el.dataset.pt = el.innerHTML;
      el.innerHTML = lang === "en" ? el.dataset.en : el.dataset.pt;
    });
    // texto do glitch acompanha o idioma
    $$(".glitch").forEach((el) => { el.dataset.text = el.textContent; });
    document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
    const [a, , b] = langBtn.children;
    a.textContent = lang === "en" ? "EN" : "PT";
    b.textContent = lang === "en" ? "PT" : "EN";
  };
  langBtn.addEventListener("click", () => {
    lang = lang === "en" ? "pt" : "en";
    store.set("mercurio-lang", lang);
    applyLang();
  });
  if (lang === "en") applyLang();

  /* ---------- Clipboard ---------- */
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = Object.assign(document.createElement("textarea"), { value: text });
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.append(ta); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    }
  };

  /* ---------- Pedido de booking (WhatsApp) ---------- */
  const WHATSAPP = "5511940530379";
  const form = $("#brief");
  const status = $("#briefStatus");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const req = $$("[required]", form);
    req.forEach((f) => f.classList.toggle("is-invalid", !f.value.trim()));
    const missing = req.find((f) => !f.value.trim());
    if (missing) {
      status.style.color = "var(--magenta)";
      status.textContent = t("Preencha os campos destacados.", "Please fill in the highlighted fields.");
      missing.focus();
      return;
    }
    const d = Object.fromEntries(new FormData(form));
    const date = d.data ? d.data.split("-").reverse().join("/") : "";
    const text = lang === "en"
      ? `Hi Mercúrio! I'd like to book you.\n\nEvent: ${d.evento}\nCity: ${d.cidade}\nDate: ${date}\nFormat: ${d.formato}\nContact: ${d.nome}${d.msg ? `\n\n${d.msg}` : ""}`
      : `Olá, Mercúrio! Gostaria de te contratar.\n\nEvento: ${d.evento}\nCidade: ${d.cidade}\nData: ${date}\nFormato: ${d.formato}\nContato: ${d.nome}${d.msg ? `\n\n${d.msg}` : ""}`;
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
    status.style.color = "";
    status.textContent = t("Abrindo o WhatsApp com o pedido pronto.", "Opening WhatsApp with your request.");
    // caso o pop-up seja bloqueado, deixa o link à mão
    const link = Object.assign(document.createElement("a"), { href: url, target: "_blank", rel: "noopener", textContent: t(" Abrir WhatsApp →", " Open WhatsApp →") });
    link.style.cssText = "color: var(--cyan); text-decoration: underline";
    status.append(link);
    window.open(url, "_blank", "noopener");
  });
  $$("input, textarea", form).forEach((f) => f.addEventListener("input", () => f.classList.remove("is-invalid")));

  /* ---------- Bio curta (press kit) ---------- */
  const BIO = {
    pt: "Mercúrio é o projeto de progressive / psytrance de Gilliard Rocha, 24 anos, da zona leste de São Paulo. Basslines agressivos e elementos em offbeat levam a pista dos 142 aos 145 BPM. Booking: (11) 94053-0379 · djm3036@gmail.com · @_mercuriodj",
    en: "Mercúrio is the progressive / psytrance project of Gilliard Rocha, 24, from the east side of São Paulo. Aggressive basslines and offbeat elements push the dancefloor from 142 to 145 BPM. Booking: +55 11 94053-0379 · djm3036@gmail.com · @_mercuriodj",
  };
  const bioBtn = $("#copyBio");
  bioBtn.addEventListener("click", async () => {
    const type = $(".kit__type", bioBtn);
    const ok = await copy(BIO[lang]);
    type.textContent = ok ? t("copiada ✓", "copied ✓") : "—";
    setTimeout(() => { type.textContent = t("clique para copiar", "click to copy"); }, 2200);
  });

  $("#year").textContent = new Date().getFullYear();
})();
