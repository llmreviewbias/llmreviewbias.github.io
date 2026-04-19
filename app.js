const formatPercent = (value) => `${Number(value).toFixed(1)}%`;

const titleCase = (value) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const loadJson = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
};

const renderHeroStats = (summary) => {
  const heroStats = document.getElementById("hero-stats");
  heroStats.innerHTML = "";

  [
    `${summary.dimensionCount} dimensions`,
    `${summary.modelCount} models`,
    `${summary.paperCount} papers`,
    `${summary.mainTableRowCount} main-table rows`,
  ].forEach((label) => {
    const chip = document.createElement("span");
    chip.className = "stat-chip";
    chip.textContent = label;
    heroStats.appendChild(chip);
  });
};

const applySiteConfig = (config) => {
  if (config.title) {
    document.title = config.title;
  }

  const githubLink = document.getElementById("github-link");
  if (githubLink && config.codeUrl) {
    githubLink.href = config.codeUrl;
    githubLink.target = "_blank";
    githubLink.rel = "noreferrer";
  }
};

const createSimpleTable = (headers, rows) => {
  const table = document.createElement("table");
  table.className = "simple-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  return table;
};

const renderGenderSection = (gender) => {
  const authorsRoot = document.getElementById("gender-authors");
  authorsRoot.innerHTML = "";

  const maleCard = document.createElement("div");
  maleCard.innerHTML = `<h4>Male authors</h4>`;
  maleCard.appendChild(
    createSimpleTable(["Name"], gender.maleAuthors.map((name) => [name]))
  );

  const femaleCard = document.createElement("div");
  femaleCard.innerHTML = `<h4>Female authors</h4>`;
  femaleCard.appendChild(
    createSimpleTable(["Name"], gender.femaleAuthors.map((name) => [name]))
  );

  authorsRoot.append(maleCard, femaleCard);

  const affiliationRoot = document.getElementById("gender-affiliations");
  affiliationRoot.innerHTML = "";
  affiliationRoot.appendChild(
    createSimpleTable(
      ["Affiliation", "Country"],
      gender.affiliations.map((entry) => [entry.affiliation, entry.country])
    )
  );
};

const renderChipList = (root, items, formatter) => {
  root.innerHTML = "";
  const list = document.createElement("div");
  list.className = "chip-list";
  items.forEach((item) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = formatter(item);
    list.appendChild(chip);
  });
  root.appendChild(list);
};

const renderAffiliationSection = (affiliation) => {
  renderChipList(
    document.getElementById("ranked-stronger"),
    affiliation.rankedStronger,
    (item) => `${item.university} — ${item.country}`
  );
  renderChipList(
    document.getElementById("ranked-lower"),
    affiliation.rankedLower,
    (item) => `${item.university} — ${item.country}`
  );

  const pairsRoot = document.getElementById("country-author-pairs");
  pairsRoot.innerHTML = "";
  pairsRoot.appendChild(
    createSimpleTable(
      ["Country", "Male author", "Female author"],
      affiliation.countryAuthorPairs.map((item) => [
        item.country,
        item.maleAuthor,
        item.femaleAuthor,
      ])
    )
  );
};

const renderProfileCards = (rootId, cards, valueKey, valueLabel) => {
  const root = document.getElementById(rootId);
  root.innerHTML = "";
  cards.forEach((card) => {
    const element = document.createElement("article");
    element.className = "profile-card";
    element.innerHTML = `
      <div class="profile-card__meta">${titleCase(card.affiliationType)}</div>
      <h3>${card.author}</h3>
      <p>${card.affiliation}</p>
      <p><strong>${valueLabel}:</strong> ${card[valueKey]}</p>
    `;
    root.appendChild(element);
  });
};

const renderDownloads = (downloads) => {
  const root = document.getElementById("downloads-grid");
  root.innerHTML = "";
  downloads.forEach((item) => {
    const card = document.createElement("article");
    card.className = "download-card";
    card.innerHTML = `
      <div class="download-card__meta">${item.category}</div>
      <h3>${item.title}</h3>
      <p>${item.filename}</p>
      <a href="${item.url}" target="_blank" rel="noreferrer">Open artifact</a>
    `;
    root.appendChild(card);
  });
};

const buildComparisonCaption = (selectedDimension, selectedLabel, selectedMetric) => {
  const friendly = {
    affiliation: "Ranked stronger vs ranked lower affiliations",
    gender_mit: "Male vs female names at MIT",
    gender_gondar: "Male vs female names at University of Gondar",
  };
  return `${friendly[selectedDimension]} for ${selectedLabel.toLowerCase()} papers using the ${selectedMetric.toLowerCase()} comparison metric.`;
};

