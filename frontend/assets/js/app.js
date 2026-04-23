function createEmptySlot() {
  return {
    file: null,
    name: "",
    marketCode: "",
    marketName: "",
    done: false,
    cols: [],
    previewRows: [],
    previewHeaders: [],
    editedCells: {},
    downloadPath: "",
    uploadId: null,
  };
}

const S = {
  sup: createEmptySlot(),
  tgt: createEmptySlot(),
  ready: false,
  sessionId: null,
  user: null,
  markets: [],
  activePreviewKey: null,
};

window.addEventListener("load", async () => {
  bindUiEvents();

  try {
    await loadMarkets();
  } catch (error) {
    console.error(error);
    setTimeout(() => toast("Backend is not ready. Start the API first.", "err"), 2600);
  }

  setTimeout(() => {
    const loadingScreen = document.getElementById("loading-screen");
    loadingScreen.classList.add("hide");
    setTimeout(() => {
      loadingScreen.style.display = "none";
      document.getElementById("login-screen").classList.add("active");
    }, 400);
  }, 1200);
});

function bindUiEvents() {
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      document.getElementById("login-screen").classList.contains("active")
    ) {
      doLogin();
    }
  });

  ["sup", "tgt"].forEach((key) => {
    const dropZone = document.getElementById(key + "-dz");
    dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropZone.classList.add("over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"));
    dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropZone.classList.remove("over");
      const file = event.dataTransfer.files[0];
      if (!file || !isSupportedFile(file.name)) {
        toast("Only CSV and XLSX files are supported.", "err");
        return;
      }
      assignFileToSlot(key, file);
    });
  });

  document.getElementById("sb-cname").addEventListener("change", applySelectionFromName);
  document.getElementById("sh-body").addEventListener("input", handleSheetInput);
  document.getElementById("sh-body").addEventListener("click", handleSheetCellClick);
  document.getElementById("sh-body").addEventListener("keydown", handleSheetKeyDown);
  document.addEventListener("click", handleDeleteColumnClick);
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : payload.detail || payload.message || "Request failed.";
    throw new Error(message);
  }

  return payload;
}

async function loadMarkets() {
  const markets = await apiFetch("/api/v1/markets");
  S.markets = markets;
  populateMarketSelect("sup-mkt");
  populateMarketSelect("tgt-mkt");
}

function populateMarketSelect(selectId) {
  const select = document.getElementById(selectId);
  const options = ['<option value="">-- Select --</option>']
    .concat(
      S.markets.map(
        (market) =>
          `<option value="${escapeHtml(market.code)}">${escapeHtml(market.name)}</option>`
      )
    )
    .join("");
  select.innerHTML = options;
}

function onFile(key) {
  const input = document.getElementById(key + "-file");
  if (!input.files.length) {
    return;
  }

  const file = input.files[0];
  if (!isSupportedFile(file.name)) {
    toast("Only CSV and XLSX files are supported.", "err");
    input.value = "";
    return;
  }

  assignFileToSlot(key, file);
}

function assignFileToSlot(key, file) {
  S[key].file = file;
  S[key].name = file.name;
  const nameField = document.getElementById(key + "-fn");
  nameField.textContent = file.name;
  nameField.classList.remove("empty");
  setStatus(key, "", "");
}

async function doLogin() {
  const usernameOrEmail = document.getElementById("lu").value.trim();
  const password = document.getElementById("lp").value;
  const errorText = document.getElementById("lg-err");
  const button = document.getElementById("lg-btn");
  const buttonText = document.getElementById("lg-btxt");
  const spinner = document.getElementById("lg-spin");

  errorText.style.display = "none";
  button.disabled = true;
  buttonText.textContent = "Signing in...";
  spinner.style.display = "block";

  try {
    const response = await apiFetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username_or_email: usernameOrEmail,
        password,
      }),
    });

    S.user = response.user;
    document.getElementById("hdr-un").textContent = response.user.username;
    document.getElementById("hdr-av").textContent = response.user.username
      .slice(0, 2)
      .toUpperCase();
    document.getElementById("login-screen").classList.remove("active");
    document.getElementById("app").classList.add("active");
    toast("Welcome back, " + response.user.username + "!", "ok");
  } catch (error) {
    errorText.textContent = error.message || "Incorrect credentials. Please try again.";
    errorText.style.display = "block";
  } finally {
    button.disabled = false;
    buttonText.textContent = "Sign in";
    spinner.style.display = "none";
  }
}

