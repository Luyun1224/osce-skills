// ============================================================
// OSCE 臨床技術站操作流程 ─ 互動邏輯
// 功能：Checkbox 切換、進度條、LocalStorage、重置、完成評估
// ============================================================

(function () {
    "use strict";

    // ─── DOM References ───
    const cardGrid = document.getElementById("cardGrid");
    const overlay = document.getElementById("modalOverlay");
    const modalClose = document.getElementById("modalClose");
    const modalNumber = document.getElementById("modalNumber");
    const modalTitle = document.getElementById("modalTitle");
    const modalSubtitle = document.getElementById("modalSubtitle");
    const modalBody = document.getElementById("modalBody");
    const progressText = document.getElementById("progressText");
    const progressFill = document.getElementById("progressFill");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const resetBtn = document.getElementById("resetBtn");
    const finishBtn = document.getElementById("finishBtn");
    const backTop = document.getElementById("backTop");

    // Dialog
    const dialogOverlay = document.getElementById("dialogOverlay");
    const dialogIcon = document.getElementById("dialogIcon");
    const dialogTitle = document.getElementById("dialogTitle");
    const dialogBody = document.getElementById("dialogBody");
    const dialogCloseBtn = document.getElementById("dialogCloseBtn");

    let currentIndex = -1;

    // ─── LocalStorage Key ───
    function storageKey(stationId) {
        return "osce_station_" + stationId;
    }

    function loadChecked(stationId) {
        try {
            const raw = localStorage.getItem(storageKey(stationId));
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    function saveChecked(stationId, checkedMap) {
        localStorage.setItem(storageKey(stationId), JSON.stringify(checkedMap));
    }

    function clearChecked(stationId) {
        localStorage.removeItem(storageKey(stationId));
    }

    // Check if a station has any saved progress
    function stationHasProgress(stationId) {
        const map = loadChecked(stationId);
        return Object.values(map).some(v => v === true);
    }

    // ─── SVG Icons ───
    const checkSvg = '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    const cardCheckSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    // ─── Render Cards ───
    function renderCards() {
        STATIONS.forEach((s, idx) => {
            const card = document.createElement("div");
            card.className = "station-card";
            card.style.setProperty("--card-color", s.color);
            card.setAttribute("tabindex", "0");
            card.setAttribute("role", "button");
            card.setAttribute("aria-label", "查看 " + s.title + " 操作流程");
            card.dataset.index = idx;

            const hasProgress = stationHasProgress(s.id);

            card.innerHTML =
                '<span class="card-icon">' + s.icon + '</span>' +
                '<div class="card-number">STATION ' + String(s.id).padStart(2, "0") + '</div>' +
                '<div class="card-title">' + s.title + '</div>' +
                '<div class="card-meta">' +
                '<span class="card-badge">' + s.category + '</span>' +
                '<span>' + s.steps.length + ' 步驟</span>' +
                '</div>' +
                '<div class="card-saved ' + (hasProgress ? "visible" : "") + '">' + cardCheckSvg + '</div>';

            card.addEventListener("click", function () { openModal(idx); });
            card.addEventListener("keydown", function (e) {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(idx); }
            });
            cardGrid.appendChild(card);
        });
    }

    // ─── Update card saved indicator ───
    function updateCardIndicator(stationId) {
        var idx = STATIONS.findIndex(function (s) { return s.id === stationId; });
        if (idx < 0) return;
        var card = cardGrid.children[idx];
        if (!card) return;
        var indicator = card.querySelector(".card-saved");
        if (!indicator) return;
        if (stationHasProgress(stationId)) {
            indicator.classList.add("visible");
        } else {
            indicator.classList.remove("visible");
        }
    }

    // ─── Modal ───
    function openModal(idx) {
        currentIndex = idx;
        populateModal(STATIONS[idx]);
        overlay.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        overlay.classList.remove("active");
        document.body.style.overflow = "";
        currentIndex = -1;
    }

    function populateModal(s) {
        modalNumber.textContent = "STATION " + String(s.id).padStart(2, "0");
        modalTitle.textContent = s.title;
        modalSubtitle.textContent = s.category + " ─ 共 " + s.steps.length + " 個操作步驟";

        // Load saved state
        var checkedMap = loadChecked(s.id);

        var html = '<ol class="step-list">';
        s.steps.forEach(function (step) {
            var isChecked = checkedMap[step.num] === true;
            html +=
                '<li class="step-item' + (isChecked ? " is-checked" : "") + '" data-num="' + step.num + '">' +
                '<div class="step-check">' +
                '<span class="check-num">' + step.num + '</span>' +
                checkSvg +
                '</div>' +
                '<div class="step-content">' +
                '<div class="step-text">' + escapeHtml(step.text) + '</div>' +
                (step.detail ? '<div class="step-detail">' + escapeHtml(step.detail) + '</div>' : '') +
                '</div>' +
                '</li>';
        });
        html += '</ol>';
        modalBody.innerHTML = html;
        modalBody.scrollTop = 0;

        // Attach click events
        var items = modalBody.querySelectorAll(".step-item");
        items.forEach(function (item) {
            item.addEventListener("click", function () {
                toggleStep(item, s);
            });
        });

        // Update progress
        updateProgress(s);

        // Nav buttons
        prevBtn.disabled = currentIndex <= 0;
        nextBtn.disabled = currentIndex >= STATIONS.length - 1;
    }

    function toggleStep(item, station) {
        item.classList.toggle("is-checked");

        // Save to localStorage
        var checkedMap = loadChecked(station.id);
        var num = item.dataset.num;
        checkedMap[num] = item.classList.contains("is-checked");
        saveChecked(station.id, checkedMap);

        // Update progress
        updateProgress(station);

        // Update card indicator
        updateCardIndicator(station.id);
    }

    // ─── Progress Bar ───
    function updateProgress(station) {
        var checkedMap = loadChecked(station.id);
        var total = station.steps.length;
        var done = 0;
        station.steps.forEach(function (step) {
            if (checkedMap[step.num] === true) done++;
        });

        var pct = total > 0 ? Math.round((done / total) * 100) : 0;
        progressText.textContent = done + " / " + total;
        progressFill.style.width = pct + "%";

        if (done === total && total > 0) {
            progressFill.classList.add("complete");
        } else {
            progressFill.classList.remove("complete");
        }
    }

    // ─── Reset Button ───
    resetBtn.addEventListener("click", function () {
        if (currentIndex < 0) return;
        var station = STATIONS[currentIndex];

        clearChecked(station.id);

        // Reset all checkboxes in modal
        var items = modalBody.querySelectorAll(".step-item");
        items.forEach(function (item) {
            item.classList.remove("is-checked");
        });

        updateProgress(station);
        updateCardIndicator(station.id);
    });

    // ─── Finish / Validation ───
    finishBtn.addEventListener("click", function () {
        if (currentIndex < 0) return;
        var station = STATIONS[currentIndex];
        var checkedMap = loadChecked(station.id);

        var missing = [];
        station.steps.forEach(function (step) {
            if (checkedMap[step.num] !== true) {
                missing.push(step);
            }
        });

        if (missing.length === 0) {
            showDialog(
                "success",
                "🎉 全部完成！",
                "<p>恭喜！您已完成「" + escapeHtml(station.title) + "」的所有 " + station.steps.length + " 個操作步驟。</p>"
            );
        } else {
            var listHtml = "<p style='margin-bottom:10px;'>您遺漏了以下 <strong>" + missing.length + "</strong> 個步驟：</p><ul>";
            missing.forEach(function (step) {
                listHtml += "<li><strong>步驟 " + step.num + "</strong>　" + escapeHtml(step.text) + "</li>";
            });
            listHtml += "</ul>";

            showDialog(
                "warning",
                "⚠️ 注意！有步驟尚未完成",
                listHtml
            );
        }
    });

    // ─── Custom Dialog ───
    function showDialog(type, title, bodyHtml) {
        dialogIcon.className = "dialog-icon " + type;
        dialogIcon.textContent = type === "success" ? "✅" : "⚠️";
        dialogTitle.textContent = title;
        dialogBody.innerHTML = bodyHtml;
        dialogOverlay.classList.add("active");
    }

    function closeDialog() {
        dialogOverlay.classList.remove("active");
    }

    dialogCloseBtn.addEventListener("click", closeDialog);
    dialogOverlay.addEventListener("click", function (e) {
        if (e.target === dialogOverlay) closeDialog();
    });

    // ─── Modal Navigation ───
    modalClose.addEventListener("click", closeModal);
    overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeModal();
    });

    prevBtn.addEventListener("click", function () {
        if (currentIndex > 0) { currentIndex--; populateModal(STATIONS[currentIndex]); }
    });

    nextBtn.addEventListener("click", function () {
        if (currentIndex < STATIONS.length - 1) { currentIndex++; populateModal(STATIONS[currentIndex]); }
    });

    document.addEventListener("keydown", function (e) {
        if (dialogOverlay.classList.contains("active")) {
            if (e.key === "Escape") closeDialog();
            return;
        }
        if (!overlay.classList.contains("active")) return;
        if (e.key === "Escape") closeModal();
        if (e.key === "ArrowLeft" && currentIndex > 0) { currentIndex--; populateModal(STATIONS[currentIndex]); }
        if (e.key === "ArrowRight" && currentIndex < STATIONS.length - 1) { currentIndex++; populateModal(STATIONS[currentIndex]); }
    });

    // ─── Back to Top ───
    window.addEventListener("scroll", function () {
        backTop.classList.toggle("visible", window.scrollY > 300);
    }, { passive: true });

    // ─── Escape HTML ───
    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // ─── Init ───
    renderCards();
})();
