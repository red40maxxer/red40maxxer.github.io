(function () {
  "use strict";

  var LOCALE = "en-US";
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return Number(n).toLocaleString(LOCALE); }
  function signed(p) { return p > 0 ? "+" + p + "%" : p < 0 ? "-" + Math.abs(p) + "%" : "0%"; }
  function pctChange(a, b) { return b ? Math.round((a / b - 1) * 100) : 0; }
  function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }
  function parseDate(iso) { var p = iso.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function shortDate(d) { return d.getUTCDate() + " " + MON[d.getUTCMonth()]; }
  function longDate(d) { return DOW[d.getUTCDay()] + " " + shortDate(d); }
  function niceMax(v) {
    var mag = Math.pow(10, Math.floor(Math.log10(v || 1)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * mag >= v) return steps[i] * mag;
    return 10 * mag;
  }

  function chWidth(el) {
    var probe = document.createElement("span");
    probe.textContent = "0000000000";
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;";
    el.appendChild(probe);
    var w = probe.getBoundingClientRect().width / 10;
    el.removeChild(probe);
    return w || 8;
  }

  function tipFor(fig) {
    var tip = fig.querySelector(":scope > .tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "tip";
      tip.hidden = true;
      tip.setAttribute("role", "status");
      fig.appendChild(tip);
    }
    return tip;
  }
  function showTip(fig, html, x, y) {
    var tip = tipFor(fig);
    tip.innerHTML = html;
    tip.hidden = false;
    var fr = fig.getBoundingClientRect(), w = tip.offsetWidth;
    var left = x - fr.left + 16;
    if (left + w > fr.width) left = x - fr.left - w - 16;
    if (left < 0) left = Math.max(0, fr.width - w);
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(y - fr.top + 16) + "px";
  }
  function hideTip(fig) { tipFor(fig).hidden = true; }
  function center(el) { var r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
  function line(v, k) { return v + ' <span class="k">' + esc(k) + "</span>"; }

  function head(title, withToggle) {
    var h = '<div class="chart-head"><span class="chart-title">' + esc(title || "") + "</span>";
    if (withToggle) {
      h += '<div class="row"><button type="button" data-view="chart" aria-pressed="true">Chart</button>' +
           '<button type="button" data-view="table" aria-pressed="false">Table</button></div>';
    }
    return h + "</div>";
  }
  function wireToggle(fig, onChart) {
    fig.querySelectorAll("button[data-view]").forEach(function (b) {
      b.addEventListener("click", function () {
        var table = b.dataset.view === "table";
        fig.querySelector(".chart-view").hidden = table;
        fig.querySelector(".chart-table").hidden = !table;
        fig.querySelectorAll("button[data-view]").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
        hideTip(fig);
        if (!table && onChart) onChart();
      });
    });
  }

  function bars(fig, d) {
    var rows = d.rows || [], unit = d.unit || "";
    var total = sum(rows.map(function (r) { return r.value; }));
    var avg = total / (rows.length || 1);
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
    var labelW = Math.max.apply(null, rows.map(function (r) { return String(r.label).length; }).concat([2]));
    var valW = Math.max.apply(null, rows.map(function (r) { return fmt(r.value).length; }).concat([3]));

    fig.innerHTML = head(d.title, true) +
      '<div class="chart-view"><div class="hbars" style="--label-w:' + labelW + "ch;--val-w:" + valW + 'ch">' +
      rows.map(function (r, i) {
        return '<div class="hbar" tabindex="0" data-i="' + i + '" aria-label="' + esc((r.name || r.label) + ", " + fmt(r.value) + " " + unit) + '">' +
          '<span class="label">' + esc(r.label) + '</span><span class="track"><span class="fill"></span></span>' +
          '<span class="val">' + fmt(r.value) + "</span></div>";
      }).join("") + "</div></div>" +
      '<div class="chart-table scroll" hidden><table><thead><tr><th></th><th class="num">' + esc(unit || "Value") +
      '</th><th class="num">Share</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return "<tr><td>" + esc(r.name || r.label) + '</td><td class="num">' + fmt(r.value) + '</td><td class="num">' +
          Math.round(r.value / total * 100) + "%</td></tr>";
      }).join("") + "</tbody></table></div>" +
      (d.note ? '<div class="chart-foot">' + esc(d.note) + "</div>" : "");

    var wrap = fig.querySelector(".hbars"), els = wrap.querySelectorAll(".hbar");
    function size() {
      var track = wrap.querySelector(".track");
      if (!track) return;
      var avail = Math.floor(track.clientWidth / chWidth(wrap));
      els.forEach(function (el, i) {
        el.querySelector(".fill").style.width = Math.round(rows[i].value / max * avail * 8) / 8 + "ch";
      });
    }
    function tip(el, x, y) {
      els.forEach(function (o) { o.classList.toggle("on", o === el); });
      var r = rows[+el.dataset.i];
      showTip(fig, "<b>" + esc(r.name || r.label) + "</b>" + line(fmt(r.value), unit) + "<br>" +
        line(Math.round(r.value / total * 100) + "%", "of total") + "<br>" +
        line(signed(pctChange(r.value, avg)), "vs average"), x, y);
    }
    function clear() { els.forEach(function (o) { o.classList.remove("on"); }); hideTip(fig); }
    els.forEach(function (el) {
      el.addEventListener("pointermove", function (e) { tip(el, e.clientX, e.clientY); });
      el.addEventListener("focus", function () { var p = center(el.querySelector(".val")); tip(el, p[0] - 80, p[1]); });
    });
    wrap.addEventListener("pointerleave", clear);
    wrap.addEventListener("focusout", function (e) { if (!wrap.contains(e.relatedTarget)) clear(); });
    wireToggle(fig, size);
    return size;
  }

  function trend(fig, d) {
    var pts = (d.points || []).map(function (p) {
      var dt = parseDate(p.date), dow = dt.getUTCDay();
      return { d: dt, v: p.value, alt: !!d.weekends && (dow === 0 || dow === 6) };
    });
    var unit = d.unit || "", rows = d.rows || 8;
    var yMax = d.max || niceMax(Math.max.apply(null, pts.map(function (p) { return p.v; }).concat([1])));
    var half = rows / 2;

    var yLabels = [];
    for (var r = 0; r <= rows; r++) yLabels.push("<span>" + (r === 0 || r === rows || r === half ? fmt(yMax * (1 - r / rows)) : "") + "</span>");

    var legend = d.weekends
      ? '<span><span class="sw"></span>Weekday</span><span><span class="sw" style="--c:color-mix(in srgb, var(--accent) 40%, var(--background-color))"></span>Weekend</span>'
      : "";

    fig.innerHTML = head(d.title, true) +
      '<div class="chart-view"><div class="plot"><div class="yaxis" aria-hidden="true">' + yLabels.join("") + "</div>" +
      '<div class="area" tabindex="0" role="img" style="--rows:' + rows + '" aria-label="' + esc((d.title || "Trend") + ". Use the arrow keys to read each point.") + '">' +
      '<div class="cols"></div></div></div><div class="xaxis" aria-hidden="true"></div></div>' +
      '<div class="chart-table scroll" hidden><table><thead><tr><th>Date</th><th class="num">' + esc(unit || "Value") +
      '</th><th class="num">Change</th></tr></thead><tbody>' +
      pts.slice().reverse().map(function (p, i, arr) {
        var prev = arr[i + 1];
        return "<tr><td>" + longDate(p.d) + '</td><td class="num">' + fmt(p.v) + '</td><td class="num">' +
          (prev ? signed(pctChange(p.v, prev.v)) : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<div class="chart-foot">' + legend + '<span class="range"></span></div>';

    var area = fig.querySelector(".area"), cols = fig.querySelector(".cols");
    [0, half, rows].forEach(function (k) {
      var g = document.createElement("div");
      g.className = "gl" + (k === rows ? " base" : "");
      g.style.top = "calc(var(--line-height) / 2 + var(--line-height) * " + k + ")";
      area.insertBefore(g, cols);
    });

    var shown = [], offset = 0, sel = -1, colEls = [], cw = 8;
    function draw() {
      if (!area.clientWidth) return;
      cw = chWidth(area);
      var avail = Math.max(8, Math.floor(area.clientWidth / cw));
      shown = pts.slice(-Math.min(pts.length, avail));
      offset = pts.length - shown.length;
      cols.innerHTML = shown.map(function (p, i) {
        return '<span class="col' + (p.alt ? " alt" : "") + '" data-i="' + i + '"><i style="height:' +
          Math.min(100, p.v / yMax * 100).toFixed(2) + '%"></i></span>';
      }).join("");
      colEls = cols.children;
      var n = shown.length, chars = new Array(n).fill(" ");
      function put(t, at) { for (var j = 0; j < t.length; j++) if (at + j >= 0 && at + j < n) chars[at + j] = t[j]; }
      var a = shortDate(shown[0].d), b = shortDate(shown[n - 1].d), m = shortDate(shown[Math.floor(n / 2)].d);
      put(a, 0);
      put(b, n - b.length);
      var mAt = Math.floor(n / 2) - Math.floor(m.length / 2);
      if (mAt > a.length + 2 && mAt + m.length < n - b.length - 2) put(m, mAt);
      fig.querySelector(".xaxis").textContent = chars.join("");
      fig.querySelector(".range").textContent = "Showing " + n + " of " + pts.length;
      sel = -1;
    }
    function select(i, x, y) {
      if (sel >= 0 && colEls[sel]) colEls[sel].classList.remove("on");
      sel = i;
      colEls[i].classList.add("on");
      var p = shown[i], prev = pts[offset + i - 1];
      var html = "<b>" + longDate(p.d) + "</b>" + line(fmt(p.v), unit);
      if (prev) html += "<br>" + line(signed(pctChange(p.v, prev.v)), "vs previous");
      if (x === undefined) { var c = center(colEls[i]); x = c[0]; y = c[1] - 40; }
      showTip(fig, html, x, y);
    }
    function clear() { if (sel >= 0 && colEls[sel]) colEls[sel].classList.remove("on"); sel = -1; hideTip(fig); }
    area.addEventListener("pointermove", function (e) {
      if (!shown.length) return;
      var i = Math.floor((e.clientX - cols.getBoundingClientRect().left) / cw);
      select(Math.max(0, Math.min(shown.length - 1, i)), e.clientX, e.clientY);
    });
    area.addEventListener("pointerleave", clear);
    area.addEventListener("focus", function () { if (shown.length) select(shown.length - 1); });
    area.addEventListener("blur", clear);
    area.addEventListener("keydown", function (e) {
      var i = sel < 0 ? shown.length - 1 : sel;
      if (e.key === "ArrowLeft") i = Math.max(0, i - 1);
      else if (e.key === "ArrowRight") i = Math.min(shown.length - 1, i + 1);
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = shown.length - 1;
      else return;
      e.preventDefault();
      select(i);
    });
    wireToggle(fig, draw);
    return draw;
  }

  function sparklines(fig, d) {
    var unit = d.unit || "", period = d.period || "Period", start = d.start || 1;
    var data = d.rows || [];
    var cmpN = d.compare || 4;
    fig.innerHTML = head(d.title, false) +
      '<div class="scroll"><table><thead><tr><th></th><th>' + esc(d.sparkLabel || "Trend") +
      '</th><th class="num">Total</th><th class="num">' + esc("Last " + cmpN) + "</th></tr></thead><tbody>" +
      data.map(function (r, ri) {
        var v = r.values, mx = Math.max.apply(null, v.concat([1]));
        var last = sum(v.slice(-cmpN)), prev = sum(v.slice(-2 * cmpN, -cmpN));
        var ch = pctChange(last, prev);
        return "<tr><td>" + esc(r.label) + '</td><td><span class="spark" aria-label="' + esc(r.label + " trend") + '">' +
          v.map(function (x, j) {
            return '<span data-r="' + ri + '" data-j="' + j + '"><i style="height:' + Math.max(8, x / mx * 100).toFixed(1) + '%"></i></span>';
          }).join("") + '</span></td><td class="num">' + fmt(sum(v)) + '</td><td class="num ' + (ch >= 0 ? "up" : "down") + '">' +
          signed(ch) + "</td></tr>";
      }).join("") + "</tbody></table></div>";

    var tbody = fig.querySelector("tbody"), on = null;
    tbody.addEventListener("pointermove", function (e) {
      var c = e.target.closest("[data-j]");
      if (on && on !== c) on.classList.remove("on");
      if (!c) { on = null; hideTip(fig); return; }
      on = c;
      c.classList.add("on");
      var r = data[+c.dataset.r], j = +c.dataset.j;
      showTip(fig, "<b>" + esc(r.label) + "</b>" + '<span class="k">' + esc(period) + "</span> " + (start + j) + "<br>" + line(fmt(r.values[j]), unit), e.clientX, e.clientY);
    });
    tbody.addEventListener("pointerleave", function () { if (on) on.classList.remove("on"); on = null; hideTip(fig); });
    return function () {};
  }

  function layers(fig, d) {
    var runs = d.runs || [], groups = d.groups || [], cats = d.categories || [], positions = d.positions || [];
    var pos = d.position || (positions[0] && positions[0][0]);
    var PICK = [8, 12, 16, 18, 20, 22, 24, 28];
    var labelW = 2 + Math.max.apply(null, groups.map(function (g) { return g[1].length; }).concat(cats.map(function (c) { return c[1].length - 2; })));
    var cw = 8, sel = null;

    function pct(v) { return v + "%"; }
    function series(run, c) {
      var byG = run.curves[pos][c];
      return groups.filter(function (g) { return byG[g[0]]; });
    }
    function layerName(run, j) { return j < run.layers.length ? "L" + run.layers[j] : "Model output"; }
    function axis(run) {
      var n = run.layers.length, chars = new Array(n + 4).fill(" ");
      function put(t, at) { for (var k = 0; k < t.length; k++) chars[at + k] = t[k]; }
      var mid = Math.floor((n - 1) / 2), last = "L" + run.layers[n - 1];
      put("L0", 0);
      put("L" + run.layers[mid], mid);
      put(last, n - last.length);
      put("out", n + 1);
      return chars.join("");
    }

    fig.innerHTML = head(d.title, true) +
      '<div class="row"><span class="muted">Position</span>' +
      positions.filter(function (p) { return runs.some(function (r) { return r.curves[p[0]]; }); }).map(function (p) {
        return '<button type="button" data-pos="' + esc(p[0]) + '" aria-pressed="' + (p[0] === pos) + '">' + esc(p[1]) + "</button>";
      }).join("") + "</div>" +
      '<p class="layers-cap muted"></p>' +
      '<div class="chart-view"></div><div class="chart-table scroll" hidden></div>' +
      '<div class="chart-foot">' + groups.map(function (g) {
        return '<span><span class="sw" style="--c:var(' + g[2] + ')"></span>' + esc(g[1]) + "</span>";
      }).join("") + '<span><span class="sw-out"></span>Model output</span></div>';

    var view = fig.querySelector(".chart-view"), table = fig.querySelector(".chart-table");

    function render() {
      sel = null;
      hideTip(fig);
      fig.querySelector(".layers-cap").textContent = (positions.filter(function (p) { return p[0] === pos; })[0] || [])[2] || "";
      view.innerHTML = runs.map(function (run, ri) {
        if (!run.curves[pos]) return "";
        var sizes = groups.filter(function (g) { return run.curves[pos].refusal[g[0]]; }).map(function (g) {
          return g[1].toLowerCase() + " n=" + fmt(run.sizes[g[0]]);
        }).join(", ");
        var drop = (run.dropped || {})[pos];
        if (drop && drop.length) sizes += "; dropped as generic: " + drop.join(", ");
        return '<div class="layers-run"><div><b>' + esc(run.label) + '</b> <span class="muted">' + esc(sizes) + "</span></div>" +
          '<div class="layers-scroll" style="--label-w:' + labelW + 'ch"><div class="lrow laxis" aria-hidden="true"><span></span><span>' + axis(run) + "</span></div>" +
          cats.map(function (c, ci) {
            return '<div class="lcat" tabindex="0" data-r="' + ri + '" data-c="' + ci + '" aria-label="' +
              esc(c[1] + ", " + run.label + ". Use the arrow keys to read each layer.") + '">' +
              '<div class="lrow"><span class="lname"><b>' + esc(c[1]) + "</b></span><span></span></div>" +
              series(run, c[0]).map(function (g) {
                var v = run.curves[pos][c[0]][g[0]];
                return '<div class="lrow"><span class="lname">  ' + esc(g[1]) + '</span><span class="lcells" style="--c:var(' + g[2] + ')">' +
                  v.map(function (x, j) {
                    return '<span' + (j === v.length - 1 ? ' class="out"' : "") + '><i style="height:' + x + '%"></i></span>';
                  }).join("") + "</span></div>";
              }).join("") + "</div>";
          }).join("") + "</div></div>";
      }).join("");

      table.innerHTML = "<table><thead><tr><th>Run, concept, group</th>" +
        PICK.map(function (l) { return '<th class="num">L' + l + "</th>"; }).join("") + '<th class="num">Out</th></tr></thead><tbody>' +
        runs.map(function (run) {
          if (!run.curves[pos]) return "";
          return cats.map(function (c) {
            return series(run, c[0]).map(function (g) {
              var v = run.curves[pos][c[0]][g[0]];
              return "<tr><td>" + esc(run.label + ", " + c[1] + ", " + g[1]) + "</td>" +
                PICK.map(function (l) { var i = run.layers.indexOf(l); return '<td class="num">' + (i < 0 ? "-" : pct(v[i])) + "</td>"; }).join("") +
                '<td class="num">' + pct(v[v.length - 1]) + "</td></tr>";
            }).join("");
          }).join("");
        }).join("") + "</tbody></table>";
      size();
    }

    function size() { if (view.clientWidth) cw = chWidth(view); }
    function clear() {
      if (sel) sel.block.querySelectorAll(".lcells > .on").forEach(function (s) { s.classList.remove("on"); });
      sel = null;
      hideTip(fig);
    }
    function select(block, j, x, y) {
      var run = runs[+block.dataset.r], c = cats[+block.dataset.c], n = run.layers.length + 1;
      j = Math.max(0, Math.min(n - 1, j));
      clear();
      sel = { block: block, j: j };
      block.querySelectorAll(".lcells").forEach(function (row) { row.children[j].classList.add("on"); });
      var html = "<b>" + esc(c[1]) + ", " + layerName(run, j) + "</b>" + series(run, c[0]).map(function (g) {
        return line(pct(run.curves[pos][c[0]][g[0]][j]), g[1]);
      }).join("<br>");
      if (x === undefined) { var p = center(block.querySelector(".lcells").children[j]); x = p[0]; y = p[1]; }
      showTip(fig, html, x, y);
    }
    function colAt(block, clientX) {
      var cells = block.querySelector(".lcells");
      if (!cells) return -1;
      var n = cells.children.length, i = Math.floor((clientX - cells.getBoundingClientRect().left) / cw);
      if (i >= n - 1) return clientX >= cells.children[n - 1].getBoundingClientRect().left ? n - 1 : n - 2;
      return i;
    }

    view.addEventListener("pointermove", function (e) {
      var block = e.target.closest(".lcat");
      if (!block) { clear(); return; }
      var j = colAt(block, e.clientX);
      if (j < 0) { clear(); return; }
      select(block, j, e.clientX, e.clientY);
    });
    view.addEventListener("pointerleave", clear);
    view.addEventListener("focusin", function (e) {
      var block = e.target.closest(".lcat");
      if (block) select(block, runs[+block.dataset.r].layers.length - 1);
    });
    view.addEventListener("focusout", function (e) { if (!view.contains(e.relatedTarget)) clear(); });
    view.addEventListener("keydown", function (e) {
      var block = e.target.closest(".lcat");
      if (!block || !sel || sel.block !== block) return;
      var j = sel.j, last = runs[+block.dataset.r].layers.length;
      if (e.key === "ArrowLeft") j--;
      else if (e.key === "ArrowRight") j++;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = last;
      else return;
      e.preventDefault();
      select(block, j);
    });

    fig.querySelectorAll("button[data-pos]").forEach(function (b) {
      b.addEventListener("click", function () {
        pos = b.dataset.pos;
        fig.querySelectorAll("button[data-pos]").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
        render();
      });
    });
    wireToggle(fig, size);
    render();
    return size;
  }

  function meters(root) {
    root.querySelectorAll(".meter .bar[data-pct]").forEach(function (bar) {
      var cw = chWidth(bar.parentNode);
      var n = Math.max(6, Math.floor(bar.clientWidth / cw) - 2);
      var pct = Math.max(0, Math.min(100, Number(bar.dataset.pct)));
      var filled = Math.round(n * pct / 100);
      bar.innerHTML = "[" + "#".repeat(filled) + '<span class="empty">' + ".".repeat(n - filled) + "</span>]";
    });
  }

  var TYPES = { bars: bars, trend: trend, sparklines: sparklines, layers: layers };
  var redraws = [];

  function render(fig) {
    var type = fig.dataset.chart, fn = TYPES[type];
    if (!fn) return;
    var src = fig.querySelector('script[type="application/json"]');
    var data = fig._gridData || (src ? JSON.parse(src.textContent) : {});
    fig._gridData = data;
    var redraw = fn(fig, data);
    redraws.push(redraw);
    redraw();
  }

  function redrawAll() {
    redraws.forEach(function (f) { f(); });
    meters(document);
  }

  function init(root) {
    root = root || document;
    root.querySelectorAll("figure[data-chart]").forEach(render);
    meters(root);
  }

  var t;
  function soon() { clearTimeout(t); t = setTimeout(redrawAll, 60); }

  window.GridCharts = { init: init, render: render, redraw: redrawAll };

  function boot() {
    init(document);
    window.addEventListener("resize", soon);
    document.addEventListener("gridkit:fontchange", soon);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawAll);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