function doLogout() {
  document.getElementById("app").classList.remove("active");
  document.getElementById("login-screen").classList.add("active");
  document.getElementById("lu").value = "";
  document.getElementById("lp").value = "";
  document.getElementById("lg-err").style.display = "none";
  document.getElementById("lg-btn").disabled = false;
  document.getElementById("lg-btxt").textContent = "Sign in";
  document.getElementById("lg-spin").style.display = "none";
  S.user = null;
  resetWorkflowState();
}

async function ensureSession() {
  if (S.sessionId) {
    return S.sessionId;
  }

  const response = await apiFetch("/api/v1/sessions", { method: "POST" });
  S.sessionId = response.id;
  return S.sessionId;
}

async function doUpload(key) {
  const marketCode = document.getElementById(key + "-mkt").value;
  const slot = S[key];
  if (!slot.file) {
    toast("Please select a CSV or XLSX file first.", "err");
    return;
  }
  if (!marketCode) {
    toast("Please select a market.", "err");
    return;
  }

  const button = document.getElementById(key + "-upbtn");
  const spinner = document.getElementById(key + "-ms");
  const progressWrap = document.getElementById(key + "-pw");
  const progressBar = document.getElementById(key + "-pb");
  const columnListId = key === "sup" ? "cl-sup" : "cl-tgt";
  let progress = 0;
  let progressTimer = null;

  try {
    button.disabled = true;
    spinner.classList.add("on");
    progressWrap.classList.add("show");
    progressBar.style.width = "0";
    setStatus(key, "loading", "Uploading file to backend...");
    skeletonCols(columnListId);
    progressTimer = setInterval(() => {
      progress = Math.min(progress + Math.random() * 18, 92);
      progressBar.style.width = progress + "%";
    }, 120);

    const sessionId = await ensureSession();
    const formData = new FormData();
    formData.append("market_code", marketCode);
    formData.append("file", slot.file);

    const kind = key === "sup" ? "supplier" : "target";
    const response = await apiFetch(`/api/v1/sessions/${sessionId}/uploads/${kind}`, {
      method: "POST",
      body: formData,
    });

    S[key] = {
      ...S[key],
      file: slot.file,
      name: response.filename,
      marketCode: response.market_code,
      marketName: response.market_name,
      done: true,
      cols: response.columns,
      previewHeaders: [...response.preview_headers],
      previewRows: response.preview_rows.map((row) => [...row]),
      editedCells: {},
      downloadPath: response.download_path,
      uploadId: response.upload_id,
    };
    S.activePreviewKey = key;

    if (progressTimer) {
      clearInterval(progressTimer);
    }
    progressBar.style.width = "100%";
    window.setTimeout(() => {
      progressWrap.classList.remove("show");
      progressBar.style.width = "0";
    }, 250);

    document.getElementById(key + "-cl-sub").textContent = response.market_name;
    buildCols(columnListId, response.columns, false, false);
    showFooter(key + "-cf");
    setStatus(
      key,
      "success",
      `${response.total_rows} rows and ${response.total_columns} columns parsed successfully.`
    );

    refreshFileTree();
    applySessionSummary(response.session_summary);
    rebuildSheetControls();
    startSheetLoad();

    if (S.ready) {
      toast("Both files uploaded. Workflow is ready.", "ok");
    } else {
      toast(
        (key === "sup" ? "Supplier" : "Target market") + " file uploaded successfully.",
        "ok"
      );
    }
  } catch (error) {
    if (progressTimer) {
      clearInterval(progressTimer);
    }
    progressWrap.classList.remove("show");
    setStatus(key, "error", error.message || "Upload failed.");
    document.getElementById(columnListId).innerHTML =
      `<div class="cg-empty"><div class="cg-empty-icon">!</div><div class="cg-empty-txt">${escapeHtml(
        error.message || "Upload failed."
      )}</div></div>`;
    toast(error.message || "Upload failed.", "err");
  } finally {
    button.disabled = false;
    spinner.classList.remove("on");
  }
}

