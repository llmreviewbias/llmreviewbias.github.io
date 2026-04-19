/* ──────────────────────────────────────────────
   Justice in Judgment — website app.js
   ────────────────────────────────────────────── */

const MODEL_LABELS = {
  'deepseek-qwen-32b_hf': 'DeepSeek-Qwen-32B',
  'deepseek-r1-8b_hf':    'DeepSeek-R1-8B',
  'gemini_flashlite':     'Gemini Flash Lite',
  'gpt-4o-mini':          'GPT-4o-mini',
  'llama3.1_70b_hf':      'LLaMA 3.1-70B',
  'llama3.1_8b_hf':       'LLaMA 3.1-8B',
  'mistral-small_22b_hf': 'Mistral-Small-22B',
  'mistral_8b_hf':        'Mistral-8B',
  'qwq_hf':               'QwQ'
};

const MODELS = [
  'deepseek-qwen-32b_hf', 'deepseek-r1-8b_hf', 'gemini_flashlite', 'gpt-4o-mini',
  'llama3.1_70b_hf', 'llama3.1_8b_hf', 'mistral-small_22b_hf', 'mistral_8b_hf', 'qwq_hf'
];

let biasData = null;

/* ══════════════════════════════════════════
   Tabs
══════════════════════════════════════════ */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');
    });
  });
}

/* ══════════════════════════════════════════
   Split bar chart (win | tie | lose)
══════════════════════════════════════════ */
function renderSplitBarChart(containerId, data) {
  // data: [{label, win, tie, lose, winLabel, loseLabel}]
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = data.map(d => {
    const winColor  = 'var(--bias-strong)';
    const loseColor = 'var(--bias-female)';
    const tieColor  = 'var(--bias-neutral)';
    const net = Math.round((d.win - d.lose) * 10) / 10;
    const netStr = (net >= 0 ? '+' : '') + net + '%';
    const netColor = net >= 0 ? winColor : loseColor;
    const tooltip   = `${d.winLabel}: ${d.win}% / Tie: ${d.tie}% / ${d.loseLabel}: ${d.lose}%`;
    return `
      <div class="bar-row">
        <div class="bar-label" title="${d.label}">${d.label}</div>
        <div class="bar-track split" title="${tooltip}">
          <div class="bar-fill" style="width:${d.win}%;background:${winColor}" title="${d.winLabel}: ${d.win}%"></div>
          <div class="bar-fill" style="width:${d.tie}%;background:${tieColor}" title="Tie: ${d.tie}%"></div>
          <div class="bar-fill" style="width:${d.lose}%;background:${loseColor}" title="${d.loseLabel}: ${d.lose}%"></div>
        </div>
        <div class="bar-pct" style="color:${netColor}" title="Net bias: ${netStr}">${netStr}</div>
      </div>
    `;
  }).join('');
}

/* ══════════════════════════════════════════
   Gender bar chart (split: male | tie | female)
══════════════════════════════════════════ */
function renderGenderChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = data.map(d => {
    const mPct  = d.pct_male;
    const fPct  = d.pct_female;
    const tiePct = Math.max(0, Math.round(100 - mPct - fPct));
    const net = Math.round((mPct - fPct) * 10) / 10;
    const netStr = (net >= 0 ? '+' : '') + net + '%';
    const netColor = net >= 0 ? 'var(--bias-male)' : 'var(--bias-female)';
    const netLabel = net >= 0 ? '\u2642' : '\u2640';
    return `
      <div class="bar-row">
        <div class="bar-label" title="${d.label}">${d.label}</div>
        <div class="bar-track split"
             title="${mPct}% male-higher / ${tiePct.toFixed(0)}% tied / ${fPct}% female-higher">
          <div class="bar-fill male"   style="width:${mPct}%"></div>
          <div class="bar-fill tie"    style="width:${tiePct}%"></div>
          <div class="bar-fill female" style="width:${fPct}%"></div>
        </div>
        <div class="bar-pct" style="color:${netColor}" title="Net bias: ${netLabel} ${netStr}">${netLabel} ${netStr}</div>
      </div>
    `;
  }).join('');
}

/* ══════════════════════════════════════════
   Heatmap color
══════════════════════════════════════════ */
function heatmapColor(pct) {
  const t = Math.min(pct / 80, 1);
  const r = Math.round(255 + (133 - 255) * t);
  const g = Math.round(251 + (77  - 251) * t);
  const b = Math.round(230 + (14  - 230) * t);
  return { bg: `rgb(${r},${g},${b})`, text: t > 0.45 ? '#ffffff' : '#3d2000' };
}

