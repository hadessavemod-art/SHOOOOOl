// Live Bell Timer (Asia/Novokuznetsk UTC+7), Holiday Countdown & Time Simulator
window.SchoolBells = (function () {
  let simMinutes = null;
  let timerId = null;
  let selectedClassGetter = () => null;

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function getNovokuznetskNow() {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const nvk = new Date(utcMs + 7 * 3600000);
    const pad = n => String(n).padStart(2, "0");
    const dk = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][nvk.getDay()] || "mon";
    return {
      dateIso: `${nvk.getFullYear()}-${pad(nvk.getMonth() + 1)}-${pad(nvk.getDate())}`,
      dayKey: dk,
      h: nvk.getHours(),
      m: nvk.getMinutes(),
      s: nvk.getSeconds()
    };
  }

  function parseUtcDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function updateHolidayBadge(todayIso) {
    const badgeEl = document.getElementById("holiday-badge-text");
    const quarters = window.SCHOOL_DATA.quarters || [];
    if (!badgeEl || !quarters.length) return;

    const todayMs = parseUtcDate(todayIso);
    let label = "Учебный год";

    for (const q of quarters) {
      const startMs = parseUtcDate(q.start);
      const endMs = parseUtcDate(q.end);
      const breakEndMs = parseUtcDate(q.breakUntil);

      if (todayMs < startMs) {
        const days = Math.round((startMs - todayMs) / 86400000);
        label = `До учёбы: ${days} дн.`;
        break;
      }
      if (todayMs >= startMs && todayMs <= endMs) {
        const days = Math.round((endMs - todayMs) / 86400000);
        label = days === 0 ? "Каникулы завтра" : `До каникул: ${days} дн.`;
        break;
      }
      if (todayMs > endMs && todayMs <= breakEndMs) {
        const days = Math.round((breakEndMs - todayMs) / 86400000) + 1;
        label = `Каникулы · ${days} дн.`;
        break;
      }
    }

    badgeEl.textContent = label;
  }

  function formatLessonLabel(pair) {
    if (!pair) return "";
    const [subj, room] = pair;
    return room ? `${subj} (каб. ${room})` : subj;
  }

  function syncSimInputs(hhmm) {
    const a = document.getElementById("sim-time-input");
    const b = document.getElementById("sim-time-home");
    if (a && a.value !== hhmm) a.value = hhmm;
    if (b && b.value !== hhmm) b.value = hhmm;
  }

  function update() {
    const bells = window.SCHOOL_DATA.bells;
    const real = getNovokuznetskNow();
    updateHolidayBadge(real.dateIso);

    const totalSec = simMinutes !== null
      ? simMinutes * 60
      : real.h * 3600 + real.m * 60 + real.s;

    const curH = Math.floor(totalSec / 3600) % 24;
    const curM = Math.floor((totalSec % 3600) / 60);
    const curS = totalSec % 60;
    const pad = n => String(n).padStart(2, "0");

    const clockEl = document.getElementById("live-clock");
    if (clockEl) {
      clockEl.textContent = simMinutes !== null
        ? `${pad(curH)}:${pad(curM)} (тест)`
        : `${pad(curH)}:${pad(curM)}:${pad(curS)}`;
    }

    const clsName = selectedClassGetter();
    const clsData = clsName && window.SCHOOL_SCHEDULES ? window.SCHOOL_SCHEDULES[clsName] : null;
    const activeDay = ["mon", "tue", "wed", "thu", "fri"].includes(real.dayKey) ? real.dayKey : "mon";
    const dayLessons = clsData ? (clsData.days[activeDay] || {}) : null;

    const scopeEl = document.getElementById("bell-widget-scope");
    if (scopeEl) {
      scopeEl.textContent = clsName ? `Класс ${clsName} · Новокузнецк` : "Статус звонков · Новокузнецк";
    }

    const nowMin = curH * 60 + curM;
    let activeIndex = -1;
    let statusTitle = "Учебный день завершён";
    let statusSub = "Занятия проходят с 08:00 до 16:55";
    let nextLine = "";
    let countdownLabel = "Осталось";
    let countdownStr = "—";

    const firstStart = toMinutes(bells[0].start);
    const lastEnd = toMinutes(bells[bells.length - 1].end);

    if (nowMin < firstStart) {
      const diffSec = firstStart * 60 - totalSec;
      statusTitle = "До начала 1-го урока";
      statusSub = `Первый звонок в ${bells[0].start}`;
      if (dayLessons && dayLessons[1]) {
        nextLine = `1 урок: ${formatLessonLabel(dayLessons[1])}`;
      }
      countdownLabel = "До звонка";
      countdownStr = `${Math.floor(diffSec / 60)} мин`;
    } else if (nowMin >= lastEnd) {
      statusTitle = "Уроки закончились";
      statusSub = "Школа открыта до завершения кружков и секций";
      countdownLabel = "Статус";
      countdownStr = "00:00";
    } else {
      for (let i = 0; i < bells.length; i++) {
        const sMin = toMinutes(bells[i].start);
        const eMin = toMinutes(bells[i].end);
        const lessonNum = bells[i].num;

        if (nowMin >= sMin && nowMin < eMin) {
          activeIndex = i;
          const remSec = eMin * 60 - totalSec;
          const curPair = dayLessons ? dayLessons[lessonNum] : null;
          statusTitle = curPair ? `${lessonNum} урок · ${formatLessonLabel(curPair)}` : `Идёт ${lessonNum}-й урок`;
          statusSub = `${bells[i].start} – ${bells[i].end} · ${bells[i].note}`;
          if (dayLessons && dayLessons[lessonNum + 1]) {
            nextLine = `Далее (${bells[i + 1].start}): ${formatLessonLabel(dayLessons[lessonNum + 1])}`;
          }
          countdownLabel = "До перемены";
          countdownStr = `${pad(Math.floor(remSec / 60))}:${pad(remSec % 60)}`;
          break;
        }
        if (i < bells.length - 1) {
          const nextStart = toMinutes(bells[i + 1].start);
          if (nowMin >= eMin && nowMin < nextStart) {
            const remSec = nextStart * 60 - totalSec;
            const nextNum = bells[i + 1].num;
            const nextPair = dayLessons ? dayLessons[nextNum] : null;
            statusTitle = `Перемена перед ${nextNum}-м уроком`;
            statusSub = `Следующий звонок в ${bells[i + 1].start}`;
            if (nextPair) {
              nextLine = `Следующий урок: ${formatLessonLabel(nextPair)}`;
            }
            countdownLabel = "До урока";
            countdownStr = `${pad(Math.floor(remSec / 60))}:${pad(remSec % 60)}`;
            break;
          }
        }
      }
    }

    const titleEl = document.getElementById("live-lesson-title");
    const subEl = document.getElementById("live-lesson-sub");
    const nextEl = document.getElementById("live-lesson-next");
    const cdLabelEl = document.getElementById("live-countdown-label");
    const cdEl = document.getElementById("live-countdown");
    if (titleEl) titleEl.textContent = statusTitle;
    if (subEl) subEl.textContent = statusSub;
    if (nextEl) nextEl.textContent = nextLine;
    if (cdLabelEl) cdLabelEl.textContent = countdownLabel;
    if (cdEl) cdEl.textContent = countdownStr;

    const tbody = document.getElementById("bells-tbody");
    if (!tbody) return;

    tbody.innerHTML = bells.map((b, idx) => {
      const isCurrent = idx === activeIndex;
      const duration = toMinutes(b.end) - toMinutes(b.start);
      const passed = nowMin >= toMinutes(b.end);
      let badge = `<span class="status-pill">Ожидается</span>`;
      if (isCurrent) {
        badge = `<span class="status-pill status-pill--live">Идёт сейчас</span>`;
      } else if (passed) {
        badge = `<span class="status-pill">Завершён</span>`;
      }
      return `
        <tr class="${isCurrent ? "is-current" : ""}">
          <td><strong>${b.num} урок</strong></td>
          <td class="mono-cell">${b.start} – ${b.end}</td>
          <td class="mono-cell">${duration} мин</td>
          <td>${b.breakAfter}</td>
          <td>${badge}</td>
        </tr>
      `;
    }).join("");
  }

  function bindSimPair(inputId, applyId, resetId) {
    const inputEl = document.getElementById(inputId);
    const applyBtn = document.getElementById(applyId);
    const resetBtn = document.getElementById(resetId);

    if (applyBtn && inputEl) {
      applyBtn.addEventListener("click", () => {
        if (inputEl.value) {
          simMinutes = toMinutes(inputEl.value);
          syncSimInputs(inputEl.value);
          update();
        }
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        simMinutes = null;
        syncSimInputs("");
        update();
      });
    }
  }

  function init(getClassFn) {
    if (typeof getClassFn === "function") selectedClassGetter = getClassFn;

    bindSimPair("sim-time-input", "sim-apply-btn", "sim-reset-btn");
    bindSimPair("sim-time-home", "sim-apply-home", "sim-reset-home");

    if (timerId) clearInterval(timerId);
    update();
    timerId = setInterval(update, 1000);
  }

  return { init, update, getNovokuznetskNow };
})();