function applySessionSummary(summary) {
  const mergedColumns = summary.merged_columns || [];
  S.ready = Boolean(summary.supplier_uploaded && summary.target_uploaded);

  if (mergedColumns.length) {
    buildCols("cl-new", mergedColumns, true, true);
    document.getElementById("new-cl-sub").textContent =
      `${S.sup.marketName || "Supplier"} + ${S.tgt.marketName || "Target"}`;
    showFooter("new-cf");
  } else {
    document.getElementById("cl-new").innerHTML =
      '<div class="cg-empty"><div class="cg-empty-icon">+</div><div class="cg-empty-txt">Upload both CSVs first</div></div>';
    document.getElementById("new-cf").style.display = "none";
    document.getElementById("new-cl-sub").textContent = "--";
  }

  rebuildNameSel(mergedColumns);
  toggleWorkflowControls(S.ready);
  document.getElementById("tr-hint").textContent = S.ready
    ? "Both uploads are ready for translation and saving."
    : "Upload both files to unlock translate and save.";
}

function rebuildNameSel(mergedColumns = getMergedColumns()) {
  const select = document.getElementById("sb-cname");
  if (!mergedColumns.length) {
    select.innerHTML = "<option>--</option>";
    return;
  }

  const current = select.value;
  select.innerHTML = mergedColumns
    .map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`)
    .join("");

  if (mergedColumns.includes(current)) {
    select.value = current;
  }
}

function rebuildSheetControls() {
  const activeData = getActivePreviewData();
  if (!activeData) {
    return;
  }

  const skipRowOne = document.getElementById("no-r1").checked;
  rebuildAlphaOptions(activeData.previewHeaders.length);
  rebuildRowOptions(activeData.previewRows.length + (skipRowOne ? 0 : 1));
}

function rebuildAlphaOptions(columnCount) {
  const select = document.getElementById("sb-alpha");
  const current = select.value;
  const total = Math.max(columnCount, 1);
  select.innerHTML = Array.from({ length: total }, (_, index) => {
    const label = toExcelColumnLabel(index);
    return `<option value="${label}">${label}</option>`;
  }).join("");

  select.value = Array.from(select.options).some((option) => option.value === current)
    ? current
    : "A";
}

function rebuildRowOptions(rowCount) {
  const select = document.getElementById("sb-row");
  const current = select.value;
  const total = Math.max(rowCount, 10);
  select.innerHTML = Array.from({ length: total }, (_, index) => {
    const label = String(index + 1);
    return `<option value="${label}">${label}</option>`;
  }).join("");

  select.value = Array.from(select.options).some((option) => option.value === current)
    ? current
    : "1";
}

function startSheetLoad() {
  const activeData = getActivePreviewData();
  if (!activeData) {
    renderEmptySheet();
    return;
  }

  document.getElementById("sh-empty").style.display = "none";
  document.getElementById("sh-loaded").style.display = "block";
  updateSheet();
}

function updateSheet() {
  const activeData = getActivePreviewData();
  if (!activeData) {
    renderEmptySheet();
    return;
  }

  const skipRowOne = document.getElementById("no-r1").checked;
  rebuildRowOptions(activeData.previewRows.length + (skipRowOne ? 0 : 1));
  buildSheet({
    headers: activeData.previewHeaders,
    rows: activeData.previewRows,
    selectedAlpha: document.getElementById("sb-alpha").value,
    selectedRow: parseInt(document.getElementById("sb-row").value, 10) || 1,
    skipRowOne,
  });
  updateEditBadge();
}

function buildSheet({ headers, rows, selectedAlpha, selectedRow, skipRowOne }) {
  const sheetHead = document.getElementById("sh-head");
  const sheetBody = document.getElementById("sh-body");
  const displayRows = skipRowOne ? rows : [headers, ...rows];
  const columnCount = Math.max(headers.length, ...displayRows.map((row) => row.length), 1);
  const selectedIndex = alphaToIndex(selectedAlpha);
  const totalRows = Math.max(displayRows.length, selectedRow, 10);

  let headHtml = '<tr><th class="rn"></th>';
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const label = toExcelColumnLabel(columnIndex);
    headHtml += `<th class="${columnIndex === selectedIndex ? "hc" : ""}">${label}</th>`;
  }
  headHtml += "</tr>";
  sheetHead.innerHTML = headHtml;

  let bodyHtml = "";
  for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
    const rowNumber = rowIndex + 1;
    const isHighlightedRow = rowNumber === selectedRow;
    const rowValues = displayRows[rowIndex] || [];
    bodyHtml += `<tr class="${isHighlightedRow ? "hr" : ""}"><td class="rn">${rowNumber}</td>`;

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const isSelectedCell = isHighlightedRow && columnIndex === selectedIndex;
      const isSelectedColumn = columnIndex === selectedIndex && !isHighlightedRow;
      const cellValue = rowValues[columnIndex] || "";
      const meta = getDisplayCellMeta(rowIndex, columnIndex, skipRowOne);
      const editKey = buildEditKey(meta.source, meta.rowIndex, columnIndex);
      const isEdited = Boolean(getActivePreviewData().editedCells[editKey]);
      bodyHtml += `<td contenteditable="true" spellcheck="false" class="editable ${
        isSelectedCell ? "sc" : ""
      }${isEdited ? " edited" : ""}" data-source="${meta.source}" data-row-index="${
        meta.rowIndex
      }" data-col-index="${columnIndex}" data-display-row="${rowIndex}" style="${
        isSelectedColumn ? "background:var(--blue-dim);color:var(--blue)" : ""
      }">${escapeHtml(cellValue)}</td>`;
    }

    bodyHtml += "</tr>";
  }

  sheetBody.innerHTML = bodyHtml;
}

