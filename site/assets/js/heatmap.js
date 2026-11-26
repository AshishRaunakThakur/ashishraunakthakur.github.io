// Contribution heatmap.
// Reads the latest real GitHub contribution calendar refreshed by GitHub Actions.

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmtLong = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fmtShort = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtMonth = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

const toDate = (iso) => new Date(`${iso}T00:00:00Z`);
const plural = (n, word) => `${n.toLocaleString("en-GB")} ${word}${n === 1 ? "" : "s"}`;

async function loadData() {
  const res = await fetch(`data/contributions.json?_=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Contribution data ${res.status}`);
  const json = await res.json();
  if (json.login !== "AshishRaunakThakur" || json.method !== "GitHub GraphQL API" || !Array.isArray(json.days) || json.days.length === 0) {
    throw new Error("missing or incorrect contribution data");
  }
  if (!json.days.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Number.isFinite(Number(day.count)) && Number.isFinite(Number(day.level)))) {
    throw new Error("invalid contribution data");
  }
  return json;
}

async function loadGitHubGlance(root) {
  const nodes = Object.fromEntries(["repos", "stars", "followers", "following"].map((key) => [key, root.querySelector(`[data-github-stat="${key}"]`)]));
  try {
    const headers = { Accept: "application/vnd.github+json" };
    const profileResponse = await fetch("https://api.github.com/users/AshishRaunakThakur", { headers, cache: "no-store" });
    if (!profileResponse.ok) throw new Error(`GitHub profile ${profileResponse.status}`);
    const profile = await profileResponse.json();
    nodes.repos.textContent = Number(profile.public_repos).toLocaleString("en-GB");
    nodes.followers.textContent = Number(profile.followers).toLocaleString("en-GB");
    nodes.following.textContent = Number(profile.following).toLocaleString("en-GB");

    let page = 1, stars = 0, repos = [];
    do {
      const response = await fetch(`https://api.github.com/users/AshishRaunakThakur/repos?type=owner&sort=updated&per_page=100&page=${page}`, { headers, cache: "no-store" });
      if (!response.ok) throw new Error(`GitHub repositories ${response.status}`);
      repos = await response.json();
      stars += repos.reduce((sum, repo) => sum + Number(repo.stargazers_count || 0), 0);
      page++;
    } while (repos.length === 100 && page <= 10);
    nodes.stars.textContent = stars.toLocaleString("en-GB");
  } catch {
    root.querySelector("[data-github-glance]").dataset.unavailable = "true";
    Object.values(nodes).forEach((node) => { if (node.textContent === "—") node.textContent = "Unavailable"; });
  }
}

function computeStats(days) {
  let total = 0, active = 0, run = 0, best = 0, peak = null;
  for (const d of days) {
    total += d.count;
    if (d.count > 0) {
      active++;
      run++;
      best = Math.max(best, run);
      if (!peak || d.count > peak.count) peak = d;
    } else run = 0;
  }
  return { total, active, best, peak };
}

