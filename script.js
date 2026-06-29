const storageKey = "jax_learning_tracker_records";
const legacyStorageKeys = ["jax-learning-tracker-records"];

const form = document.querySelector("#recordForm");
const recordsList = document.querySelector("#recordsList");
const recordCount = document.querySelector("#recordCount");
const exportBtn = document.querySelector("#exportBtn");
const importInput = document.querySelector("#importInput");
const clearBtn = document.querySelector("#clearBtn");
const resetFormBtns = [document.querySelector("#resetFormBtn"), document.querySelector("#bottomResetFormBtn")];
const formMessage = document.querySelector("#formMessage");
const dateInput = document.querySelector("#date");

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateKey(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  const match = rawValue.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return rawValue;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(dateKey) {
  return normalizeDateKey(dateKey).replaceAll("-", "/");
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStoredRecords(key) {
  const rawRecords = localStorage.getItem(key);
  if (!rawRecords) return [];

  try {
    const parsedRecords = JSON.parse(rawRecords);
    return Array.isArray(parsedRecords) ? parsedRecords : [];
  } catch (error) {
    console.warn(`读取 ${key} 失败，已忽略坏数据。`, error);
    return [];
  }
}

function getLegacyDuration(record) {
  if (record.durationMinutes === 0 || record.durationMinutes) {
    return String(record.durationMinutes).trim();
  }

  const hours = Number(record.hours);
  return Number.isFinite(hours) && hours > 0 ? String(Math.round(hours * 60)) : "";
}

function getLegacyLearningContent(record) {
  return [
    record.learningContent,
    record.learnedToday,
    record.aiTask,
    record.aiLearning,
    record.videoTask,
    record.editingTask,
    record.editingLearning,
    record.automationTask,
    record.feedback,
    record.notes,
  ]
    .filter((value) => String(value || "").trim())
    .map((value) => String(value).trim())
    .join("\n\n");
}

function getBooleanValue(value) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

function calculateLearningScore(record) {
  const duration = Number(record.durationMinutes);
  const durationScore = Number.isFinite(duration) && duration > 0 ? Math.min(25, Math.round((duration / 120) * 25)) : 0;
  const taskScore =
    (getBooleanValue(record.aiProgrammingDone) ? 25 : 0) +
    (getBooleanValue(record.videoMaterialDone) ? 25 : 0) +
    (getBooleanValue(record.reviewNotesDone) ? 25 : 0);

  return Math.min(100, durationScore + taskScore);
}

function getScoreJudgement(score) {
  if (score >= 85) return "高质量学习日";
  if (score >= 70) return "稳定推进";
  if (score >= 50) return "有进展";
  if (score > 0) return "轻量学习";
  return "待开始";
}

function buildScoreSummary(record) {
  const score = calculateLearningScore(record);
  return {
    score,
    judgement: getScoreJudgement(score),
  };
}

function normalizeRecord(record) {
  const dateKey = normalizeDateKey(record.dateKey || record.date);
  const normalizedRecord = {
    id: record.id || createId(),
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
    date: dateKey,
    durationMinutes: getLegacyDuration(record),
    learningContent: getLegacyLearningContent(record),
    problems: String(record.problems || "").trim(),
    nextStep: String(record.nextStep || "").trim(),
    aiProgrammingDone: getBooleanValue(record.aiProgrammingDone) || Boolean(String(record.aiTask || record.aiLearning || "").trim()),
    videoMaterialDone:
      getBooleanValue(record.videoMaterialDone) ||
      Boolean(String(record.videoTask || record.editingTask || record.editingLearning || "").trim()),
    reviewNotesDone: getBooleanValue(record.reviewNotesDone) || Boolean(String(record.feedback || record.notes || "").trim()),
  };

  return {
    ...normalizedRecord,
    ...buildScoreSummary(normalizedRecord),
  };
}

function normalizeRecords(records) {
  const recordsByDate = new Map();

  records.map(normalizeRecord).forEach((record) => {
    if (!record.date) return;

    const existingRecord = recordsByDate.get(record.date);
    const existingTime = existingRecord ? existingRecord.updatedAt || existingRecord.createdAt || "" : "";
    const currentTime = record.updatedAt || record.createdAt || "";

    if (!existingRecord || currentTime.localeCompare(existingTime) >= 0) {
      recordsByDate.set(record.date, record);
    }
  });

  return Array.from(recordsByDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function loadRecords() {
  const primaryRecords = readStoredRecords(storageKey);
  const legacyRecords = legacyStorageKeys.flatMap((key) => readStoredRecords(key));
  return normalizeRecords([...primaryRecords, ...legacyRecords]);
}

function saveRecords(records) {
  const normalizedRecords = normalizeRecords(records);
  localStorage.setItem(storageKey, JSON.stringify(normalizedRecords));
  legacyStorageKeys.forEach((key) => localStorage.removeItem(key));
}

function migrateRecords() {
  saveRecords(loadRecords());
}

function setFormMessage(message, type) {
  formMessage.textContent = message;
  formMessage.className = `form-message is-visible is-${type}`;
}

function clearFormMessage() {
  formMessage.textContent = "";
  formMessage.className = "form-message";
}

function getFormValue(formData, key) {
  return String(formData.get(key) || "").trim();
}

function isValidDuration(value) {
  if (value === "") return true;

  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0;
}

function recordHasContent(record) {
  return [
    "durationMinutes",
    "learningContent",
    "problems",
    "nextStep",
    "aiProgrammingDone",
    "videoMaterialDone",
    "reviewNotesDone",
  ].some((key) => {
    const value = record[key];
    return value === true || value === 0 || String(value || "").trim();
  });
}

function getRecordByDate(date) {
  const dateKey = normalizeDateKey(date);
  return loadRecords().find((record) => record.date === dateKey);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatEmpty(value) {
  const cleanValue = String(value || "").trim();
  return cleanValue ? escapeHtml(cleanValue) : "未填写";
}

function formatDuration(minutes) {
  if (minutes !== 0 && !minutes) return "未填写";
  if (String(minutes).trim() === "") return "未填写";

  const value = Number(minutes);
  return Number.isFinite(value) && value >= 0 ? `${value} 分钟` : "未填写";
}

function formatScore(score) {
  const value = Number(score);
  return Number.isFinite(value) ? `${value} / 100` : "0 / 100";
}

function clearFormFields(keepDate = dateInput.value) {
  form.reset();
  dateInput.value = normalizeDateKey(keepDate) || getTodayDate();
}

function fillFormFromRecord(record) {
  dateInput.value = normalizeDateKey(record.date);
  form.elements.durationMinutes.value = record.durationMinutes || record.durationMinutes === 0 ? record.durationMinutes : "";
  form.elements.learningContent.value = record.learningContent || "";
  form.elements.problems.value = record.problems || "";
  form.elements.nextStep.value = record.nextStep || "";
  form.elements.aiProgrammingDone.checked = getBooleanValue(record.aiProgrammingDone);
  form.elements.videoMaterialDone.checked = getBooleanValue(record.videoMaterialDone);
  form.elements.reviewNotesDone.checked = getBooleanValue(record.reviewNotesDone);
}

function loadSelectedDateIntoForm() {
  const selectedDate = normalizeDateKey(dateInput.value) || getTodayDate();
  dateInput.value = selectedDate;
  const record = getRecordByDate(selectedDate);

  if (record) {
    fillFormFromRecord(record);
  } else {
    clearFormFields(selectedDate);
  }

  clearFormMessage();
}

function buildRecord(formData, existingRecord) {
  const now = new Date().toISOString();
  const dateKey = normalizeDateKey(getFormValue(formData, "date"));
  const record = {
    id: existingRecord ? existingRecord.id : createId(),
    createdAt: existingRecord ? existingRecord.createdAt : now,
    updatedAt: now,
    date: dateKey,
    durationMinutes: getFormValue(formData, "durationMinutes"),
    learningContent: getFormValue(formData, "learningContent"),
    problems: getFormValue(formData, "problems"),
    nextStep: getFormValue(formData, "nextStep"),
    aiProgrammingDone: formData.get("aiProgrammingDone") === "on",
    videoMaterialDone: formData.get("videoMaterialDone") === "on",
    reviewNotesDone: formData.get("reviewNotesDone") === "on",
  };

  return {
    ...record,
    ...buildScoreSummary(record),
  };
}

function renderRecordField(label, value, formatter = formatEmpty) {
  return `
    <div class="record-field">
      <strong>${label}</strong>
      <p>${formatter(value)}</p>
    </div>
  `;
}

function renderRecords() {
  const records = loadRecords().sort((a, b) => b.date.localeCompare(a.date));

  recordCount.textContent = `${records.length} 条记录`;
  clearBtn.disabled = records.length === 0;
  exportBtn.disabled = records.length === 0;

  if (records.length === 0) {
    recordsList.innerHTML = `<div class="empty-state">还没有学习记录，先保存今天的第一条。</div>`;
    return;
  }

  recordsList.innerHTML = records
    .map(
      (record) => `
        <article class="record-card">
          <header>
            <div>
              <h3>${formatEmpty(formatDateForDisplay(record.date))}</h3>
              <div class="record-meta">
                <span class="pill">${formatDuration(record.durationMinutes)}</span>
                <span class="pill score-pill">评分 ${formatScore(record.score)}</span>
                <span class="pill">${formatEmpty(record.judgement)}</span>
              </div>
            </div>
            <div class="card-actions">
              <button class="load-button" type="button" data-date="${escapeHtml(record.date)}">加载到表单</button>
              <button class="delete-button" type="button" data-date="${escapeHtml(record.date)}">删除</button>
            </div>
          </header>
          <div class="record-grid">
            ${renderRecordField("今日学习评分", record.score, formatScore)}
            ${renderRecordField("判断", record.judgement)}
            ${renderRecordField("学习时长", record.durationMinutes, formatDuration)}
            ${renderRecordField("学习内容", record.learningContent)}
            ${renderRecordField("遇到的问题", record.problems)}
            ${renderRecordField("明天下一步任务", record.nextStep)}
          </div>
        </article>
      `
    )
    .join("");
}

function upsertRecord(record) {
  const records = loadRecords();
  const existingRecord = records.find((item) => item.date === record.date);
  const nextRecords = existingRecord
    ? records.map((item) => (item.date === record.date ? record : item))
    : [...records, record];

  saveRecords(nextRecords);
}

function mergeImportedRecords(importedRecords) {
  const currentRecords = loadRecords();
  const importedByDate = normalizeRecords(importedRecords);
  const importedDates = new Set(importedByDate.map((record) => record.date));
  const keptCurrentRecords = currentRecords.filter((record) => !importedDates.has(record.date));

  saveRecords([...keptCurrentRecords, ...importedByDate]);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const selectedDate = normalizeDateKey(getFormValue(formData, "date"));

  if (!selectedDate) {
    setFormMessage("请选择日期", "error");
    return;
  }

  const durationMinutes = getFormValue(formData, "durationMinutes");
  if (!isValidDuration(durationMinutes)) {
    setFormMessage("学习时长必须是 0 或正数", "error");
    return;
  }

  const existingRecord = getRecordByDate(selectedDate);
  const savedRecord = buildRecord(formData, existingRecord);

  upsertRecord(savedRecord);
  fillFormFromRecord(savedRecord);
  setFormMessage(recordHasContent(savedRecord) ? "已保存学习记录" : "已清空并保存该日期记录", "success");
  renderRecords();
});

dateInput.addEventListener("change", loadSelectedDateIntoForm);

resetFormBtns.forEach((button) => {
  button.addEventListener("click", () => {
    const currentDate = dateInput.value || getTodayDate();
    const confirmed = window.confirm("确定要清空当前表单内容吗？历史记录不会被删除。");
    if (!confirmed) return;

    clearFormFields(currentDate);
    clearFormMessage();
  });
});

recordsList.addEventListener("click", (event) => {
  const loadButton = event.target.closest(".load-button");
  const deleteButton = event.target.closest(".delete-button");

  if (loadButton) {
    const record = getRecordByDate(loadButton.dataset.date);
    if (record) {
      fillFormFromRecord(record);
      clearFormMessage();
    }
    return;
  }

  if (!deleteButton) return;

  const deletedDate = normalizeDateKey(deleteButton.dataset.date);
  const records = loadRecords().filter((record) => record.date !== deletedDate);

  saveRecords(records);

  if (normalizeDateKey(dateInput.value) === deletedDate) {
    clearFormFields(deletedDate);
    clearFormMessage();
  }

  renderRecords();
});

clearBtn.addEventListener("click", () => {
  const records = loadRecords();
  if (records.length === 0) return;

  const confirmed = window.confirm("确定要清空全部学习记录吗？这个操作不能撤销。");
  if (!confirmed) return;

  saveRecords([]);
  clearFormFields(dateInput.value || getTodayDate());
  clearFormMessage();
  renderRecords();
});

exportBtn.addEventListener("click", () => {
  const records = loadRecords();
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `learning-records-${getTodayDate()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const importedRecords = JSON.parse(text);

    if (!Array.isArray(importedRecords)) {
      setFormMessage("导入失败：JSON 必须是记录数组", "error");
      return;
    }

    mergeImportedRecords(importedRecords);
    loadSelectedDateIntoForm();
    renderRecords();
    setFormMessage("已导入 JSON，并按日期合并记录", "success");
  } catch (error) {
    console.warn("导入 JSON 失败。", error);
    setFormMessage("导入失败：请选择有效的 JSON 文件", "error");
  } finally {
    importInput.value = "";
  }
});

migrateRecords();
dateInput.value = getTodayDate();
loadSelectedDateIntoForm();
renderRecords();