function getDisplayCellMeta(displayRowIndex, columnIndex, skipRowOne) {
  if (!skipRowOne && displayRowIndex === 0) {
    return { source: "header", rowIndex: 0, columnIndex };
  }

  return {
    source: "row",
    rowIndex: skipRowOne ? displayRowIndex : displayRowIndex - 1,
    columnIndex,
  };
}

function buildEditKey(source, rowIndex, columnIndex) {
  return `${source}:${rowIndex}:${columnIndex}`;
}

function handleSheetInput(event) {
  const cell = event.target.closest("td.editable");
  const activeData = getActivePreviewData();
  if (!cell || !activeData) {
    return;
  }

  const source = cell.dataset.source;
  const rowIndex = parseInt(cell.dataset.rowIndex, 10);
  const columnIndex = parseInt(cell.dataset.colIndex, 10);
  const value = cell.textContent.replace(/\u00a0/g, " ");

  if (source === "header") {
    ensureColumn(activeData, columnIndex);
    activeData.previewHeaders[columnIndex] = value;
    activeData.cols[columnIndex] = value;
    rebuildNameSel(getMergedColumns());
  } else {
    ensureRow(activeData, rowIndex, columnIndex + 1);
    activeData.previewRows[rowIndex][columnIndex] = value;
  }

  activeData.editedCells[buildEditKey(source, rowIndex, columnIndex)] = true;
  updateEditBadge();
}

function handleSheetCellClick(event) {
  const cell = event.target.closest("td.editable");
  const activeData = getActivePreviewData();
  if (!cell || !activeData) {
    return;
  }

  const columnIndex = parseInt(cell.dataset.colIndex, 10);
  const displayRow = parseInt(cell.dataset.displayRow, 10) + 1;
  const alpha = toExcelColumnLabel(columnIndex);
  document.getElementById("sb-alpha").value = alpha;
  document.getElementById("sb-row").value = String(displayRow);

  const header = activeData.previewHeaders[columnIndex];
  if (header) {
    const columnSelect = document.getElementById("sb-cname");
    const hasOption = Array.from(columnSelect.options).some((option) => option.value === header);
    if (hasOption) {
      columnSelect.value = header;
    }
  }
}

function handleSheetKeyDown(event) {
  if (event.key !== "Enter") {
    return;
  }

  const cell = event.target.closest("td.editable");
  if (!cell) {
    return;
  }

  event.preventDefault();
  const nextRow = parseInt(cell.dataset.displayRow, 10) + (event.shiftKey ? -1 : 1);
  const columnIndex = parseInt(cell.dataset.colIndex, 10);
  const nextCell = document.querySelector(
    `td.editable[data-display-row="${nextRow}"][data-col-index="${columnIndex}"]`
  );
  if (nextCell) {
    nextCell.focus();
  }
}

