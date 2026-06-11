const MODULE_ORDER = [
  "BBY",
  "NATM",
  "电视购物",
  "Shokz",
  "分销",
  "CE（小组的）",
  "跨部门合作帮忙",
  "其他不相关的",
];

const STATUS_ORDER = ["待处理", "等待回复", "已回复", "有风险", "已完成", "仅参考", "未标记"];

const state = {
  query: "",
  module: "全部",
  project: "全部",
  status: "全部",
  date: "",
};

const data = window.EVERYDAY_RECORDS || { records: [], generated_at: "" };
const records = (data.records || []).map((record, index) => ({
  ...record,
  id: record.id || `record-${index}`,
  searchText: [
    record.date,
    record.time,
    record.module,
    record.project,
    record.status,
    record.concise,
    record.original,
  ].join(" ").toLowerCase(),
}));

const $ = (id) => document.getElementById(id);

function byDateDesc(a, b) {
  const left = `${a.date || ""} ${a.time || ""}`;
  const right = `${b.date || ""} ${b.time || ""}`;
  return right.localeCompare(left);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function orderedModules(items) {
  const known = MODULE_ORDER.filter((module) => items.includes(module));
  const unknown = items.filter((module) => !MODULE_ORDER.includes(module)).sort();
  return [...known, ...unknown];
}

function fillSelect(select, values, current = "全部") {
  select.innerHTML = "";
  for (const value of ["全部", ...values]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    if (value === current) option.selected = true;
    select.append(option);
  }
}

function formatDateTime(record) {
  return [record.date, record.time].filter(Boolean).join(" ");
}

function escapeText(text) {
  return String(text || "");
}

function statusLabel(record) {
  return record.status || "未标记";
}

function filteredRecords() {
  const query = state.query.trim().toLowerCase();
  return records.filter((record) => {
    if (query && !record.searchText.includes(query)) return false;
    if (state.module !== "全部" && record.module !== state.module) return false;
    if (state.project !== "全部" && record.project !== state.project) return false;
    if (state.status !== "全部" && statusLabel(record) !== state.status) return false;
    if (state.date && record.date !== state.date) return false;
    return true;
  }).sort(byDateDesc);
}

function renderStats(items) {
  const todos = items.filter((record) => ["待处理", "等待回复", "有风险"].includes(statusLabel(record)));
  $("recordCount").textContent = items.length;
  $("todoCount").textContent = todos.length;
  $("projectCount").textContent = unique(items.map((record) => record.project)).length;
  $("moduleCount").textContent = unique(items.map((record) => record.module)).length;
}

function recordCard(record) {
  const article = document.createElement("article");
  article.className = "record-card";
  article.innerHTML = `
    <div class="record-meta">
      <span>${escapeText(formatDateTime(record))}</span>
      <span>${escapeText(record.module)} / ${escapeText(record.project)}</span>
      <span class="status" data-status="${escapeText(statusLabel(record))}">${escapeText(statusLabel(record))}</span>
    </div>
    <p class="summary-text">${escapeText(record.concise)}</p>
  `;
  return article;
}

function renderLatest(items) {
  const list = $("latestList");
  list.innerHTML = "";
  const latestDate = items[0]?.date || "--";
  $("latestDate").textContent = latestDate;
  for (const record of items.filter((item) => item.date === latestDate).slice(0, 6)) {
    list.append(recordCard(record));
  }
  if (!list.children.length) {
    list.innerHTML = `<div class="empty-state">没有符合筛选条件的最新记录。</div>`;
  }
}

function renderProjectTracker(items) {
  const root = $("projectTracker");
  root.innerHTML = "";
  const modules = orderedModules(unique(items.map((record) => record.module)));
  for (const module of modules) {
    const moduleItems = items.filter((record) => record.module === module);
    const band = document.createElement("section");
    band.className = "module-band";

    const title = document.createElement("div");
    title.className = "module-title";
    title.innerHTML = `<strong>${escapeText(module)}</strong><span>${moduleItems.length} 条记录</span>`;

    const projects = document.createElement("div");
    projects.className = "project-grid";
    for (const project of unique(moduleItems.map((record) => record.project)).sort()) {
      const projectItems = moduleItems.filter((record) => record.project === project).sort(byDateDesc);
      const card = document.createElement("article");
      card.className = "project-card";
      card.innerHTML = `
        <div class="project-head">
          <h3>${escapeText(project)}</h3>
          <span>${projectItems.length} 条</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日期 / 时间</th>
                <th>状态</th>
                <th>记录</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      `;
      const tbody = card.querySelector("tbody");
      for (const record of projectItems) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${escapeText(formatDateTime(record))}</td>
          <td><span class="status" data-status="${escapeText(statusLabel(record))}">${escapeText(statusLabel(record))}</span></td>
          <td>
            <p class="summary-text">${escapeText(record.concise)}</p>
            <details>
              <summary>查看原信息</summary>
              <div class="original">${escapeText(record.original)}</div>
            </details>
          </td>
        `;
        tbody.append(row);
      }
      projects.append(card);
    }

    band.append(title, projects);
    root.append(band);
  }
  if (!root.children.length) {
    root.innerHTML = `<div class="empty-state">没有符合筛选条件的项目记录。</div>`;
  }
}

function renderTodos(items) {
  const root = $("todoList");
  root.innerHTML = "";
  const todos = items.filter((record) => ["待处理", "等待回复", "有风险"].includes(statusLabel(record))).slice(0, 24);
  for (const record of todos) {
    const card = document.createElement("article");
    card.className = "todo-card";
    card.innerHTML = `
      <div class="record-meta">
        <span>${escapeText(formatDateTime(record))}</span>
        <span>${escapeText(record.module)} / ${escapeText(record.project)}</span>
        <span class="status" data-status="${escapeText(statusLabel(record))}">${escapeText(statusLabel(record))}</span>
      </div>
      <p class="summary-text">${escapeText(record.concise)}</p>
    `;
    root.append(card);
  }
  if (!root.children.length) {
    root.innerHTML = `<div class="empty-state">当前筛选下没有待办或风险。</div>`;
  }
}

function renderTimeline(items) {
  const root = $("timeline");
  root.innerHTML = "";
  for (const record of items.slice(0, 120)) {
    root.append(recordCard(record));
  }
  if (!root.children.length) {
    root.innerHTML = `<div class="empty-state">没有符合筛选条件的记录。</div>`;
  }
}

function render() {
  const items = filteredRecords();
  renderStats(items);
  renderLatest(items);
  renderProjectTracker(items);
  renderTodos(items);
  renderTimeline(items);
}

function setupFilters() {
  fillSelect($("moduleFilter"), orderedModules(unique(records.map((record) => record.module))));
  fillSelect($("projectFilter"), unique(records.map((record) => record.project)).sort());
  fillSelect($("statusFilter"), STATUS_ORDER.filter((status) => records.some((record) => statusLabel(record) === status)));

  $("searchInput").addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });
  $("moduleFilter").addEventListener("change", (event) => {
    state.module = event.target.value;
    const scoped = state.module === "全部" ? records : records.filter((record) => record.module === state.module);
    fillSelect($("projectFilter"), unique(scoped.map((record) => record.project)).sort(), "全部");
    state.project = "全部";
    render();
  });
  $("projectFilter").addEventListener("change", (event) => {
    state.project = event.target.value;
    render();
  });
  $("statusFilter").addEventListener("change", (event) => {
    state.status = event.target.value;
    render();
  });
  $("dateFilter").addEventListener("change", (event) => {
    state.date = event.target.value;
    render();
  });
  $("resetFilters").addEventListener("click", () => {
    state.query = "";
    state.module = "全部";
    state.project = "全部";
    state.status = "全部";
    state.date = "";
    $("searchInput").value = "";
    $("dateFilter").value = "";
    fillSelect($("moduleFilter"), orderedModules(unique(records.map((record) => record.module))));
    fillSelect($("projectFilter"), unique(records.map((record) => record.project)).sort());
    fillSelect($("statusFilter"), STATUS_ORDER.filter((status) => records.some((record) => statusLabel(record) === status)));
    render();
  });
}

function initMeta() {
  const dates = unique(records.map((record) => record.date)).sort();
  $("dateRange").textContent = dates.length ? `${dates[0]} 至 ${dates[dates.length - 1]}` : "暂无数据";
  $("updatedAt").textContent = data.generated_at ? `更新于 ${data.generated_at}` : "数据已载入";
}

setupFilters();
initMeta();
render();
