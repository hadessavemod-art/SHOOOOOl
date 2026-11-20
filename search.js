// Predictive Search Engine ("Предполагаемый поиск") for Person | Subject | Room
window.SchoolSearch = (function () {
  const EN_TO_RU = {
    q: "й", w: "ц", e: "у", r: "к", t: "е", y: "н", u: "г", i: "ш", o: "щ", p: "з",
    "[": "х", "]": "ъ", a: "ф", s: "ы", d: "в", f: "а", g: "п", h: "р", j: "о", k: "л",
    l: "д", ";": "ж", "'": "э", z: "я", x: "ч", c: "с", v: "м", b: "и", n: "т", m: "ь",
    ",": "б", ".": "ю", "/": "."
  };

  function fixLayout(str) {
    if (!/[a-zA-Z]/.test(str)) return str;
    return str.toLowerCase().split("").map(ch => EN_TO_RU[ch] || ch).join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function highlightMatch(text, query) {
    const clean = query.trim();
    if (!clean) return escapeHtml(text);
    const idx = text.toLowerCase().indexOf(clean.toLowerCase());
    if (idx === -1) return escapeHtml(text);
    const before = escapeHtml(text.slice(0, idx));
    const match = escapeHtml(text.slice(idx, idx + clean.length));
    const after = escapeHtml(text.slice(idx + clean.length));
    return `${before}<mark>${match}</mark>${after}`;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let curr = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
    }
    return prev[b.length];
  }

  function scoreString(target, q) {
    const t = target.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 90;
    const words = t.split(/[\s,/.-]+/);
    if (words.some(w => w.startsWith(q))) return 82;
    if (t.includes(q)) return 70;

    if (q.length >= 3) {
      let bestFuzzy = 0;
      for (const w of words) {
        if (w.length < 3) continue;
        const slice = w.slice(0, Math.min(w.length, q.length + 1));
        const dist = levenshtein(q, slice);
        const maxDist = q.length <= 4 ? 1 : 2;
        if (dist <= maxDist) {
          bestFuzzy = Math.max(bestFuzzy, 58 - dist * 12);
        }
      }
      return bestFuzzy;
    }
    return 0;
  }

  function getSuggestions(rawQuery) {
    const raw = rawQuery.trim().toLowerCase();
    if (!raw) return { subjects: [], staff: [], rooms: [], correctedQuery: null };

    const fixed = fixLayout(raw);
    const queries = fixed !== raw ? [raw, fixed] : [raw];
    const usedQuery = fixed !== raw ? fixed : raw;

    const data = window.SCHOOL_DATA;

    // 1. Subjects & Aliases
    const subjectHits = [];
    for (const subj of data.subjects) {
      let best = 0;
      for (const q of queries) {
        best = Math.max(best, scoreString(subj.label, q));
        for (const alias of subj.aliases) {
          best = Math.max(best, scoreString(alias, q));
        }
      }
      if (best > 0) {
        subjectHits.push({
          kind: "subject",
          title: subj.label,
          sub: "Фильтр по предмету или службе",
          badge: "Предмет",
          filterQuery: subj.query,
          score: best + 4
        });
      }
    }
    subjectHits.sort((a, b) => b.score - a.score);

    // 2. Staff (Person)
    const staffHits = [];
    for (const person of data.staff) {
      let best = 0;
      for (const q of queries) {
        best = Math.max(best, scoreString(person.name, q));
        best = Math.max(best, scoreString(person.role, q) - 10);
      }
      if (best > 0) {
        const roomLabel = person.rooms.length ? `Каб. ${person.rooms.join(", ")}` : "Кабинет уточняется";
        staffHits.push({
          kind: "person",
          id: person.id,
          title: person.name,
          sub: `${person.role} · ${roomLabel}`,
          badge: "Педагог",
          rooms: person.rooms,
          score: best
        });
      }
    }
    staffHits.sort((a, b) => b.score - a.score);

    // 3. Rooms
    const roomHits = [];
    for (const [floorKey, floorObj] of Object.entries(data.floors)) {
      for (const room of floorObj.rooms) {
        let best = 0;
        for (const q of queries) {
          best = Math.max(best, scoreString(room.id, q));
          best = Math.max(best, scoreString(room.label, q));
          best = Math.max(best, scoreString(room.type, q) - 12);
        }
        if (best > 0) {
          roomHits.push({
            kind: "room",
            roomId: room.id,
            title: room.label,
            sub: `${floorKey} этаж · ${room.type}`,
            badge: "Кабинет",
            score: best
          });
        }
      }
    }
    roomHits.sort((a, b) => b.score - a.score);

    return {
      subjects: subjectHits.slice(0, 3),
      staff: staffHits.slice(0, 5),
      rooms: roomHits.slice(0, 3),
      correctedQuery: usedQuery
    };
  }

  function attachPredictiveInput({ inputEl, dropdownEl, clearBtn, onSelect, onInputChange }) {
    let activeIdx = -1;
    let flatItems = [];

    function close() {
      dropdownEl.classList.add("hidden");
      activeIdx = -1;
    }

    function updateClearBtn() {
      if (!clearBtn) return;
      clearBtn.classList.toggle("hidden", inputEl.value.trim().length === 0);
    }

    function render(query) {
      updateClearBtn();
      const res = getSuggestions(query);
      flatItems = [...res.subjects, ...res.staff, ...res.rooms];

      if (!query.trim()) {
        close();
        return;
      }

      if (flatItems.length === 0) {
        dropdownEl.innerHTML = `<div class="suggest-empty">Совпадений не найдено. Попробуйте фамилию, предмет (например, «матем») или номер кабинета.</div>`;
        dropdownEl.classList.remove("hidden");
        return;
      }

      let html = "";
      let itemIndex = 0;
      const groups = [
        { label: "Предметы и направления", items: res.subjects },
        { label: "Педагоги и сотрудники", items: res.staff },
        { label: "Кабинеты и помещения", items: res.rooms }
      ];

      for (const g of groups) {
        if (!g.items.length) continue;
        html += `<div class="suggest-group-label">${g.label}</div>`;
        for (const item of g.items) {
          html += `
            <button type="button" class="suggest-item" role="option" data-idx="${itemIndex}">
              <span class="suggest-main">
                <span class="suggest-title">${highlightMatch(item.title, res.correctedQuery || query)}</span>
                <span class="suggest-sub">${escapeHtml(item.sub)}</span>
              </span>
              <span class="suggest-badge">${escapeHtml(item.badge)}</span>
            </button>
          `;
          itemIndex++;
        }
      }

      dropdownEl.innerHTML = html;
      dropdownEl.classList.remove("hidden");
      activeIdx = -1;
    }

    function setActive(idx) {
      const buttons = dropdownEl.querySelectorAll(".suggest-item");
      buttons.forEach(b => b.classList.remove("is-active"));
      if (idx >= 0 && idx < buttons.length) {
        activeIdx = idx;
        buttons[idx].classList.add("is-active");
        buttons[idx].scrollIntoView({ block: "nearest" });
      } else {
        activeIdx = -1;
      }
    }

    function pick(idx) {
      const item = flatItems[idx];
      if (!item) return;
      close();
      onSelect(item);
    }

    inputEl.addEventListener("input", () => {
      const val = inputEl.value;
      render(val);
      if (onInputChange) onInputChange(val);
    });

    inputEl.addEventListener("focus", () => {
      if (inputEl.value.trim()) render(inputEl.value);
    });

    inputEl.addEventListener("keydown", (e) => {
      if (dropdownEl.classList.contains("hidden")) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(activeIdx + 1 >= flatItems.length ? 0 : activeIdx + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(activeIdx - 1 < 0 ? flatItems.length - 1 : activeIdx - 1);
      } else if (e.key === "Enter" && activeIdx >= 0) {
        e.preventDefault();
        pick(activeIdx);
      } else if (e.key === "Escape") {
        close();
      }
    });

    dropdownEl.addEventListener("mousedown", (e) => {
      const btn = e.target.closest(".suggest-item");
      if (!btn) return;
      e.preventDefault();
      pick(Number(btn.dataset.idx));
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        inputEl.value = "";
        updateClearBtn();
        close();
        if (onInputChange) onInputChange("");
        inputEl.focus();
      });
    }

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-wrapper") || (!inputEl.contains(e.target) && !dropdownEl.contains(e.target))) {
        if (!inputEl.closest(".search-wrapper").contains(e.target)) {
          close();
        }
      }
    });

    return { close, updateClearBtn };
  }

  return { getSuggestions, attachPredictiveInput, fixLayout };
})();