function ensureColumn(activeData, columnIndex) {
  while (activeData.previewHeaders.length <= columnIndex) {
    activeData.previewHeaders.push(toExcelColumnLabel(activeData.previewHeaders.length));
  }
  while (activeData.cols.length <= columnIndex) {
    activeData.cols.push(activeData.previewHeaders[activeData.cols.length]);
  }
}

function ensureRow(activeData, rowIndex, minColumns) {
  while (activeData.previewRows.length <= rowIndex) {
    activeData.previewRows.push([]);
  }
  while (activeData.previewRows[rowIndex].length < minColumns) {
    activeData.previewRows[rowIndex].push("");
  }
}

function applyCurrentSelection() {
  const activeData = getActivePreviewData();
  if (!activeData) {
    toast("Upload a file before selecting cells.", "err");
    return;
  }

  updateSheet();
  const selectedColumnIndex = alphaToIndex(document.getElementById("sb-alpha").value);
  const selectedRowIndex = (parseInt(document.getElementById("sb-row").value, 10) || 1) - 1;
  const selectedCell = document.querySelector(
    `td.editable[data-display-row="${selectedRowIndex}"][data-col-index="${selectedColumnIndex}"]`
  );

  if (selectedCell) {
    selectedCell.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    selectedCell.focus();
    toast(
      `Selected ${toExcelColumnLabel(selectedColumnIndex)}${selectedRowIndex + 1}. You can edit it now.`,
      "ok"
    );
  }
}

function applySelectionFromName() {
  const activeData = getActivePreviewData();
  if (!activeData) {
    return;
  }

  const selectedName = document.getElementById("sb-cname").value;
  const headerIndex = activeData.previewHeaders.indexOf(selectedName);
  if (headerIndex >= 0) {
    document.getElementById("sb-alpha").value = toExcelColumnLabel(headerIndex);
  }

  updateSheet();
}

