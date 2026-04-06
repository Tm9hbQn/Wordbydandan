/* =============================================
   Vocabulary Analysis Charts - Wordbydandan
   CDI-based categories (MacArthur-Bates standard)
   ============================================= */
(function () {
  'use strict';

  var vocabData = [];

  // Site palette
  var COLORS = {
    purple: '#6C5CE7',
    pink: '#FF6B9D',
    teal: '#4ECDC4',
    yellow: '#FFD93D',
    coral: '#FF8A80',
    lavender: '#F3E5F5',
    deepPurple: '#2D1B69',
    bg: '#FFF9FB',
  };

  // CDI-based main categories (MacArthur-Bates Communicative Development Inventories)
  // Charts display MAIN categories, not sub-categories
  var CAT_COLORS = {
    general_nominals: '#6C5CE7',
    specific_nominals: '#FF6B9D',
    action_words: '#4DD0E1',
    modifiers: '#FFD93D',
    personal_social: '#CE93D8',
    unclear: '#B0BEC5',
  };
  var CAT_LABELS = {
    general_nominals: 'שמות עצם כלליים',
    specific_nominals: 'שמות עצם ספציפיים',
    action_words: 'מילות פעולה',
    modifiers: 'מתארים',
    personal_social: 'אינטראקציה וחברה',
    unclear: 'לא ברור',
  };
  var CAT_ORDER = [
    'general_nominals', 'specific_nominals', 'personal_social',
    'action_words', 'modifiers'
  ];


  // Baby's current age
  var BABY_MAX_AGE = 16; // months (as of April 2026)

  // ==========================================
  // DATA HELPERS
  // ==========================================
  function getWordsUpTo(maxAge) {
    return vocabData.filter(function (w) { return w.age_in_months <= maxAge; });
  }

  function getCategories(words) {
    var cats = {};
    words.forEach(function (w) {
      if (w.cdi_category === 'unclear') return;
      if (!cats[w.cdi_category]) cats[w.cdi_category] = [];
      cats[w.cdi_category].push(w);
    });
    return cats;
  }


  function getAgeRange() {
    if (!vocabData.length) return { min: 10, max: BABY_MAX_AGE };
    var ages = vocabData.map(function (w) { return w.age_in_months; });
    return { min: Math.min.apply(null, ages), max: Math.min(Math.max.apply(null, ages), BABY_MAX_AGE) };
  }

  function ageToHebrew(m) {
    if (m < 12) return m + ' חודשים';
    var y = Math.floor(m / 12);
    var r = m % 12;
    if (r === 0) return y === 1 ? 'שנה' : y + ' שנים';
    return (y === 1 ? 'שנה' : y + ' שנים') + ' ו-' + r + ' חו\'';
  }

  // ==========================================
  // CARD BUILDER
  // ==========================================
  function createCard(title, id, hasSlider) {
    var card = document.createElement('div');
    card.className = 'vocab-card';
    var h = '<h3 class="vocab-card-title">' + title + '</h3>';
    h += '<div class="vocab-chart-wrap"><canvas id="' + id + '"></canvas></div>';
    if (hasSlider !== false) {
      h += '<div class="vocab-slider-row">' +
        '<span class="vocab-slider-label" id="' + id + 'Lbl"></span>' +
        '<input type="range" class="vocab-slider" id="' + id + 'Sld">' +
        '</div>';
    }
    h += '<div class="vocab-tooltip-area" id="' + id + 'Tip"></div>';
    h += '<div class="vocab-legend" id="' + id + 'Leg"></div>';
    card.innerHTML = h;
    return card;
  }

  function setupSlider(id, range, onUpdate) {
    var sld = document.getElementById(id + 'Sld');
    var lbl = document.getElementById(id + 'Lbl');
    if (!sld) return;
    sld.min = range.min;
    sld.max = range.max;
    sld.step = 1;
    sld.value = range.max;
    function upd() {
      var v = parseInt(sld.value);
      lbl.textContent = ageToHebrew(v);
      onUpdate(v);
    }
    sld.addEventListener('input', upd);
    upd();
  }

  function buildLegend(id, items) {
    var el = document.getElementById(id + 'Leg');
    if (!el) return;
    el.innerHTML = '';
    items.forEach(function (item) {
      var s = document.createElement('span');
      s.className = 'vocab-legend-item';
      s.innerHTML = '<span class="vocab-legend-dot" style="background:' + item.color + '"></span>' + item.label;
      el.appendChild(s);
    });
  }

  // Helper: build category breakdown HTML
  function buildCategoryBreakdownHTML(maxAge, highlightMonth) {
    var words = getWordsUpTo(maxAge);
    var cats = getCategories(words);
    var total = words.filter(function (w) { return w.cdi_category !== 'unclear'; }).length;

    var html = '<div class="vocab-tip-card">';
    if (highlightMonth !== undefined) {
      var monthWords = getWordsUpTo(highlightMonth);
      var monthCats = getCategories(monthWords);
      var monthTotal = monthWords.filter(function (w) { return w.cdi_category !== 'unclear'; }).length;
      html += '<div class="vocab-tip-title">עד גיל ' + ageToHebrew(highlightMonth) + ' — ' + monthTotal + ' מילים</div>';
      cats = monthCats;
      total = monthTotal;
    } else {
      html += '<div class="vocab-tip-title">עד גיל ' + ageToHebrew(maxAge) + ' — ' + total + ' מילים</div>';
    }

    CAT_ORDER.forEach(function (c) {
      var list = cats[c] || [];
      if (!list.length) return;
      var pct = total > 0 ? Math.round((list.length / total) * 100) : 0;
      var examples = list.slice(-3).map(function (w) { return w.word; }).join(', ');
      html += '<div class="vocab-tip-row"><span class="vocab-legend-dot" style="background:' + CAT_COLORS[c] + '"></span>' +
        CAT_LABELS[c] + ': <strong>' + list.length + '</strong> (' + pct + '%) <span class="vocab-tip-ex">(' + examples + ')</span></div>';
    });
    html += '</div>';
    return html;
  }

  // ==========================================
  // CHART 1: STACKED BARS (category evolution)
  // ==========================================
  function drawStackedBars(canvasId, maxAge) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var W = canvas.parentElement.offsetWidth;
    var H = 280;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var PAD = { top: 12, right: 12, bottom: 36, left: 38 };
    var cW = W - PAD.left - PAD.right;
    var cH = H - PAD.top - PAD.bottom;
    var range = getAgeRange();

    // Build data per month
    var months = [];
    for (var m = range.min; m <= Math.min(maxAge, range.max); m++) months.push(m);

    var maxTotal = 0;
    var monthData = months.map(function (m) {
      var words = getWordsUpTo(m);
      var cats = getCategories(words);
      var row = { month: m };
      var total = 0;
      CAT_ORDER.forEach(function (c) {
        row[c] = (cats[c] || []).length;
        total += row[c];
      });
      row.total = total;
      if (total > maxTotal) maxTotal = total;
      return row;
    });

    if (!months.length) return;

    var barW = Math.max(8, Math.min(36, (cW / months.length) - 4));
    var gap = (cW - barW * months.length) / (months.length + 1);
    var yMax = Math.ceil(maxTotal / 5) * 5 || 5;

    function yPos(v) { return PAD.top + cH - (v / yMax) * cH; }

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(108,92,231,0.08)';
    ctx.lineWidth = 1;
    for (var v = 0; v <= yMax; v += Math.max(1, Math.floor(yMax / 4))) {
      ctx.beginPath();
      ctx.moveTo(PAD.left, yPos(v));
      ctx.lineTo(W - PAD.right, yPos(v));
      ctx.stroke();
      ctx.fillStyle = 'rgba(108,92,231,0.5)';
      ctx.font = '11px Varela Round, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(v, PAD.left - 6, yPos(v) + 4);
    }

    // Bars
    monthData.forEach(function (d, i) {
      var x = PAD.left + gap + i * (barW + gap);
      var base = yPos(0);
      var stack = 0;
      CAT_ORDER.forEach(function (c) {
        var count = d[c] || 0;
        if (count === 0) return;
        var barH = (count / yMax) * cH;
        var y = base - (stack / yMax) * cH - barH;
        ctx.fillStyle = CAT_COLORS[c];
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        var r = Math.min(3, barW / 4);
        ctx.moveTo(x, y + r);
        ctx.arcTo(x, y, x + barW, y, r);
        ctx.arcTo(x + barW, y, x + barW, y + barH, r);
        ctx.lineTo(x + barW, y + barH);
        ctx.lineTo(x, y + barH);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        stack += count;
      });

      // Month label
      ctx.fillStyle = 'rgba(108,92,231,0.6)';
      ctx.font = '10px Varela Round, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.month + 'ח\'', x + barW / 2, H - PAD.bottom + 16);
    });

    // Show default tooltip (full breakdown for current slider value)
    var tipEl = document.getElementById(canvasId + 'Tip');
    if (tipEl) {
      tipEl.innerHTML = buildCategoryBreakdownHTML(maxAge);
    }

    // Touch/click tooltip - updates to show specific month
    canvas.onclick = function (e) {
      var rect = canvas.getBoundingClientRect();
      var mx = (e.clientX - rect.left);
      if (!tipEl) return;

      var closest = -1, minDist = Infinity;
      monthData.forEach(function (d, i) {
        var bx = PAD.left + gap + i * (barW + gap) + barW / 2;
        var dist = Math.abs(mx - bx);
        if (dist < minDist) { minDist = dist; closest = i; }
      });

      if (closest < 0 || minDist > barW * 2) {
        tipEl.innerHTML = buildCategoryBreakdownHTML(maxAge);
        return;
      }
      var d = monthData[closest];
      tipEl.innerHTML = buildCategoryBreakdownHTML(d.month, d.month);
    };
  }

  // ==========================================
  // CHART 2: PROPORTIONAL STACKED BAR (relative %)
  // ==========================================
  var propAnimState = {};

  function drawProportionalBar(canvasId, maxAge) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var W = canvas.parentElement.offsetWidth;
    var H = 320;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var words = getWordsUpTo(maxAge);
    var cats = getCategories(words);
    var total = words.filter(function (w) { return w.cdi_category !== 'unclear'; }).length;

    // Calculate actual percentages from real data
    var actualPcts = {};
    CAT_ORDER.forEach(function (c) {
      actualPcts[c] = total > 0 ? ((cats[c] || []).length / total) * 100 : 0;
    });

    // Determine active categories from ACTUAL data (not animation state)
    var activeCats = CAT_ORDER.filter(function (c) { return (cats[c] || []).length > 0; });

    // Initialize animation state if needed
    if (!propAnimState[canvasId]) {
      propAnimState[canvasId] = {};
      CAT_ORDER.forEach(function (c) { propAnimState[canvasId][c] = actualPcts[c]; });
    }

    // Animate towards target
    var current = propAnimState[canvasId];
    var needsAnim = false;
    CAT_ORDER.forEach(function (c) {
      var diff = actualPcts[c] - current[c];
      if (Math.abs(diff) > 0.1) {
        current[c] += diff * 0.15;
        needsAnim = true;
      } else {
        current[c] = actualPcts[c];
      }
    });

    // Normalize animated values so bar segments always sum to 100%
    var animSum = 0;
    activeCats.forEach(function (c) { animSum += Math.max(0, current[c]); });

    // Drawing
    var PAD = { top: 8, right: 16, bottom: 8, left: 16 };
    var barX = PAD.left;
    var barW = Math.min(80, W * 0.2);
    var barH = H - PAD.top - PAD.bottom;
    var labelX = barX + barW + 16;
    var labelW = W - labelX - PAD.right;

    ctx.clearRect(0, 0, W, H);

    // Draw stacked bar
    var yOffset = PAD.top;

    activeCats.forEach(function (c, i) {
      var segH = animSum > 0 ? (Math.max(0, current[c]) / animSum) * barH : 0;
      if (segH < 1) return;

      ctx.fillStyle = CAT_COLORS[c];
      ctx.globalAlpha = 0.85;

      // Rounded corners on first and last segments
      var r = 8;
      ctx.beginPath();
      if (i === 0 && i === activeCats.length - 1) {
        // Single segment - all corners rounded
        ctx.moveTo(barX + r, yOffset);
        ctx.arcTo(barX + barW, yOffset, barX + barW, yOffset + segH, r);
        ctx.arcTo(barX + barW, yOffset + segH, barX, yOffset + segH, r);
        ctx.arcTo(barX, yOffset + segH, barX, yOffset, r);
        ctx.arcTo(barX, yOffset, barX + barW, yOffset, r);
      } else if (i === 0) {
        ctx.moveTo(barX + r, yOffset);
        ctx.arcTo(barX + barW, yOffset, barX + barW, yOffset + segH, r);
        ctx.lineTo(barX + barW, yOffset + segH);
        ctx.lineTo(barX, yOffset + segH);
        ctx.arcTo(barX, yOffset, barX + barW, yOffset, r);
      } else if (i === activeCats.length - 1) {
        ctx.moveTo(barX, yOffset);
        ctx.lineTo(barX + barW, yOffset);
        ctx.arcTo(barX + barW, yOffset + segH, barX, yOffset + segH, r);
        ctx.arcTo(barX, yOffset + segH, barX, yOffset, r);
        ctx.lineTo(barX, yOffset);
      } else {
        ctx.rect(barX, yOffset, barW, segH);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Percentage text inside bar if segment is tall enough (use ACTUAL percentage)
      if (segH > 20) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Secular One, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(actualPcts[c]) + '%', barX + barW / 2, yOffset + segH / 2);
      }

      yOffset += segH;
    });

    // Draw labels on the right side — dot RIGHT NEXT to label text (RTL: dot is to the right)
    var labelYStart = PAD.top;
    var labelSpacing = barH / Math.max(activeCats.length, 1);
    yOffset = PAD.top;

    activeCats.forEach(function (c, i) {
      var segH = animSum > 0 ? (Math.max(0, current[c]) / animSum) * barH : 0;
      var segMid = yOffset + segH / 2;
      var labelY = labelYStart + i * labelSpacing + labelSpacing / 2;

      // Connecting line from bar to label area
      ctx.strokeStyle = CAT_COLORS[c];
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(barX + barW + 4, segMid);
      ctx.lineTo(labelX - 4, labelY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Category label text (RTL: text drawn from right edge)
      var textRight = W - PAD.right;
      ctx.fillStyle = COLORS.deepPurple;
      ctx.font = '13px Secular One, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(CAT_LABELS[c], textRight, labelY - 8);

      // Measure text width to place dot immediately to its right
      var textW = ctx.measureText(CAT_LABELS[c]).width;
      var dotX = textRight + 8;

      // Color dot — right of the text
      ctx.beginPath();
      ctx.arc(dotX, labelY - 8, 5, 0, Math.PI * 2);
      ctx.fillStyle = CAT_COLORS[c];
      ctx.fill();

      // Count and percentage below label (use ACTUAL data, not animated values)
      var countText = (cats[c] || []).length;
      var pctText = Math.round(actualPcts[c]) + '%';
      ctx.fillStyle = COLORS.purple;
      ctx.font = '11px Varela Round, sans-serif';
      ctx.fillText(countText + ' מילים · ' + pctText, textRight, labelY + 10);

      yOffset += segH;
    });

    if (needsAnim) {
      requestAnimationFrame(function () {
        drawProportionalBar(canvasId, maxAge);
      });
    }
  }

  // ==========================================
  // CHART 2b: STACKED WAVE (same data as proportional, over time)
  // ==========================================
  var waveAnimFrame = null;

  function drawStackedWave(canvasId, card) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var W = canvas.parentElement.offsetWidth;
    var H = 320;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var range = getAgeRange();
    var PAD = { top: 16, right: 12, bottom: 36, left: 38 };
    var cW = W - PAD.left - PAD.right;
    var cH = H - PAD.top - PAD.bottom;

    // Build data per month
    var months = [];
    for (var m = range.min; m <= range.max; m++) months.push(m);
    if (!months.length) return;

    var monthData = months.map(function (m) {
      var ws = getWordsUpTo(m);
      var cats = getCategories(ws);
      var row = { month: m, total: 0 };
      CAT_ORDER.forEach(function (c) {
        row[c] = (cats[c] || []).length;
        row.total += row[c];
      });
      return row;
    });

    var maxTotal = Math.max.apply(null, monthData.map(function (d) { return d.total || 1; }));

    function xPos(i) { return PAD.left + (i / Math.max(months.length - 1, 1)) * cW; }
    function yPos(v) { return PAD.top + cH - (v / maxTotal) * cH; }

    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(108,92,231,0.08)';
    ctx.lineWidth = 1;
    for (var v = 0; v <= maxTotal; v += Math.max(1, Math.ceil(maxTotal / 4))) {
      ctx.beginPath();
      ctx.moveTo(PAD.left, yPos(v));
      ctx.lineTo(W - PAD.right, yPos(v));
      ctx.stroke();
    }

    // Draw stacked areas from bottom, with wavy cubic curves
    var reversedCats = CAT_ORDER.slice().reverse();
    // Compute cumulative stacks
    var stacks = months.map(function () { return 0; });

    reversedCats.forEach(function (c) {
      var topPoints = [];
      var bottomPoints = [];
      monthData.forEach(function (d, i) {
        var bottom = stacks[i];
        var top = bottom + (d[c] || 0);
        bottomPoints.push({ x: xPos(i), y: yPos(bottom) });
        topPoints.push({ x: xPos(i), y: yPos(top) });
        stacks[i] = top;
      });

      ctx.fillStyle = CAT_COLORS[c];
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      // Top edge (left to right) with smooth bezier
      ctx.moveTo(topPoints[0].x, topPoints[0].y);
      for (var i = 1; i < topPoints.length; i++) {
        var cpx = (topPoints[i - 1].x + topPoints[i].x) / 2;
        ctx.bezierCurveTo(cpx, topPoints[i - 1].y, cpx, topPoints[i].y, topPoints[i].x, topPoints[i].y);
      }
      // Bottom edge (right to left)
      for (var j = bottomPoints.length - 1; j >= 0; j--) {
        if (j === bottomPoints.length - 1) {
          ctx.lineTo(bottomPoints[j].x, bottomPoints[j].y);
        } else {
          var cpx2 = (bottomPoints[j + 1].x + bottomPoints[j].x) / 2;
          ctx.bezierCurveTo(cpx2, bottomPoints[j + 1].y, cpx2, bottomPoints[j].y, bottomPoints[j].x, bottomPoints[j].y);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Month labels
    monthData.forEach(function (d, i) {
      var x = xPos(i);
      ctx.fillStyle = 'rgba(108,92,231,0.6)';
      ctx.font = '10px Varela Round, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.month + 'ח\'', x, H - PAD.bottom + 16);
    });

    // Store monthData and geometry on card for click handler
    card._waveMonthData = monthData;
    card._waveXPos = xPos;
    card._wavePAD = PAD;

    // Click handler — show category info for closest month
    canvas.onclick = function (e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var closest = -1, minDist = Infinity;
      monthData.forEach(function (d, i) {
        var dist = Math.abs(mx - xPos(i));
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      var infoEl = document.getElementById(canvasId + 'WaveInfo');
      if (closest < 0 || !infoEl) return;
      var d = monthData[closest];
      var html = '<strong>' + ageToHebrew(d.month) + '</strong> — ' + d.total + ' מילים<br>';
      CAT_ORDER.forEach(function (c) {
        var cnt = d[c] || 0;
        if (!cnt) return;
        var pct = d.total > 0 ? Math.round((cnt / d.total) * 100) : 0;
        html += '<span class="vocab-legend-dot" style="background:' + CAT_COLORS[c] + ';display:inline-block;width:8px;height:8px;border-radius:50%;margin-left:4px;"></span> ' + CAT_LABELS[c] + ': ' + cnt + ' (' + pct + '%)<br>';
      });
      infoEl.innerHTML = html;
      infoEl.classList.remove('hidden');
    };
  }

  // ==========================================
  // CHART 3: BUBBLE MAP (CDI main categories)
  // ==========================================
  function drawBubbleMap(canvasId, maxAge) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var W = canvas.parentElement.offsetWidth;
    var H = 320;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    var words = getWordsUpTo(maxAge);
    var cats = getCategories(words);
    var entries = Object.keys(cats).map(function (k) {
      return { key: k, count: cats[k].length, words: cats[k] };
    }).sort(function (a, b) { return b.count - a.count; });

    if (!entries.length) return;
    var maxCount = Math.max.apply(null, entries.map(function (e) { return e.count; }));
    var cx = W / 2, cy = H / 2;
    var maxR = Math.min(W, H) * 0.2;
    var minR = 14;

    // Simple spiral layout
    var placed = [];
    entries.forEach(function (e, i) {
      var r = Math.max(minR, Math.sqrt(e.count / maxCount) * maxR);
      var angle = i * 2.4 + 0.5;
      var dist = i === 0 ? 0 : 50 + i * 28;
      var x = cx + Math.cos(angle) * dist;
      var y = cy + Math.sin(angle) * dist;
      x = Math.max(r + 8, Math.min(W - r - 8, x));
      y = Math.max(r + 8, Math.min(H - r - 8, y));
      placed.push({ x: x, y: y, r: r, entry: e });
    });

    // Draw bubbles
    placed.forEach(function (b) {
      var color = CAT_COLORS[b.entry.key] || '#ccc';
      // Glow
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.12;
      ctx.fill();
      ctx.globalAlpha = 1;
      // Circle
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Label
      ctx.fillStyle = COLORS.deepPurple;
      var labelSize = b.r > 40 ? '13' : (b.r > 25 ? '11' : '9');
      ctx.font = 'bold ' + labelSize + 'px Secular One, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(CAT_LABELS[b.entry.key] || b.entry.key, b.x, b.y - 3);
      var countSize = b.r > 40 ? '16' : (b.r > 25 ? '13' : '10');
      ctx.font = 'bold ' + countSize + 'px Secular One, sans-serif';
      ctx.fillStyle = COLORS.purple;
      ctx.fillText(b.entry.count, b.x, b.y + 14);
    });
  }

  // ==========================================
  // CHART 4: PERIOD COMPARISON
  // ==========================================
  function buildPeriodComparisonCard(container) {
    var range = getAgeRange();
    var card = document.createElement('div');
    card.className = 'vocab-card';
    card.innerHTML = '<h3 class="vocab-card-title">השוואת תקופות</h3>' +
      '<div class="period-compare-selectors">' +
        '<div class="period-select-group"><label>תקופה א׳</label><select class="period-select" id="periodA"></select></div>' +
        '<span class="period-vs">⚡</span>' +
        '<div class="period-select-group"><label>תקופה ב׳</label><select class="period-select" id="periodB"></select></div>' +
      '</div>' +
      '<div class="period-toggle-row">' +
        '<button class="period-toggle-btn active" id="periodCountBtn">כמות</button>' +
        '<button class="period-toggle-btn" id="periodPctBtn">אחוזים</button>' +
      '</div>' +
      '<div class="period-bars-container" id="periodBars"></div>';
    container.appendChild(card);

    var selA = document.getElementById('periodA');
    var selB = document.getElementById('periodB');
    var barsEl = document.getElementById('periodBars');
    var countBtn = document.getElementById('periodCountBtn');
    var pctBtn = document.getElementById('periodPctBtn');
    var showPct = false;

    // Populate selects
    for (var m = range.min; m <= range.max; m++) {
      var optA = document.createElement('option');
      optA.value = m; optA.textContent = ageToHebrew(m);
      selA.appendChild(optA);
      var optB = document.createElement('option');
      optB.value = m; optB.textContent = ageToHebrew(m);
      selB.appendChild(optB);
    }
    // Default: first and last
    selA.value = range.min;
    selB.value = range.max;

    function renderBars() {
      var ageA = parseInt(selA.value);
      var ageB = parseInt(selB.value);
      var wordsA = getWordsUpTo(ageA);
      var wordsB = getWordsUpTo(ageB);
      var catsA = getCategories(wordsA);
      var catsB = getCategories(wordsB);
      var totalA = wordsA.filter(function (w) { return w.cdi_category !== 'unclear'; }).length;
      var totalB = wordsB.filter(function (w) { return w.cdi_category !== 'unclear'; }).length;

      var maxVal = 1;
      CAT_ORDER.forEach(function (c) {
        var vA = showPct ? (totalA > 0 ? ((catsA[c] || []).length / totalA) * 100 : 0) : (catsA[c] || []).length;
        var vB = showPct ? (totalB > 0 ? ((catsB[c] || []).length / totalB) * 100 : 0) : (catsB[c] || []).length;
        if (vA > maxVal) maxVal = vA;
        if (vB > maxVal) maxVal = vB;
      });

      barsEl.innerHTML = '';
      CAT_ORDER.forEach(function (c) {
        var countA = (catsA[c] || []).length;
        var countB = (catsB[c] || []).length;
        var valA = showPct ? (totalA > 0 ? (countA / totalA) * 100 : 0) : countA;
        var valB = showPct ? (totalB > 0 ? (countB / totalB) * 100 : 0) : countB;

        var growthClass = '';
        var growthText = '';
        if (countA > 0) {
          var growth = Math.round(((countB - countA) / countA) * 100);
          growthClass = growth < 0 ? ' negative' : '';
          growthText = (growth >= 0 ? '+' : '') + growth + '%';
        } else if (countB > 0) {
          growthText = 'חדש';
          growthClass = ' new-cat';
        } else {
          growthText = '—';
        }

        var row = document.createElement('div');
        row.className = 'period-bar-row';
        row.innerHTML = '<div class="period-bar-label">' + CAT_LABELS[c] + '</div>' +
          '<div class="period-bar-wrap">' +
            '<div class="period-bar period-bar-a" style="width: 0%"></div>' +
            '<div class="period-bar period-bar-b" style="width: 0%"></div>' +
          '</div>' +
          '<div class="period-growth' + growthClass + '">' + growthText + '</div>';
        barsEl.appendChild(row);

        // Animate bars
        var bars = row.querySelectorAll('.period-bar');
        requestAnimationFrame(function () {
          bars[0].style.width = (maxVal > 0 ? (valA / maxVal) * 45 : 0) + '%';
          bars[1].style.width = (maxVal > 0 ? (valB / maxVal) * 45 : 0) + '%';
        });
      });
    }

    selA.addEventListener('change', renderBars);
    selB.addEventListener('change', renderBars);
    countBtn.addEventListener('click', function () {
      showPct = false;
      countBtn.classList.add('active');
      pctBtn.classList.remove('active');
      renderBars();
    });
    pctBtn.addEventListener('click', function () {
      showPct = true;
      pctBtn.classList.add('active');
      countBtn.classList.remove('active');
      renderBars();
    });

    renderBars();
  }

  // ==========================================
  // MAIN TRENDS CHART ENHANCEMENT
  // ==========================================
  function enhanceMainTrendsChart() {
    var chartContainer = document.getElementById('trendsChart');
    if (!chartContainer) return;
    var existing = chartContainer.querySelector('.trends-chart-title');
    if (!existing) {
      var title = document.createElement('h3');
      title.className = 'trends-chart-title vocab-card-title';
      title.textContent = 'גידול בסך אוצר המילים על פני זמן';
      title.style.marginBottom = '0.5rem';
      chartContainer.insertBefore(title, chartContainer.firstChild);
    }
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    fetch('vocabulary.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        vocabData = data.filter(function (w) { return w.age_in_months <= BABY_MAX_AGE; });
        buildCards();
        enhanceMainTrendsChart();
      })
      .catch(function (err) {
        console.warn('vocabulary.json not loaded:', err);
      });
  }

  function buildCards() {
    var container = document.getElementById('vocabCards');
    if (!container || !vocabData.length) return;
    container.innerHTML = '';

    var range = getAgeRange();
    var activeCats = CAT_ORDER.filter(function (k) {
      return vocabData.some(function (w) { return w.cdi_category === k; });
    });
    var catLegend = activeCats.map(function (k) {
      return { color: CAT_COLORS[k], label: CAT_LABELS[k] };
    });
    var bubbleLegend = activeCats.map(function (k) {
      return { color: CAT_COLORS[k], label: CAT_LABELS[k] };
    });

    // Card 1: Stacked bars (category evolution)
    var c1 = createCard('אבולוציית הקטגוריות', 'vchart1');
    container.appendChild(c1);
    setupSlider('vchart1', range, function (age) { drawStackedBars('vchart1', age); });
    buildLegend('vchart1', catLegend);

    // Card 2: Proportional bar (relative percentages)
    var c2 = createCard('חלוקה יחסית של הקטגוריות', 'vchart2');
    container.appendChild(c2);
    setupSlider('vchart2', range, function (age) {
      propAnimState['vchart2'] = propAnimState['vchart2'] || {};
      drawProportionalBar('vchart2', age);
    });

    // Add wave canvas (hidden initially) and toggle buttons
    var waveWrap = document.createElement('div');
    waveWrap.id = 'vchart2WaveWrap';
    waveWrap.className = 'hidden';
    waveWrap.innerHTML = '<div class="vocab-chart-wrap"><canvas id="vchart2Wave"></canvas></div>' +
      '<div class="wave-info-box hidden" id="vchart2WaveWaveInfo"></div>';
    var waveBackBtn = document.createElement('button');
    waveBackBtn.className = 'wave-toggle-btn';
    waveBackBtn.textContent = 'תַּחְזִיר לִי אֶת הָעַמּוּדָה';
    waveBackBtn.addEventListener('click', function () {
      // Animate back to bar
      waveWrap.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      waveWrap.style.opacity = '0';
      waveWrap.style.transform = 'translateX(-20px)';
      setTimeout(function () {
        waveWrap.classList.add('hidden');
        waveWrap.style.opacity = '';
        waveWrap.style.transform = '';
        // Show bar elements
        var barCanvas = document.getElementById('vchart2').parentElement;
        var slider = document.getElementById('vchart2Sld');
        if (barCanvas) { barCanvas.style.display = ''; barCanvas.style.opacity = '0'; barCanvas.style.transform = 'translateX(20px)'; barCanvas.style.transition = 'opacity 0.5s ease, transform 0.5s ease'; }
        if (slider) slider.parentElement.style.display = '';
        toWaveBtn.classList.remove('hidden');
        waveBackBtn.classList.add('hidden');
        requestAnimationFrame(function () {
          if (barCanvas) { barCanvas.style.opacity = '1'; barCanvas.style.transform = 'translateX(0)'; }
        });
      }, 500);
    });
    waveBackBtn.classList.add('hidden');

    var toWaveBtn = document.createElement('button');
    toWaveBtn.className = 'wave-toggle-btn';
    toWaveBtn.textContent = 'גַּלְגֵּל לִי לְגַל';
    toWaveBtn.addEventListener('click', function () {
      // Animate bar out
      var barCanvas = document.getElementById('vchart2').parentElement;
      var slider = document.getElementById('vchart2Sld');
      if (barCanvas) { barCanvas.style.transition = 'opacity 0.5s ease, transform 0.5s ease'; barCanvas.style.opacity = '0'; barCanvas.style.transform = 'translateX(20px)'; }
      setTimeout(function () {
        if (barCanvas) barCanvas.style.display = 'none';
        if (slider) slider.parentElement.style.display = 'none';
        toWaveBtn.classList.add('hidden');
        // Show wave
        waveWrap.classList.remove('hidden');
        waveWrap.style.opacity = '0';
        waveWrap.style.transform = 'translateX(-20px)';
        waveWrap.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        drawStackedWave('vchart2Wave', c2);
        waveBackBtn.classList.remove('hidden');
        requestAnimationFrame(function () {
          waveWrap.style.opacity = '1';
          waveWrap.style.transform = 'translateX(0)';
        });
      }, 500);
    });

    // Insert elements into card 2
    var tipArea = c2.querySelector('.vocab-tooltip-area');
    if (tipArea) {
      tipArea.parentNode.insertBefore(waveWrap, tipArea);
    } else {
      c2.appendChild(waveWrap);
    }
    c2.appendChild(toWaveBtn);
    c2.appendChild(waveBackBtn);

    // Card 3: Bubble map
    var c3 = createCard('מפת תשומת הלב', 'vchart3');
    container.appendChild(c3);
    setupSlider('vchart3', range, function (age) { drawBubbleMap('vchart3', age); });
    buildLegend('vchart3', bubbleLegend);

    // Card 4: Period comparison
    buildPeriodComparisonCard(container);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 300);
  }
})();