function renderHeatmap(modelKey) {
  const container = document.getElementById('affiliation-heatmap');
  if (!container || !biasData) return;

  const strongAffs = biasData.affiliation_heatmap.strong_affs;
  const weakAffs   = biasData.affiliation_heatmap.weak_affs;

  const shortLabel = s => s
    .replace('University', 'Univ.')
    .replace('Institute for Intelligent Systems', 'Inst.')
    .replace('Max Planck Inst.', 'MPI')
    .trim();

  const getCellData = (sa, wa) => {
    if (modelKey === 'all') {
      let totalSW = 0, totalWW = 0, totalTies = 0;
      MODELS.forEach(m => {
        const d = biasData.affiliation_heatmap[m] &&
                  biasData.affiliation_heatmap[m][sa] &&
                  biasData.affiliation_heatmap[m][sa][wa];
        if (d) { totalSW += d.sw; totalWW += d.ww; totalTies += d.ties; }
      });
      const total = totalSW + totalWW + totalTies;
      return { pct: total > 0 ? Math.round(totalSW / total * 1000) / 10 : 0, sw: totalSW, total };
    }
    const d = biasData.affiliation_heatmap[modelKey] &&
              biasData.affiliation_heatmap[modelKey][sa] &&
              biasData.affiliation_heatmap[modelKey][sa][wa];
    return d ? { pct: d.pct, sw: d.sw, total: d.total } : { pct: 0, sw: 0, total: 0 };
  };

  let html = '<table class="heatmap-table"><thead><tr><th></th>';
  weakAffs.forEach(wa => {
    html += '<th title="' + wa + '">' + shortLabel(wa) + '</th>';
  });
  html += '</tr></thead><tbody>';

  strongAffs.forEach(sa => {
    html += '<tr><td class="row-header" title="' + sa + '">' + shortLabel(sa) + '</td>';
    weakAffs.forEach(wa => {
      const { pct, sw, total } = getCellData(sa, wa);
      const { bg, text } = heatmapColor(pct);
      const tooltip = shortLabel(sa) + ' vs ' + shortLabel(wa) + ': ' + pct.toFixed(1) + '% (' + sw + '/' + total + ' papers)';
      html += '<td><div class="heatmap-cell" style="background:' + bg + ';color:' + text + '" title="' + tooltip + '">' + pct.toFixed(0) + '%</div></td>';
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function initHeatmapControls() {
  const select = document.getElementById('heatmap-model-select');
  const img    = document.getElementById('heatmap-img');
  if (!select || !img) return;
  select.addEventListener('change', () => {
    img.src = 'images/heatmaps/' + select.value + '_all_llm_rating_top2bot2_netwinsorted-1.png';
    img.alt = 'Affiliation bias heatmap — ' + select.options[select.selectedIndex].text;
  });
}

/* ══════════════════════════════════════════
   BibTeX copy
══════════════════════════════════════════ */
function copyBibtex(btn) {
  const code = document.querySelector('.bibtex-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const icon = btn.querySelector('i');
    icon.className = 'fas fa-check';
    btn.classList.add('copied');
    setTimeout(() => {
      icon.className = 'fas fa-copy';
      btn.classList.remove('copied');
    }, 2000);
  });
}

/* ══════════════════════════════════════════
   Main init
══════════════════════════════════════════ */
async function init() {
  initTabs();
  initHeatmapControls();

  try {
    const resp = await fetch('data/bias_data.json');
    biasData = await resp.json();

    // Affiliation bias — split bar
    const affData = MODELS.map(m => {
      const a = biasData.affiliation[m] || {};
      return { label: MODEL_LABELS[m], win: a.pct_strong_higher||0, tie: a.pct_tie||0, lose: a.pct_weak_higher||0, winLabel:'RS wins', loseLabel:'RW wins' };
    }).sort((a, b) => b.win - a.win);
    renderSplitBarChart('aff-bar-chart', affData);

    // Seniority bias — split bar
    const senData = MODELS.map(m => {
      const s = biasData.seniority[m] || {};
      return { label: MODEL_LABELS[m], win: s.pct_senior_higher||0, tie: s.pct_tie||0, lose: s.pct_junior_higher||0, winLabel:'Senior PI wins', loseLabel:'UG wins' };
    }).sort((a, b) => b.win - a.win);
    renderSplitBarChart('sen-bar-chart', senData);

    // Publication history — split bar
    const pubData = MODELS.map(m => {
      const p = biasData.publication[m] || {};
      return { label: MODEL_LABELS[m], win: p.pct_high_pub_higher||0, tie: p.pct_tie||0, lose: p.pct_low_pub_higher||0, winLabel:'100 TTP wins', loseLabel:'0 TTP wins' };
    }).sort((a, b) => b.win - a.win);
    renderSplitBarChart('pub-bar-chart', pubData);

    // Gender bias chart (split)
    const genData = MODELS.map(m => {
      const d = biasData.gender[m] || {};
      return {
        label: MODEL_LABELS[m],
        pct_male:   d.pct_male_higher   || 0,
        pct_female: d.pct_female_higher || 0
      };
    }).sort((a, b) => {
      const diffB = Math.abs(b.pct_male - b.pct_female);
      const diffA = Math.abs(a.pct_male - a.pct_female);
      return diffB - diffA;
    });
    renderGenderChart('gen-bar-chart', genData);

    // Heatmap is image-based; switching handled by initHeatmapControls()

  } catch (err) {
    console.error('Failed to load bias data:', err);
  }
}

window.addEventListener('DOMContentLoaded', init);
window.copyBibtex = copyBibtex;