async function doTranslate() {
  if (!S.ready || !S.sessionId) {
    toast("Upload both files first.", "err");
    return;
  }

  const language = document.getElementById("sb-lang").value;
  overlay("Translating...", "Sending translate request to backend");

  try {
    const response = await apiFetch(`/api/v1/sessions/${S.sessionId}/translate-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    });
    document.getElementById("tr-hint").textContent = response.message;
    toast(response.message, "ok");
  } catch (error) {
    toast(error.message || "Translation request failed.", "err");
  } finally {
    closeOverlay();
  }
}

async function doSave() {
  if (!S.ready || !S.sessionId) {
    toast("Upload both files first.", "err");
    return;
  }

  overlay("Saving validated data...", "Writing the selected mapping to PostgreSQL");

  try {
    const payload = {
      selected_column_name: document.getElementById("sb-cname").value,
      selected_box: document.getElementById("sb-box").value,
      selected_column_alpha: document.getElementById("sb-alpha").value,
      selected_row: parseInt(document.getElementById("sb-row").value, 10) || 1,
      target_language: document.getElementById("sb-lang").value,
      skip_row_one: document.getElementById("no-r1").checked,
      active_preview_kind: S.activePreviewKey || "supplier",
      edited_headers: getActivePreviewData().previewHeaders,
      edited_preview_rows: getActivePreviewData().previewRows,
      edited_cell_count: Object.keys(getActivePreviewData().editedCells).length,
    };

    const response = await apiFetch(`/api/v1/sessions/${S.sessionId}/selections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const status = document.getElementById("new-cfs");
    status.style.display = "block";
    status.textContent = "Status - selection stored in PostgreSQL";
    toast(response.message, "ok");
  } catch (error) {
    toast(error.message || "Save failed.", "err");
  } finally {
    closeOverlay();
  }
}

function doPrev(key) {
  if (key === "new") {
    if (!S.ready) {
      toast("Upload both files first.", "err");
      return;
    }

    const status = document.getElementById("new-cfs");
    status.style.display = "block";
    status.textContent = "Status - merged preview is shown in the spreadsheet below";
    document.getElementById("new-cfl").style.display = "none";
    document.querySelector(".sheet-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
    toast("Merged preview is ready below.", "ok");
    return;
  }

  const slot = S[key];
  if (!slot.downloadPath) {
    toast("Upload the file first.", "err");
    return;
  }

  const link = document.getElementById(key + "-cfl");
  const label = document.getElementById(key + "-cfn");
  const status = document.getElementById(key + "-cfs");

  link.href = slot.downloadPath;
  link.style.display = "block";
  label.textContent = slot.name;
  status.style.display = "block";
  status.textContent = "Status - backend file is ready to open";
  window.open(slot.downloadPath, "_blank", "noopener");
  toast("Preview link opened for " + slot.name, "ok");
}

function clearUp(key) {
  resetUploadSlot(key);

  if (S.activePreviewKey === key) {
    S.activePreviewKey = S.sup.done ? "sup" : S.tgt.done ? "tgt" : null;
  }

  if (!S.sup.done && !S.tgt.done) {
    S.sessionId = null;
  }

  applySessionSummary({
    supplier_uploaded: S.sup.done,
    target_uploaded: S.tgt.done,
    merged_columns: getMergedColumns(),
  });
  refreshFileTree();
  rebuildSheetControls();
  startSheetLoad();
}

function newSession() {
  resetWorkflowState();
  toast("New session started.", "ok");
}

function resetWorkflowState() {
  S.sup = createEmptySlot();
  S.tgt = createEmptySlot();
  S.ready = false;
  S.sessionId = null;
  S.activePreviewKey = null;

  resetUploadSlot("sup");
  resetUploadSlot("tgt");
  applySessionSummary({
    supplier_uploaded: false,
    target_uploaded: false,
    merged_columns: [],
  });
  renderEmptySheet();
  updateEditBadge();
}

function resetUploadSlot(key) {
  S[key] = createEmptySlot();
  document.getElementById(key + "-file").value = "";
  document.getElementById(key + "-fn").textContent = "No file chosen";
  document.getElementById(key + "-fn").classList.add("empty");
  document.getElementById(key + "-mkt").value = "";
  document.getElementById(key + "-cf").style.display = "none";
  document.getElementById(key + "-cl-sub").textContent = "--";
  document.getElementById(key === "sup" ? "cl-sup" : "cl-tgt").innerHTML =
    `<div class="cg-empty"><div class="cg-empty-icon">+</div><div class="cg-empty-txt">Upload ${
      key === "sup" ? "supplier" : "target market"
    } CSV</div></div>`;
  setStatus(key, "", "");
  refreshFileTree();
}

function refreshFileTree() {
  renderFileTreeItem("sup");
  renderFileTreeItem("tgt");
}

function renderFileTreeItem(key) {
  const container = document.getElementById("ft-" + key);
  const slot = S[key];
  if (!slot.done) {
    container.innerHTML = '<div class="ftree-empty">No files uploaded</div>';
    return;
  }

  const activeClass = S.activePreviewKey === key ? " active" : "";
  container.innerHTML = `<div class="ftree-item${activeClass}" onclick="setActivePreview('${key}')"><span style="font-size:9px;color:var(--text3);width:14px;text-align:center">file</span>${escapeHtml(
    slot.name
  )}</div>`;
}

function setActivePreview(key) {
  if (!S[key].done) {
    return;
  }

  S.activePreviewKey = key;
  refreshFileTree();
  rebuildSheetControls();
  updateSheet();
}

function setStatus(key, type, message) {
  const dot = document.getElementById(key + "-sd");
  const text = document.getElementById(key + "-sm");
  dot.className = "s-dot" + (type ? " " + type : "");
  text.className = "s-msg" + (type ? " " + type : "");
  text.textContent = message;
}

function skeletonCols(elementId) {
  let html = "";
  for (let index = 0; index < 8; index += 1) {
    html +=
      '<div class="sk-item"><div class="sk" style="width:12px;height:12px;border-radius:2px;flex-shrink:0"></div><div class="sk" style="height:11px;flex:1;width:' +
      (55 + Math.floor(Math.random() * 40)) +
      '%"></div></div>';
  }
  document.getElementById(elementId).innerHTML = html;
}

function buildCols(elementId, columns, withDelete, withSelectAll) {
  const container = document.getElementById(elementId);
  let html = "";
  if (withSelectAll) {
    html += '<div class="ci"><input type="checkbox" checked/><span class="ci-label">Select all</span></div>';
  }

  columns.forEach((column, index) => {
    const checked = [0, 1, 2, 3, 4].includes(index) ? "checked" : "";
    html += `<div class="ci"><input type="checkbox" ${checked}/><span class="ci-label" title="${escapeHtml(
      column
    )}">${escapeHtml(column)}</span>${withDelete ? '<span class="del-btn">x</span>' : ""}</div>`;
  });

  container.innerHTML = html;
}

function toggleWorkflowControls(isEnabled) {
  const hasPreview = Boolean(getActivePreviewData());
  [
    "sb-cname",
    "sb-box",
    "sb-alpha",
    "sb-row",
    "sel-btn",
    "no-r1",
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.disabled = !hasPreview;
    }
  });

  ["sb-lang", "tr-btn", "save-btn"].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.disabled = !isEnabled;
    }
  });
}