export async function initHeatmap(root) {
  if (!root) return;
  const grid = root.querySelector("[data-heatmap-grid]");
  const months = root.querySelector("[data-heatmap-months]");
  const tip = root.querySelector("[data-heatmap-tip]");
  const readout = root.querySelector("[data-heatmap-readout]");
  const source = root.querySelector("[data-heatmap-source]");
  const scroller = root.querySelector("[data-heatmap-scroller]");
  const stat = (k) => root.querySelector(`[data-stat="${k}"]`);

  loadGitHubGlance(root);
  let data;
  let days;
  try {
    data = await loadData();
    days = data.days;
  } catch {
    source.textContent = "Verified GitHub contribution data is unavailable. The portfolio needs a successful profile-authorized refresh.";
    root.querySelectorAll('[data-stat]').forEach((el) => { el.textContent = "Unavailable"; });
    grid.setAttribute("aria-label", "Verified GitHub contribution data is unavailable.");
    return;
  }
  const sourceLabel = "public GitHub contribution calendar";

  /* ---- Source line ---- */
  const fetched = data.fetchedAt ? fmtShort.format(new Date(data.fetchedAt)) : "unknown date";
  source.innerHTML = `<span class="badge">Real data</span>GitHub calendar for <a class="link-u" href="https://github.com/${data.login}" target="_blank" rel="noopener">@${data.login}</a> · refreshed ${fetched}`;

  /* ---- Build grid: one row element per weekday, cells placed explicitly ---- */
  const offset = toDate(days[0].date).getUTCDay();
  const rows = Array.from({ length: 7 }, () => {
    const r = document.createElement("div");
    r.setAttribute("role", "row");
    return r;
  });
  const cells = days.map((d, i) => {
    const idx = i + offset;
    const week = Math.floor(idx / 7);
    const dow = idx % 7;
    const el = document.createElement("span");
    el.className = "cell";
    el.setAttribute("role", "gridcell");
    el.tabIndex = -1;
    el.dataset.l = d.level;
    el.dataset.i = i;
    el.style.gridColumn = week + 1;
    el.style.gridRow = dow + 1;
    el.style.setProperty("--w", week);
    const date = toDate(d.date);
    el.setAttribute("aria-label", `${d.count === 0 ? "No" : d.count} contribution${d.count === 1 ? "" : "s"} on ${WEEKDAYS[dow]}, ${fmtLong.format(date)}`);
    rows[dow].append(el);
    return el;
  });
  grid.replaceChildren(...rows);

  /* ---- Month labels ---- */
  const labels = [];
  let lastMonth = -1;
  days.forEach((d, i) => {
    const date = toDate(d.date);
    if (date.getUTCMonth() === lastMonth) return;
    lastMonth = date.getUTCMonth();
    labels.push({ col: Math.floor((i + offset) / 7), text: fmtMonth.format(date) });
  });
  // a partial first month would collide with the next label — drop it
  if (labels.length > 1 && labels[1].col - labels[0].col < 3) labels.shift();
  months.replaceChildren(...labels.map(({ col, text }) => {
    const s = document.createElement("span");
    s.textContent = text;
    s.style.left = `calc(${col} * (var(--cell) + var(--gap)))`;
    return s;
  }));

  /* ---- Ranges & stats ---- */
  const lastTime = toDate(days[days.length - 1].date).getTime();
  let range = "all";
  const inRange = (d) => range === "all" || lastTime - toDate(d.date).getTime() < Number(range) * DAY_MS;

  function renderStats() {
    const subset = days.filter(inRange);
    const s = computeStats(subset);
    cells.forEach((c, i) => c.classList.toggle("is-dim", !inRange(days[i])));
    const from = fmtShort.format(toDate(subset[0].date));
    const to = fmtShort.format(toDate(subset[subset.length - 1].date));
    stat("total").innerHTML = `${s.total.toLocaleString("en-GB")}<small>${from} – ${to}</small>`;
    stat("active").innerHTML = `${s.active}<small>of ${subset.length} days</small>`;
    stat("streak").innerHTML = `${s.best}<small>consecutive days</small>`;
    stat("peak").innerHTML = s.peak
      ? `${s.peak.count}<small>${fmtShort.format(toDate(s.peak.date))}</small>`
      : `0<small>no activity</small>`;
  }

  root.querySelectorAll("[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      range = btn.dataset.range;
      root.querySelectorAll("[data-range]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      renderStats();
    });
  });
  renderStats();

  /* ---- Tooltip + readout ---- */
  function describe(i) {
    const d = days[i];
    const date = toDate(d.date);
    return {
      title: d.count === 0 ? "No contributions" : plural(d.count, "contribution"),
      when: `${WEEKDAYS[date.getUTCDay()]}, ${fmtLong.format(date)}`,
    };
  }
  function show(cell) {
    const { title, when } = describe(Number(cell.dataset.i));
    tip.innerHTML = `<b>${title}</b><span>${when}</span><br><span>Source: ${sourceLabel}</span>`;
    tip.hidden = false;
    const r = cell.getBoundingClientRect();
    const host = root.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    const x = Math.min(Math.max(r.left + r.width / 2 - host.left, half + 8), host.width - half - 8);
    tip.style.left = `${x}px`;
    tip.style.top = `${r.top - host.top}px`;
    readout.innerHTML = `<b>${title}</b> · ${when}`;
  }
  const hide = () => { tip.hidden = true; };

  grid.addEventListener("pointerover", (e) => { const c = e.target.closest(".cell"); if (c) show(c); });
  grid.addEventListener("pointerleave", hide);
  grid.addEventListener("focusin", (e) => { const c = e.target.closest(".cell"); if (c) show(c); });
  grid.addEventListener("focusout", hide);
  scroller.addEventListener("scroll", hide, { passive: true });

  /* ---- Keyboard: roving tabindex across the grid ---- */
  let current = cells.length - 1;
  cells[current].tabIndex = 0;
  const moveTo = (i) => {
    if (i < 0 || i >= cells.length) return;
    cells[current].tabIndex = -1;
    cells[current].removeAttribute("aria-selected");
    current = i;
    cells[current].tabIndex = 0;
    cells[current].setAttribute("aria-selected", "true");
    cells[current].focus({ preventScroll: false });
  };
  grid.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); moveTo(current + step); }
    else if (e.key === "Home") { e.preventDefault(); moveTo(0); }
    else if (e.key === "End") { e.preventDefault(); moveTo(cells.length - 1); }
  });
  grid.addEventListener("click", (e) => {
    const c = e.target.closest(".cell");
    if (c) moveTo(Number(c.dataset.i));
  });

  // Start scrolled to the most recent weeks on narrow screens
  scroller.scrollLeft = scroller.scrollWidth;

  /* ---- Entrance ---- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { grid.classList.add("is-live"); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(grid);
  } else grid.classList.add("is-live");
}
