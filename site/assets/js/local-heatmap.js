(function () {
  if (location.protocol !== "file:") return;
  const snapshot = {"login":"AshishRaunakThakur","fetchedAt":"2026-11-25T14:11:33+00:00","days":368,"from":"2025-11-23","pairs":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiAAAAAAAAAAGAGGGGGGGGGGGGGGGGGGGGGGGGAGAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAnAAAMXXGRAAMARAGRGMGMGGRGGGAGGGGGGGGGGAGGXGGGRGGi"};
  const root = document.querySelector("[data-heatmap]");
  if (!root) return;
  const source = root.querySelector("[data-heatmap-source]");
  const empty = root.querySelector("[data-heatmap-empty]");
  const grid = root.querySelector("[data-heatmap-grid]");
  const months = root.querySelector("[data-heatmap-months]");
  const scroller = root.querySelector("[data-heatmap-scroller]");
  const readout = root.querySelector("[data-heatmap-readout]");
  if (!snapshot.days || !snapshot.pairs) {
    if (source) source.innerHTML = '<span class="badge">Awaiting data</span>Real GitHub activity will appear after the public calendar refreshes.';
    if (empty) empty.hidden = false;
    return;
  }

  const days = [...snapshot.pairs].map((code, i) => {
    const value = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".indexOf(code);
    const date = new Date(Date.parse(snapshot.from + "T00:00:00Z") + i * 86400000);
    return { date, iso: date.toISOString().slice(0, 10), count: Math.floor(value / 5), level: value % 5 };
  });
  const fmtLong = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const fmtShort = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const fmtMonth = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const fetched = snapshot.fetchedAt ? fmtShort.format(new Date(snapshot.fetchedAt)) : "recently";
  if (source) source.innerHTML = '<span class="badge">Live data</span>Public GitHub calendar for <a href="https://github.com/' + snapshot.login + '" target="_blank" rel="noopener">@' + snapshot.login + '</a> · snapshot ' + fetched;
  if (empty) empty.hidden = true;

  const offset = days[0].date.getUTCDay();
  const rows = Array.from({ length: 7 }, () => {
    const row = document.createElement("div");
    row.setAttribute("role", "row");
    return row;
  });
  const cells = days.map((day, i) => {
    const index = i + offset;
    const week = Math.floor(index / 7);
    const dow = index % 7;
    const cell = document.createElement("span");
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    cell.tabIndex = -1;
    cell.dataset.l = day.level;
    cell.dataset.i = i;
    cell.style.gridColumn = week + 1;
    cell.style.gridRow = dow + 1;
    cell.style.setProperty("--w", week);
    cell.setAttribute("aria-label", (day.count ? day.count + " contribution" + (day.count === 1 ? "" : "s") : "No contributions") + " on " + weekdays[dow] + ", " + fmtLong.format(day.date));
    rows[dow].append(cell);
    return cell;
  });
  grid.replaceChildren(...rows);

  let lastMonth = -1;
  const labels = [];
  days.forEach((day, i) => {
    const month = day.date.getUTCMonth();
    if (month === lastMonth) return;
    lastMonth = month;
    labels.push({ col: Math.floor((i + offset) / 7), text: fmtMonth.format(day.date) });
  });
  if (labels.length > 1 && labels[1].col - labels[0].col < 3) labels.shift();
  months.replaceChildren(...labels.map(({ col, text }) => {
    const label = document.createElement("span");
    label.textContent = text;
    label.style.left = "calc(" + col + " * (var(--cell) + var(--gap)))";
    return label;
  }));

  const lastTime = days.at(-1).date.getTime();
  let range = "all";
  const inRange = (day) => range === "all" || lastTime - day.date.getTime() < Number(range) * 86400000;
  const renderStats = () => {
    const subset = days.filter(inRange);
    let total = 0, active = 0, run = 0, best = 0, peak = null;
    subset.forEach((day) => {
      total += day.count;
      if (day.count) {
        active++;
        run++;
        best = Math.max(best, run);
        if (!peak || day.count > peak.count) peak = day;
      } else run = 0;
    });
    cells.forEach((cell, i) => cell.classList.toggle("is-dim", !inRange(days[i])));
    root.querySelector('[data-stat="total"]').innerHTML = total.toLocaleString("en-GB") + "<small>" + fmtShort.format(subset[0].date) + " – " + fmtShort.format(subset.at(-1).date) + "</small>";
    root.querySelector('[data-stat="active"]').innerHTML = active + "<small>of " + subset.length + " days</small>";
    root.querySelector('[data-stat="streak"]').innerHTML = best + "<small>consecutive days</small>";
    root.querySelector('[data-stat="peak"]').innerHTML = peak ? peak.count + "<small>" + fmtShort.format(peak.date) + "</small>" : "0<small>no activity</small>";
  };
  root.querySelectorAll("[data-range]").forEach((button) => button.addEventListener("click", () => {
    range = button.dataset.range;
    root.querySelectorAll("[data-range]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    renderStats();
  }));
  renderStats();

  const tip = root.querySelector("[data-heatmap-tip]");
  const show = (cell) => {
    const day = days[Number(cell.dataset.i)];
    const dow = weekdays[day.date.getUTCDay()];
    const count = day.count ? day.count + " contribution" + (day.count === 1 ? "" : "s") : "No contributions";
    tip.innerHTML = "<b>" + count + "</b><span>" + dow + ", " + fmtLong.format(day.date) + "</span>";
    tip.hidden = false;
    const box = cell.getBoundingClientRect();
    const host = root.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    tip.style.left = Math.min(Math.max(box.left + box.width / 2 - host.left, half + 8), host.width - half - 8) + "px";
    tip.style.top = box.top - host.top + "px";
    readout.innerHTML = "<b>" + count + "</b> · " + dow + ", " + fmtLong.format(day.date);
  };
  const hide = () => { tip.hidden = true; };
  grid.addEventListener("pointerover", (event) => { const cell = event.target.closest(".cell"); if (cell) show(cell); });
  grid.addEventListener("pointerleave", hide);
  grid.addEventListener("focusin", (event) => { const cell = event.target.closest(".cell"); if (cell) show(cell); });
  grid.addEventListener("focusout", hide);
  scroller.addEventListener("scroll", hide, { passive: true });
  let current = cells.length - 1;
  cells[current].tabIndex = 0;
  const moveTo = (index) => {
    if (index < 0 || index >= cells.length) return;
    cells[current].tabIndex = -1;
    cells[current].removeAttribute("aria-selected");
    current = index;
    cells[current].tabIndex = 0;
    cells[current].setAttribute("aria-selected", "true");
    cells[current].focus({ preventScroll: false });
  };
  grid.addEventListener("keydown", (event) => {
    const step = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step) { event.preventDefault(); moveTo(current + step); }
    else if (event.key === "Home") { event.preventDefault(); moveTo(0); }
    else if (event.key === "End") { event.preventDefault(); moveTo(cells.length - 1); }
  });
  grid.addEventListener("click", (event) => { const cell = event.target.closest(".cell"); if (cell) moveTo(Number(cell.dataset.i)); });
  scroller.scrollLeft = scroller.scrollWidth;
  grid.classList.add("is-live");
})();
