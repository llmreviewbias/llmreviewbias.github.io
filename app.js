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
   Bar chart (standard)
══════════════════════════════════════════ */
function renderBarChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = data.map(d => `
    <div class="bar-row">
      <div class="bar-label" title="${d.label}">${d.label}</div>
      <div class="bar-track">
        <div class="bar-fill ${d.cssClass || 'positive'}"
             style="width:${d.pct.toFixed(1)}%"
             title="${d.pct}%"></div>
      </div>
      <div class="bar-pct">${d.pct}%</div>
    </div>
  `).join('');
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
    const isHeavierMale = mPct >= fPct;
    const winnerPct = Math.max(mPct, fPct);
    const winnerLabel = isHeavierMale ? '\u2642' : '\u2640';
    const winnerColor = isHeavierMale ? 'var(--bias-male)' : 'var(--bias-female)';
    return `
      <div class="bar-row">
        <div class="bar-label" title="${d.label}">${d.label}</div>
        <div class="bar-track split"
             title="${mPct}% male-higher / ${tiePct.toFixed(0)}% tied / ${fPct}% female-higher">
          <div class="bar-fill male"   style="width:${mPct}%"></div>
          <div class="bar-fill tie"    style="width:${tiePct}%"></div>
          <div class="bar-fill female" style="width:${fPct}%"></div>
        </div>
        <div class="bar-pct" style="color:${winnerColor}">${winnerLabel} ${winnerPct}%</div>
      </div>
    `;
  }).join('');
}

/* ══════════════════════════════════════════
   Heatmap color
══════════════════════════════════════════ */
function heatmapColor(pct) {
  const t = Math.min(pct / 80, 1);
  const r = Math.round(219 + (67  - 219) * t);
  const g = Math.round(228 + (97  - 228) * t);
  const b = Math.round(255 + (238 - 255) * t);
  return { bg: `rgb(${r},${g},${b})`, text: t > 0.5 ? '#ffffff' : '#1a1a2e' };
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
    img.src = 'images/heatmaps/' + select.value + '-1.png';
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

    // Affiliation bias bar chart
    const affData = MODELS.map(m => ({
      label: MODEL_LABELS[m],
      pct: (biasData.affiliation[m] && biasData.affiliation[m].pct_strong_higher) || 0,
      cssClass: 'positive'
    })).sort((a, b) => b.pct - a.pct);
    renderBarChart('aff-bar-chart', affData);

    // Seniority bias bar chart
    const senData = MODELS.map(m => ({
      label: MODEL_LABELS[m],
      pct: (biasData.seniority[m] && biasData.seniority[m].pct_senior_higher) || 0,
      cssClass: 'positive'
    })).sort((a, b) => b.pct - a.pct);
    renderBarChart('sen-bar-chart', senData);

    // Publication history bar chart
    const pubData = MODELS.map(m => ({
      label: MODEL_LABELS[m],
      pct: (biasData.publication[m] && biasData.publication[m].pct_high_pub_higher) || 0,
      cssClass: 'positive'
    })).sort((a, b) => b.pct - a.pct);
    renderBarChart('pub-bar-chart', pubData);

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