const renderComparisonChart = (mainTable) => {
  const dimensionSelect = document.getElementById("dimension-select");
  const labelSelect = document.getElementById("label-select");
  const metricSelect = document.getElementById("metric-select");
  const chart = document.getElementById("comparison-chart");
  const title = document.getElementById("chart-title");
  const caption = document.getElementById("chart-caption");

  const dimensions = [
    { key: "affiliation", label: "Affiliation" },
    { key: "gender_mit", label: "Gender (MIT)" },
    { key: "gender_gondar", label: "Gender (Gondar)" },
  ];

  dimensions.forEach((dimension) => {
    const option = document.createElement("option");
    option.value = dimension.key;
    option.textContent = dimension.label;
    dimensionSelect.appendChild(option);
  });

  ["Accepted", "Rejected"].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    labelSelect.appendChild(option);
  });

  ["Hard", "Soft"].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    metricSelect.appendChild(option);
  });

  metricSelect.value = "Hard";

  const rerender = () => {
    const selectedDimension = dimensionSelect.value;
    const selectedLabel = labelSelect.value;
    const selectedMetric = metricSelect.value;

    const rows = mainTable
      .filter((row) => row.label === selectedLabel && row.metricType === selectedMetric)
      .map((row) => {
        const metric = row[selectedDimension];
        return {
          model: row.model,
          focus: metric.focus,
          contrast: metric.contrast,
          tie: metric.tie,
          focusLabel: metric.focusLabel,
          contrastLabel: metric.contrastLabel,
        };
      })
      .sort((a, b) => b.focus - a.focus);

    title.textContent = `${selectedLabel} · ${selectedMetric}`;
    caption.textContent = buildComparisonCaption(
      selectedDimension,
      selectedLabel,
      selectedMetric
    );
    chart.innerHTML = "";

    rows.forEach((row) => {
      const wrapper = document.createElement("div");
      wrapper.className = "comparison-row";

      const label = document.createElement("div");
      label.className = "comparison-row__label";
      label.textContent = row.model;

      const bar = document.createElement("div");
      bar.className = "stacked-bar";
      const focus = document.createElement("span");
      focus.className = "bar-focus";
      focus.style.width = `${row.focus}%`;
      const contrast = document.createElement("span");
      contrast.className = "bar-contrast";
      contrast.style.width = `${row.contrast}%`;
      const tie = document.createElement("span");
      tie.className = "bar-tie";
      tie.style.width = `${row.tie}%`;
      bar.append(focus, contrast, tie);

      const values = document.createElement("div");
      values.className = "comparison-row__values";
      values.textContent = `${row.focusLabel}: ${formatPercent(row.focus)} · ${row.contrastLabel}: ${formatPercent(row.contrast)} · tie: ${formatPercent(row.tie)}`;

      wrapper.append(label, bar, values);
      chart.appendChild(wrapper);
    });
  };

  dimensionSelect.addEventListener("change", rerender);
  labelSelect.addEventListener("change", rerender);
  metricSelect.addEventListener("change", rerender);
  rerender();
};

const renderRankingChart = (rankings) => {
  const select = document.getElementById("ranking-model-select");
  const chart = document.getElementById("ranking-chart");

  const models = Object.keys(rankings).sort();
  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    select.appendChild(option);
  });

  const rerender = () => {
    const rows = rankings[select.value] || [];
    chart.innerHTML = "";
    rows.forEach((row) => {
      const wrapper = document.createElement("div");
      wrapper.className = "ranking-row";
      wrapper.innerHTML = `
        <div class="ranking-row__rank">${row.rank}</div>
        <div>${row.affiliation}</div>
        <div class="ranking-row__type">${row.type}</div>
        <div class="stacked-bar"><span class="${row.type === "RS" ? "bar-focus" : "bar-contrast"}" style="width:${row.winRate}%"></span></div>
        <div class="ranking-row__value">${formatPercent(row.winRate)}</div>
      `;
      chart.appendChild(wrapper);
    });
  };

  select.addEventListener("change", rerender);
  rerender();
};

const activateReveal = () => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    },
    { threshold: 0.18 }
  );
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
};

const main = async () => {
  const [
    siteConfig,
    summary,
    mainTable,
    gender,
    affiliation,
    seniority,
    publicationHistory,
    rankings,
    downloads,
  ] = await Promise.all([
    loadJson("data/site_config.json"),
    loadJson("data/site_summary.json"),
    loadJson("data/main_table.json"),
    loadJson("data/gender_dimension.json"),
    loadJson("data/affiliation_dimension.json"),
    loadJson("data/seniority_dimension.json"),
    loadJson("data/publication_history_dimension.json"),
    loadJson("data/affiliation_rankings.json"),
    loadJson("data/downloads.json"),
  ]);

  applySiteConfig(siteConfig);
  renderHeroStats(summary);
  renderComparisonChart(mainTable);
  renderGenderSection(gender);
  renderAffiliationSection(affiliation);
  renderProfileCards("seniority-cards", seniority.profiles, "aboutAuthor", "Prompt cue");
  renderProfileCards(
    "publication-history-cards",
    publicationHistory.profiles,
    "authorPublicationHistory",
    "Prompt cue"
  );
  renderRankingChart(rankings);
  renderDownloads(downloads);
  activateReveal();
};

main().catch((error) => {
  console.error(error);
});
