// Interactive 4-Floor Map, Evacuation Plan & Room Inspector
window.SchoolMap = (function () {
  let activeFloor = "1";
  let activeRoomId = "Библиотека";

  function normalizeRoomId(room) {
    if (!room) return "";
    const r = String(room).trim().toLowerCase();
    if (r === "с/з" || r === "спортзал") return "Спортзал";
    if (r === "маст" || r === "мастерские" || r === "технология") return "Мастерские";
    if (r === "приёмная" || r === "приемная") return "Приёмная";
    if (r === "библиотека") return "Библиотека";
    if (r === "столовая") return "Столовая";
    return String(room).trim();
  }

  function render() {
    const floors = window.SCHOOL_DATA.floors;
    const staff = window.SCHOOL_DATA.staff;
    const floorData = floors[activeFloor];
    if (!floorData) return;

    const headingEl = document.getElementById("floor-heading");
    const gridEl = document.getElementById("floor-rooms-grid");
    const evacCard = document.getElementById("evac-plan-card");
    if (!headingEl || !gridEl) return;

    headingEl.textContent = floorData.title;

    if (evacCard) {
      evacCard.classList.toggle("hidden", activeFloor !== "1");
    }

    document.querySelectorAll(".floor-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.floor === activeFloor);
    });

    gridEl.innerHTML = floorData.rooms.map(room => {
      const isSelected = room.id === activeRoomId;
      const count = staff.filter(s => s.rooms.includes(room.id)).length;
      return `
        <button type="button" data-room-id="${room.id}" class="room-tile ${isSelected ? "active-room" : ""}">
          <div class="room-tile-top">
            <span class="room-tile-name">${room.label}</span>
            <span class="mono-tag ${isSelected ? "mono-tag--inverted" : ""}">${count}</span>
          </div>
          <div class="room-tile-type">${room.type}</div>
        </button>
      `;
    }).join("");

    renderInspector();
  }

  function renderInspector() {
    const floors = window.SCHOOL_DATA.floors;
    const staff = window.SCHOOL_DATA.staff;

    let foundRoom = null;
    let foundFloor = activeFloor;
    for (const [fKey, fVal] of Object.entries(floors)) {
      const match = fVal.rooms.find(r => r.id === activeRoomId);
      if (match) {
        foundRoom = match;
        foundFloor = fKey;
        break;
      }
    }
    if (!foundRoom) return;

    document.getElementById("room-badge").textContent = `${foundFloor} этаж`;
    document.getElementById("room-title").textContent = foundRoom.label;
    document.getElementById("room-subtitle").textContent = foundRoom.type;

    const teachersInRoom = staff.filter(s => s.rooms.includes(foundRoom.id));
    const listEl = document.getElementById("room-teachers-list");
    listEl.innerHTML = teachersInRoom.length
      ? teachersInRoom.map(t => `
          <div class="inspector-staff-item">
            <div class="inspector-staff-name">${t.name}</div>
            <div class="inspector-staff-role">${t.role}</div>
          </div>
        `).join("")
      : `<div class="room-pending">Общешкольное или свободное помещение.</div>`;
  }

  function goToRoom(rawRoomId) {
    const roomId = normalizeRoomId(rawRoomId);
    const floors = window.SCHOOL_DATA.floors;
    for (const [fKey, fVal] of Object.entries(floors)) {
      if (fVal.rooms.some(r => r.id === roomId)) {
        activeFloor = fKey;
        activeRoomId = roomId;
        render();
        if (typeof window.switchSchoolTab === "function") {
          window.switchSchoolTab("map");
        }
        return true;
      }
    }
    return false;
  }

  function init() {
    document.querySelectorAll(".floor-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        activeFloor = tab.dataset.floor;
        const rooms = window.SCHOOL_DATA.floors[activeFloor].rooms;
        if (rooms.length) activeRoomId = rooms[0].id;
        render();
      });
    });

    const gridEl = document.getElementById("floor-rooms-grid");
    if (gridEl) {
      gridEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".room-tile");
        if (!btn) return;
        activeRoomId = btn.dataset.roomId;
        render();
      });
    }

    document.querySelectorAll(".goto-room-btn").forEach(btn => {
      btn.addEventListener("click", () => goToRoom(btn.dataset.gotoRoom));
    });

    const openPlanBtn = document.getElementById("open-plan-modal-btn");
    const planModal = document.getElementById("plan-modal");
    const closePlanBtn = document.getElementById("plan-modal-close");
    if (openPlanBtn && planModal) {
      openPlanBtn.addEventListener("click", () => planModal.classList.remove("hidden"));
      if (closePlanBtn) {
        closePlanBtn.addEventListener("click", () => planModal.classList.add("hidden"));
      }
      planModal.addEventListener("click", (e) => {
        if (e.target === planModal) planModal.classList.add("hidden");
      });
    }

    render();
  }

  return { init, goToRoom, render };
})();