function getMergedColumns() {
  const merged = [];
  const seen = new Set();
  [S.sup.cols, S.tgt.cols].forEach((columns) => {
    columns.forEach((column) => {
      if (seen.has(column)) {
        return;
      }
      seen.add(column);
      merged.push(column);
    });
  });
  return merged;
}

function getActivePreviewData() {
  if (S.activePreviewKey && S[S.activePreviewKey].done) {
    return S[S.activePreviewKey];
  }
  if (S.sup.done) {
    return S.sup;
  }
  if (S.tgt.done) {
    return S.tgt;
  }
  return null;
}

function showFooter(elementId) {
  const element = document.getElementById(elementId);
  element.style.display = "flex";
  element.style.flexDirection = "column";
  element.style.gap = "6px";
}

function renderEmptySheet() {
  document.getElementById("sh-loaded").style.display = "none";
  const emptyState = document.getElementById("sh-empty");
  emptyState.style.display = "flex";
  emptyState.innerHTML =
    '<div class="se-icon">+</div><div class="se-txt">Upload a Supplier CSV and a Target Market CSV<br>then click <b style="color:var(--text2)">Upload</b> to preview data</div>';
}

function updateEditBadge() {
  const badge = document.getElementById("edit-count");
  if (!badge) {
    return;
  }

  const activeData = getActivePreviewData();
  const editCount = activeData ? Object.keys(activeData.editedCells).length : 0;
  badge.textContent = editCount === 1 ? "1 edit" : `${editCount} edits`;
  badge.classList.toggle("on", editCount > 0);
}

function overlay(label, step) {
  document.getElementById("ov-lbl").textContent = label;
  document.getElementById("ov-step").textContent = step || "";
  document.getElementById("overlay").classList.add("on");
}

function closeOverlay() {
  document.getElementById("overlay").classList.remove("on");
}

let toastTimer;
function toast(message, type) {
  const toastElement = document.getElementById("toast");
  const dot = document.getElementById("td");
  const text = document.getElementById("tmsg");
  text.textContent = message;
  dot.style.background =
    type === "ok" ? "var(--accent)" : type === "err" ? "var(--red)" : "var(--yellow)";
  toastElement.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove("on"), 3200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isSupportedFile(filename) {
  const lowerName = filename.toLowerCase();
  return lowerName.endsWith(".csv") || lowerName.endsWith(".xlsx");
}

function toExcelColumnLabel(index) {
  let current = index + 1;
  let label = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }
  return label;
}

function alphaToIndex(label) {
  return (
    label
      .split("")
      .reduce((total, character) => total * 26 + (character.charCodeAt(0) - 64), 0) - 1
  );
}

function handleDeleteColumnClick(event) {
  if (!event.target.classList.contains("del-btn")) {
    return;
  }

  const item = event.target.closest(".ci");
  item.style.transition = "opacity .2s,transform .2s";
  item.style.opacity = "0";
  item.style.transform = "translateX(8px)";
  setTimeout(() => item.remove(), 200);
}
