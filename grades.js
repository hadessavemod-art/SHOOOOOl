// Average Grade & Quarter Goal Calculator (per-subject saved in localStorage)
window.SchoolGrades = (function () {
  const STORAGE_KEY = "s60_grades_by_subject";
  const DEFAULT_SUBJECTS = [
    "Общий расчёт",
    "Математика",
    "Русский язык",
    "Литература",
    "Иностранный язык",
    "Физика",
    "Информатика",
    "История",
    "Обществознание",
    "Биология",
    "Химия",
    "География"
  ];

  let activeSubject = "Общий расчёт";
  let gradesMap = {};

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") gradesMap = parsed;
      }
    } catch (e) {}
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gradesMap));
    } catch (e) {}
  }

  function getList() {
    return Array.isArray(gradesMap[activeSubject]) ? gradesMap[activeSubject] : [];
  }

  function setList(list) {
    gradesMap[activeSubject] = list;
    save();
    render();
  }

  function calcNeeded(sum, count, targetAvg, addGrade) {
    if (count === 0) return null;
    if (sum / count >= targetAvg) return 0;
    if (addGrade <= targetAvg) return null;
    let n = 0;
    while (n < 100 && (sum + n * addGrade) / (count + n) < targetAvg) {
      n++;
    }
    return n < 100 ? n : null;
  }

  function getQuarterMark(avg) {
    if (avg >= 4.5) return 5;
    if (avg >= 3.5) return 4;
    if (avg >= 2.5) return 3;
    return 2;
  }

  function render() {
    const list = getList();
    const pillsWrap = document.getElementById("grades-pills");
    const avgEl = document.getElementById("grade-avg-val");
    const markEl = document.getElementById("grade-quarter-val");
    const countEl = document.getElementById("grade-count-val");
    const adviceEl = document.getElementById("grade-advice-list");

    if (!pillsWrap || !avgEl || !markEl || !countEl || !adviceEl) return;

    if (list.length === 0) {
      pillsWrap.innerHTML = `<span class="room-pending">Нажмите на оценки выше (5, 4, 3, 2), чтобы добавить их в расчёт.</span>`;
      avgEl.textContent = "—";
      markEl.textContent = "—";
      countEl.textContent = "0";
      adviceEl.innerHTML = `<div class="grade-advice-item">Добавьте хотя бы одну оценку, чтобы увидеть прогноз за четверть.</div>`;
      return;
    }

    const sum = list.reduce((a, b) => a + b, 0);
    const avg = sum / list.length;
    const qMark = getQuarterMark(avg);

    avgEl.textContent = avg.toFixed(2);
    markEl.textContent = String(qMark);
    countEl.textContent = String(list.length);

    pillsWrap.innerHTML = list.map((g, idx) => `
      <button type="button" class="grade-chip" data-remove-idx="${idx}" title="Нажмите, чтобы удалить">${g}</button>
    `).join("");

    const advice = [];
    const need5for5 = calcNeeded(sum, list.length, 4.5, 5);
    const need5for4 = calcNeeded(sum, list.length, 3.5, 5);
    const need4for4 = calcNeeded(sum, list.length, 3.5, 4);

    if (avg >= 4.5) {
      advice.push("Средний балл уже на твёрдую «5» (4.50 и выше).");
    } else if (need5for5 !== null) {
      advice.push(`До «5» (балл 4.50) нужно подряд пятёрок: <strong>${need5for5}</strong>.`);
    }

    if (avg < 3.5) {
      if (need5for4 !== null) {
        advice.push(`До «4» (балл 3.50) нужно пятёрок: <strong>${need5for4}</strong>${need4for4 !== null ? ` или четвёрок: <strong>${need4for4}</strong>` : ""}.`);
      }
    } else if (avg < 4.5) {
      advice.push("Текущий средний балл соответствует оценке «4».");
    }

    adviceEl.innerHTML = advice.map(line => `<div class="grade-advice-item">${line}</div>`).join("");
  }

  function init() {
    load();

    const subjSelect = document.getElementById("grade-subject-select");
    if (subjSelect) {
      subjSelect.innerHTML = DEFAULT_SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join("");
      subjSelect.value = activeSubject;
      subjSelect.addEventListener("change", (e) => {
        activeSubject = e.target.value;
        render();
      });
    }

    const addWrap = document.getElementById("grade-add-btns");
    if (addWrap) {
      addWrap.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-add-grade]");
        if (!btn) return;
        const val = Number(btn.dataset.addGrade);
        const next = [...getList(), val];
        setList(next);
      });
    }

    const pillsWrap = document.getElementById("grades-pills");
    if (pillsWrap) {
      pillsWrap.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-remove-idx]");
        if (!chip) return;
        const idx = Number(chip.dataset.removeIdx);
        const next = getList().filter((_, i) => i !== idx);
        setList(next);
      });
    }

    const undoBtn = document.getElementById("grade-undo-btn");
    if (undoBtn) {
      undoBtn.addEventListener("click", () => {
        const cur = getList();
        if (cur.length) setList(cur.slice(0, -1));
      });
    }

    const clearBtn = document.getElementById("grade-clear-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => setList([]));
    }

    render();
  }

  return { init, render };
})();
