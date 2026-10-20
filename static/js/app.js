/**
 * MapLead Studio v2.0 - 50km Local Radar & Accurate Lead Extractor
 * Light Glassmorphism & Mobile-First Interactive Frontend Engine
 */

// Application State
let leadsData = [];
let currentJobId = null;
let eventSource = null;
let currentSortColumn = null;
let sortAscending = true;
let activeFilterText = "";
let activeQuickFilter = "all"; // 'all', '50km', 'whatsapp', 'email'
let currentViewMode = window.innerWidth <= 768 ? "cards" : "table";

// User Geolocation State
let userLocation = {
    lat: null,
    lng: null,
    city: "",
    region: "",
    displayName: "Locating..."
};

// DOM Elements
const queryInput = document.getElementById("queryInput");
const clearQueryBtn = document.getElementById("clearQueryBtn");
const limitInput = document.getElementById("limitInput");
const limitValueText = document.getElementById("limitValueText");
const enrichLeadCheck = document.getElementById("enrichLeadCheck");
const headlessCheck = document.getElementById("headlessCheck");
const nearMeToggle = document.getElementById("nearMeToggle");
const strictRadiusCheck = document.getElementById("strictRadiusCheck");
const radiusInput = document.getElementById("radiusInput");
const radiusChips = document.querySelectorAll(".radius-chip");
const startScrapeBtn = document.getElementById("startScrapeBtn");
const stopScrapeBtn = document.getElementById("stopScrapeBtn");
const jobStatusBadge = document.getElementById("jobStatusBadge");
const jobStatusText = document.getElementById("jobStatusText");
const radarActiveBadge = document.getElementById("radarActiveBadge");
const radarDistanceLabel = document.getElementById("radarDistanceLabel");

// Navbar & Hero
const navLocationPill = document.getElementById("navLocationPill");
const navLocationText = document.getElementById("navLocationText");
const refreshLocationBtn = document.getElementById("refreshLocationBtn");
const humanGreeting = document.getElementById("humanGreeting");
const heroNearMeBtn = document.getElementById("heroNearMeBtn");

// Radar Visual
const radarVisualContainer = document.getElementById("radarVisualContainer");
const radarScanStatus = document.getElementById("radarScanStatus");
const radarFoundCounter = document.getElementById("radarFoundCounter");
const radarBlipsContainer = document.getElementById("radarBlipsContainer");

// Progress & Logs
const progressContainer = document.getElementById("progressContainer");
const progressBarFill = document.getElementById("progressBarFill");
const progressPercent = document.getElementById("progressPercent");
const progressMessage = document.getElementById("progressMessage");

const toggleTerminalBtn = document.getElementById("toggleTerminalBtn");
const terminalLogBox = document.getElementById("terminalLogBox");
const terminalChevron = document.getElementById("terminalChevron");
const logContent = document.getElementById("logContent");
const clearLogsBtn = document.getElementById("clearLogsBtn");

// Stats Counters
const statTotalLeads = document.getElementById("statTotalLeads");
const statWithinRadius = document.getElementById("statWithinRadius");
const statWhatsApp = document.getElementById("statWhatsApp");
const statPhones = document.getElementById("statPhones");
const statEmails = document.getElementById("statEmails");

// Table, Cards & Spreadsheet
const sheetTitleInput = document.getElementById("sheetTitleInput");
const tableRowCount = document.getElementById("tableRowCount");
const tableFilterInput = document.getElementById("tableFilterInput");
const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const leadsTableBody = document.getElementById("leadsTableBody");
const emptyTableRow = document.getElementById("emptyTableRow");
const filteredCountText = document.getElementById("filteredCountText");
const quickFilterPills = document.querySelectorAll(".filter-pill");

const tableViewBtn = document.getElementById("tableViewBtn");
const cardViewBtn = document.getElementById("cardViewBtn");
const tableScrollContainer = document.getElementById("tableScrollContainer");
const leadsCardsContainer = document.getElementById("leadsCardsContainer");

const addRowBtn = document.getElementById("addRowBtn");
const deleteRowBtn = document.getElementById("deleteRowBtn");
const clearAllTableBtn = document.getElementById("clearAllTableBtn");
const saveSheetBtn = document.getElementById("saveSheetBtn");

// Mobile Bottom Bar
const mobileScanBtn = document.getElementById("mobileScanBtn");
const mobileCardsBtn = document.getElementById("mobileCardsBtn");
const mobileTableBtn = document.getElementById("mobileTableBtn");
const mobileExportBtn = document.getElementById("mobileExportBtn");
const mobileSavedBtn = document.getElementById("mobileSavedBtn");

// Export & Import
const exportDropdownBtn = document.getElementById("exportDropdownBtn");
const exportMenu = document.getElementById("exportMenu");
const downloadExcelBtn = document.getElementById("downloadExcelBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const copyJsonBtn = document.getElementById("copyJsonBtn");
const fileUploadInput = document.getElementById("fileUploadInput");

// Modals
const themeToggleBtn = document.getElementById("themeToggleBtn");
const historyModalBtn = document.getElementById("historyModalBtn");
const historyModal = document.getElementById("historyModal");
const closeHistoryModalBtn = document.getElementById("closeHistoryModalBtn");
const savedSheetsList = document.getElementById("savedSheetsList");

const leadModal = document.getElementById("leadModal");
const closeLeadModalBtn = document.getElementById("closeLeadModalBtn");
const modalLeadName = document.getElementById("modalLeadName");
const modalLeadCategory = document.getElementById("modalLeadCategory");
const modalLeadDistance = document.getElementById("modalLeadDistance");
const modalLeadRating = document.getElementById("modalLeadRating");
const modalLeadPhone = document.getElementById("modalLeadPhone");
const modalLeadEmail = document.getElementById("modalLeadEmail");
const modalLeadAddress = document.getElementById("modalLeadAddress");
const modalSocialsSection = document.getElementById("modalSocialsSection");
const modalSocialsRow = document.getElementById("modalSocialsRow");
const modalWhatsAppBtn = document.getElementById("modalWhatsAppBtn");
const modalCallBtn = document.getElementById("modalCallBtn");
const modalMapsBtn = document.getElementById("modalMapsBtn");
const modalWebBtn = document.getElementById("modalWebBtn");

// Toast
const toastContainer = document.getElementById("toastContainer");

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    setDynamicGreeting();
    detectUserLocation();
    setupEventListeners();
    initViewMode();
    updateMetrics();
});

function initTheme() {
    // Default to 'light' per user request
    const savedTheme = localStorage.getItem("maplead_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    themeToggleBtn.innerHTML = theme === "dark" 
        ? '<i class="fa-solid fa-sun"></i>' 
        : '<i class="fa-solid fa-moon"></i>';
    themeToggleBtn.title = theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode";
}

function initViewMode() {
    if (window.innerWidth <= 768) {
        setViewMode("cards");
    } else {
        setViewMode("table");
    }
}

function setViewMode(mode) {
    currentViewMode = mode;
    if (mode === "cards") {
        tableScrollContainer.style.display = "none";
        leadsCardsContainer.style.display = "grid";
        if (tableViewBtn) tableViewBtn.classList.remove("active");
        if (cardViewBtn) cardViewBtn.classList.add("active");
        if (mobileCardsBtn) mobileCardsBtn.classList.add("active");
        if (mobileTableBtn) mobileTableBtn.classList.remove("active");
    } else {
        tableScrollContainer.style.display = "block";
        leadsCardsContainer.style.display = "none";
        if (cardViewBtn) cardViewBtn.classList.remove("active");
        if (tableViewBtn) tableViewBtn.classList.add("active");
        if (mobileTableBtn) mobileTableBtn.classList.add("active");
        if (mobileCardsBtn) mobileCardsBtn.classList.remove("active");
    }
    renderTable();
}

function setDynamicGreeting() {
    const hour = new Date().getHours();
    let timeGreeting = "Good day";
    if (hour < 12) timeGreeting = "Good morning";
    else if (hour < 17) timeGreeting = "Good afternoon";
    else timeGreeting = "Good evening";

    humanGreeting.innerHTML = `👋 ${timeGreeting}! Ready to discover accurate 50km leads?`;
}

// --- Geolocation Detection ---
async function detectUserLocation() {
    navLocationText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';

    // 1. Try Browser HTML5 Geolocation API
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                userLocation.lat = lat;
                userLocation.lng = lng;

                try {
                    const rev = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
                        headers: { "Accept-Language": "en" }
                    });
                    if (rev.ok) {
                        const geo = await rev.json();
                        const city = geo.address.city || geo.address.town || geo.address.suburb || geo.address.state_district || "Nearby City";
                        const state = geo.address.state || "";
                        userLocation.city = city;
                        userLocation.region = state;
                        userLocation.displayName = `${city}${state ? ', ' + state : ''}`;
                    } else {
                        userLocation.displayName = `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
                    }
                } catch {
                    userLocation.displayName = `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
                }

                updateLocationUI();
                showToast(`📍 Location: ${userLocation.displayName}`, "success");
            },
            async (err) => {
                console.warn("GPS unavailable, fallback to IP location...", err);
                await fallbackIpLocation();
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    } else {
        await fallbackIpLocation();
    }
}

async function fallbackIpLocation() {
    try {
        const res = await fetch("/api/locate");
        if (res.ok) {
            const data = await res.json();
            userLocation.lat = data.latitude;
            userLocation.lng = data.longitude;
            userLocation.city = data.city;
            userLocation.region = data.region;
            userLocation.displayName = `${data.city}${data.region ? ', ' + data.region : ''}`;
            updateLocationUI();
            showToast(`📍 Location: ${userLocation.displayName}`, "info");
            return;
        }
    } catch (e) {
        console.error("IP fallback error:", e);
    }

    userLocation.displayName = "Current Location (50km)";
    navLocationText.textContent = userLocation.displayName;
}

function updateLocationUI() {
    navLocationText.textContent = userLocation.displayName;
    const rad = radiusInput.value || 50;
    radarDistanceLabel.textContent = `${rad}km Radar Active`;
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Theme Switcher
    themeToggleBtn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("maplead_theme", next);
        updateThemeIcon(next);
    });

    // Refresh GPS
    refreshLocationBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        detectUserLocation();
    });
    navLocationPill.addEventListener("click", detectUserLocation);

    // Hero Button
    heroNearMeBtn.addEventListener("click", () => {
        nearMeToggle.checked = true;
        radiusInput.value = "50";
        selectRadiusChip("50");
        if (!queryInput.value.includes("near me")) {
            queryInput.value = queryInput.value.trim() ? `${queryInput.value.trim()} near me` : "Gyms near me";
        }
        startScraping();
    });

    // Near Me Toggle
    nearMeToggle.addEventListener("change", () => {
        const isActive = nearMeToggle.checked;
        radarActiveBadge.style.display = isActive ? "flex" : "none";
        if (isActive && !queryInput.value.includes("near me")) {
            queryInput.value = queryInput.value.trim() ? `${queryInput.value.trim()} near me` : "Gyms near me";
        }
    });

    // Radius Chips
    radiusChips.forEach(chip => {
        chip.addEventListener("click", () => {
            const rad = chip.getAttribute("data-radius");
            selectRadiusChip(rad);
        });
    });

    // Limit Slider
    limitInput.addEventListener("input", (e) => {
        limitValueText.textContent = e.target.value;
    });

    // Query Clear Button
    queryInput.addEventListener("input", () => {
        clearQueryBtn.style.display = queryInput.value.trim() ? "block" : "none";
    });
    clearQueryBtn.addEventListener("click", () => {
        queryInput.value = "";
        clearQueryBtn.style.display = "none";
        queryInput.focus();
    });

    // Category Presets
    document.querySelectorAll(".chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const niche = chip.getAttribute("data-niche");
            if (nearMeToggle.checked) {
                queryInput.value = `${niche} near me`;
            } else {
                queryInput.value = userLocation.city ? `${niche} in ${userLocation.city}` : niche;
            }
            clearQueryBtn.style.display = "block";
            queryInput.focus();
        });
    });

    // Toggle Terminal
    toggleTerminalBtn.addEventListener("click", () => {
        const isHidden = terminalLogBox.style.display === "none";
        terminalLogBox.style.display = isHidden ? "block" : "none";
        terminalChevron.className = isHidden ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down";
    });

    clearLogsBtn.addEventListener("click", () => {
        logContent.innerHTML = "";
    });

    // Scrape Controls
    startScrapeBtn.addEventListener("click", startScraping);
    stopScrapeBtn.addEventListener("click", stopScraping);

    // Export Dropdown
    exportDropdownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
        if (!exportDropdownBtn.contains(e.target)) {
            exportMenu.classList.remove("show");
        }
    });

    downloadExcelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        exportMenu.classList.remove("show");
        downloadFile("/api/export/excel", "xlsx");
    });

    downloadCsvBtn.addEventListener("click", (e) => {
        e.preventDefault();
        exportMenu.classList.remove("show");
        downloadFile("/api/export/csv", "csv");
    });

    copyJsonBtn.addEventListener("click", (e) => {
        e.preventDefault();
        exportMenu.classList.remove("show");
        navigator.clipboard.writeText(JSON.stringify(leadsData, null, 2));
        showToast("Copied all records to clipboard as JSON!", "success");
    });

    // View Mode Switcher
    if (tableViewBtn) {
        tableViewBtn.addEventListener("click", () => setViewMode("table"));
    }
    if (cardViewBtn) {
        cardViewBtn.addEventListener("click", () => setViewMode("cards"));
    }

    // Mobile Bottom Bar Actions
    if (mobileScanBtn) {
        mobileScanBtn.addEventListener("click", () => {
            window.scrollTo({ top: queryInput.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
            queryInput.focus();
        });
    }
    if (mobileCardsBtn) {
        mobileCardsBtn.addEventListener("click", () => {
            setViewMode("cards");
            leadsCardsContainer.scrollIntoView({ behavior: 'smooth' });
        });
    }
    if (mobileTableBtn) {
        mobileTableBtn.addEventListener("click", () => {
            setViewMode("table");
            tableScrollContainer.scrollIntoView({ behavior: 'smooth' });
        });
    }
    if (mobileExportBtn) {
        mobileExportBtn.addEventListener("click", () => {
            downloadFile("/api/export/excel", "xlsx");
        });
    }
    if (mobileSavedBtn) {
        mobileSavedBtn.addEventListener("click", openHistoryModal);
    }

    // Table Filtering
    tableFilterInput.addEventListener("input", (e) => {
        activeFilterText = e.target.value.toLowerCase().trim();
        renderTable();
    });

    quickFilterPills.forEach(pill => {
        pill.addEventListener("click", () => {
            quickFilterPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            activeQuickFilter = pill.getAttribute("data-filter");
            renderTable();
        });
    });

    // Table Row Actions
    addRowBtn.addEventListener("click", addBlankRow);
    deleteRowBtn.addEventListener("click", deleteSelectedRows);
    clearAllTableBtn.addEventListener("click", clearTableData);
    saveSheetBtn.addEventListener("click", saveSheetToServer);

    // Select All Checkbox
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener("change", (e) => {
            const checkboxes = document.querySelectorAll(".row-select-checkbox");
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
                const tr = cb.closest("tr");
                if (tr) tr.classList.toggle("row-selected", cb.checked);
            });
        });
    }

    // File Import
    fileUploadInput.addEventListener("change", handleFileUpload);

    // Saved Sheets Modal
    historyModalBtn.addEventListener("click", openHistoryModal);
    closeHistoryModalBtn.addEventListener("click", closeHistoryModal);
    historyModal.addEventListener("click", (e) => {
        if (e.target === historyModal) closeHistoryModal();
    });

    // Lead Dossier Modal
    closeLeadModalBtn.addEventListener("click", closeLeadModal);
    leadModal.addEventListener("click", (e) => {
        if (e.target === leadModal) closeLeadModal();
    });

    // Sort Headers
    document.querySelectorAll(".leads-table th[data-sort]").forEach(th => {
        th.addEventListener("click", () => {
            const col = th.getAttribute("data-sort");
            if (currentSortColumn === col) {
                sortAscending = !sortAscending;
            } else {
                currentSortColumn = col;
                sortAscending = true;
            }
            sortTableData(col, sortAscending);
            renderTable();
        });
    });
}

function selectRadiusChip(rad) {
    radiusInput.value = rad;
    radiusChips.forEach(c => {
        c.classList.toggle("active", c.getAttribute("data-radius") === String(rad));
    });
    radarDistanceLabel.textContent = `${rad}km Radar Active`;
}

// --- Scraping Engine Controller ---
async function startScraping() {
    let query = queryInput.value.trim();
    if (!query) {
        showToast("Please enter a category or query to scrape!", "error");
        queryInput.focus();
        return;
    }

    const isNearMe = nearMeToggle.checked;
    const radiusKm = parseFloat(radiusInput.value) || 50.0;
    const strictRadius = strictRadiusCheck.checked;
    const limit = parseInt(limitInput.value) || 25;
    const headless = headlessCheck.checked;
    const enrichLead = enrichLeadCheck.checked;

    setJobState("running", "Scouting Google Maps for accurate leads...");
    startScrapeBtn.style.display = "none";
    stopScrapeBtn.style.display = "inline-flex";
    progressContainer.style.display = "block";
    progressBarFill.style.width = "5%";
    progressPercent.textContent = "5%";
    progressMessage.textContent = "Connecting to Google Maps & setting perimeter...";

    if (isNearMe) {
        radarVisualContainer.style.display = "flex";
        radarScanStatus.textContent = `Scanning ${radiusKm}km radius around ${userLocation.displayName || "your location"}...`;
        radarFoundCounter.textContent = "0";
        radarBlipsContainer.innerHTML = "";
    } else {
        radarVisualContainer.style.display = "none";
    }

    appendLog(`[System] Initializing scraper for query: '${query}' | Radius: ${radiusKm}km | Strict: ${strictRadius}`);
    if (userLocation.lat && userLocation.lng) {
        appendLog(`[GPS] Centered at coordinates: (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`);
    }

    try {
        const response = await fetch("/api/scrape/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query,
                limit,
                headless,
                enrich_lead: enrichLead,
                user_lat: userLocation.lat,
                user_lng: userLocation.lng,
                radius_km: radiusKm,
                strict_radius: strictRadius,
                near_me: isNearMe,
                location_name: userLocation.displayName
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Failed to start scraping");
        }

        const data = await response.json();
        currentJobId = data.job_id;
        appendLog(`[Job] Background task created: ID ${currentJobId}`);
        listenToStream(currentJobId);

    } catch (error) {
        setJobState("idle", "Ready");
        startScrapeBtn.style.display = "inline-flex";
        stopScrapeBtn.style.display = "none";
        progressContainer.style.display = "none";
        radarVisualContainer.style.display = "none";
        showToast(error.message, "error");
        appendLog(`[Error] ${error.message}`);
    }
}

function listenToStream(jobId) {
    if (eventSource) {
        eventSource.close();
    }

    eventSource = new EventSource(`/api/scrape/stream/${jobId}`);

    eventSource.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            handleStreamEvent(payload);
        } catch (e) {
            console.error("Stream parse error:", e);
        }
    };

    eventSource.onerror = () => {
        appendLog("[Connection] SSE stream finished or disconnected.");
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        finishScrapeJob();
    };
}

function handleStreamEvent(event) {
    const type = event.type;
    const msg = event.message || "";
    const prog = event.progress || 0;
    const lead = event.data;

    if (prog) {
        progressBarFill.style.width = `${prog}%`;
        progressPercent.textContent = `${prog}%`;
    }

    if (msg) {
        progressMessage.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${escapeHtml(msg)}`;
        appendLog(msg);
    }

    if (type === "init") {
        if (event.leads && event.leads.length > 0) {
            event.leads.forEach(l => addLeadToData(l));
        }
    } else if (type === "lead" && lead) {
        addLeadToData(lead);
        addRadarBlip();
        showToast(`📍 Found: ${lead.name} (${lead.distance_text || "nearby"})`, "info");
    } else if (type === "complete") {
        finishScrapeJob();
        showToast(msg || "Extraction complete!", "success");
    } else if (type === "error") {
        finishScrapeJob();
        showToast(msg || "An error occurred during scraping", "error");
    } else if (type === "end") {
        finishScrapeJob();
    }
}

async function stopScraping() {
    if (!currentJobId) return;
    try {
        await fetch(`/api/scrape/stop/${currentJobId}`, { method: "POST" });
        showToast("Stopping scraper session...", "info");
    } catch (e) {
        console.error("Stop error:", e);
    }
}

function finishScrapeJob() {
    setJobState("success", "Completed");
    startScrapeBtn.style.display = "inline-flex";
    stopScrapeBtn.style.display = "none";
    progressBarFill.style.width = "100%";
    progressPercent.textContent = "100%";
    progressMessage.textContent = "Scraping completed. All verified records loaded.";
    
    setTimeout(() => {
        if (radarVisualContainer) radarVisualContainer.style.display = "none";
    }, 4000);

    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
}

function setJobState(status, text) {
    jobStatusBadge.className = `status-pill status-${status}`;
    jobStatusText.textContent = text;
}

function appendLog(line) {
    const p = document.createElement("div");
    p.className = "log-line";
    p.textContent = line;
    logContent.appendChild(p);
    logContent.scrollTop = logContent.scrollHeight;
}

function addRadarBlip() {
    if (!radarBlipsContainer) return;
    const blip = document.createElement("div");
    blip.className = "radar-blip";
    const angle = Math.random() * Math.PI * 2;
    const distance = 15 + Math.random() * 65;
    const x = 90 + Math.cos(angle) * distance;
    const y = 90 + Math.sin(angle) * distance;
    blip.style.left = `${x}px`;
    blip.style.top = `${y}px`;
    radarBlipsContainer.appendChild(blip);

    if (radarFoundCounter) {
        radarFoundCounter.textContent = leadsData.length;
    }
}

// --- Data & Table / Card Management ---
function addLeadToData(lead) {
    const exists = leadsData.some(l => 
        (l.maps_url && l.maps_url === lead.maps_url) ||
        (l.name.toLowerCase() === lead.name.toLowerCase() && l.phone === lead.phone && l.phone !== "N/A")
    );
    if (!exists) {
        lead.id = leadsData.length + 1;
        leadsData.push(lead);
        updateMetrics();
        renderTable();
    }
}

function updateMetrics() {
    const total = leadsData.length;
    statTotalLeads.textContent = total;
    
    const within50 = leadsData.filter(l => l.distance_km !== null && l.distance_km <= 50.0).length;
    statWithinRadius.textContent = within50;

    const waCount = leadsData.filter(l => l.whatsapp && l.whatsapp.startsWith("http")).length;
    statWhatsApp.textContent = waCount;

    const phoneCount = leadsData.filter(l => l.phone && l.phone !== "N/A").length;
    statPhones.textContent = phoneCount;

    const emailCount = leadsData.filter(l => l.email && l.email.trim()).length;
    statEmails.textContent = emailCount;

    tableRowCount.textContent = `${total} records`;
}

function renderTable() {
    // Filter rows
    let filtered = leadsData.filter(lead => {
        if (activeQuickFilter === "50km") {
            if (lead.distance_km === null || lead.distance_km > 50.0) return false;
        } else if (activeQuickFilter === "whatsapp") {
            if (!lead.whatsapp) return false;
        } else if (activeQuickFilter === "email") {
            if (!lead.email) return false;
        }

        if (!activeFilterText) return true;
        const haystack = `${lead.name} ${lead.category} ${lead.phone} ${lead.email} ${lead.address} ${lead.distance_text} ${lead.notes}`.toLowerCase();
        return haystack.includes(activeFilterText);
    });

    filteredCountText.textContent = `Showing ${filtered.length} of ${leadsData.length} leads`;

    // Handle Empty State
    if (filtered.length === 0) {
        const emptyHtml = `
            <div class="empty-state">
                <div class="empty-radar-circle">
                    <i class="fa-solid fa-satellite-dish"></i>
                </div>
                <h4>No matching leads found</h4>
                <p>Try clearing filters or tap <strong>"Scan 50km Near Me"</strong> to discover businesses!</p>
            </div>
        `;
        leadsTableBody.innerHTML = `<tr><td colspan="15">${emptyHtml}</td></tr>`;
        leadsCardsContainer.innerHTML = emptyHtml;
        return;
    }

    // Render Table View
    leadsTableBody.innerHTML = "";
    filtered.forEach((lead) => {
        const tr = document.createElement("tr");
        tr.setAttribute("data-id", lead.id);

        let distBadge = `<span class="distance-pill dist-close"><i class="fa-solid fa-location-arrow"></i> Nearby</span>`;
        if (lead.distance_km !== null && lead.distance_km !== undefined) {
            const d = lead.distance_km;
            let distClass = "dist-close";
            if (d > 50) distClass = "dist-out";
            else if (d > 30) distClass = "dist-far";
            else if (d > 10) distClass = "dist-mid";
            distBadge = `<span class="distance-pill ${distClass}"><i class="fa-solid fa-location-arrow"></i> ${d} km</span>`;
        }

        const ratingHtml = lead.rating && lead.rating !== "N/A"
            ? `<span class="rating-pill"><i class="fa-solid fa-star"></i> ${lead.rating}</span>`
            : `<span class="text-muted">N/A</span>`;

        let waButton = `<span class="text-muted">-</span>`;
        if (lead.whatsapp && lead.whatsapp.startsWith("http")) {
            const prefilledMsg = encodeURIComponent(`Hello ${lead.name}, I found your business on Google Maps and would like to inquire about your services.`);
            waButton = `
                <a href="${lead.whatsapp}?text=${prefilledMsg}" target="_blank" class="btn-table-wa" title="Open 1-Click WhatsApp Chat">
                    <i class="fa-brands fa-whatsapp"></i> Chat
                </a>
            `;
        }

        const webHtml = lead.website && lead.website.startsWith("http")
            ? `<a href="${lead.website}" target="_blank" class="btn-text" title="${lead.website}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Visit</a>`
            : `<span class="text-muted">None</span>`;

        tr.innerHTML = `
            <td><input type="checkbox" class="row-select-checkbox" data-id="${lead.id}"></td>
            <td><strong>${lead.id}</strong></td>
            <td>
                <div class="editable-cell font-bold" contenteditable="true" data-field="name">${escapeHtml(lead.name)}</div>
            </td>
            <td>${distBadge}</td>
            <td><div class="editable-cell" contenteditable="true" data-field="category">${escapeHtml(lead.category || "")}</div></td>
            <td>${ratingHtml}</td>
            <td><div class="editable-cell font-mono" contenteditable="true" data-field="reviews">${escapeHtml(lead.reviews || "0")}</div></td>
            <td><div class="editable-cell font-mono" contenteditable="true" data-field="phone">${escapeHtml(lead.phone || "N/A")}</div></td>
            <td>${waButton}</td>
            <td><div class="editable-cell text-cyan" contenteditable="true" data-field="email">${escapeHtml(lead.email || "")}</div></td>
            <td>${webHtml}</td>
            <td><div class="editable-cell text-secondary" contenteditable="true" data-field="address">${escapeHtml(lead.address || "N/A")}</div></td>
            <td>
                <select class="status-select" data-id="${lead.id}">
                    <option value="New" ${lead.status === "New" ? "selected" : ""}>New</option>
                    <option value="Contacted" ${lead.status === "Contacted" ? "selected" : ""}>Contacted</option>
                    <option value="Interested" ${lead.status === "Interested" ? "selected" : ""}>Interested</option>
                    <option value="Closed" ${lead.status === "Closed" ? "selected" : ""}>Closed</option>
                    <option value="Do Not Contact" ${lead.status === "Do Not Contact" ? "selected" : ""}>DNC</option>
                </select>
            </td>
            <td><div class="editable-cell text-muted" contenteditable="true" data-field="notes">${escapeHtml(lead.notes || "")}</div></td>
            <td>
                <div class="action-cell">
                    <button type="button" class="action-icon-btn action-view-btn" title="View Full Dossier" onclick="openLeadModal(${lead.id})">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    ${lead.phone && lead.phone !== 'N/A' ? `
                    <a href="tel:${lead.phone}" class="action-icon-btn" title="Call">
                        <i class="fa-solid fa-phone"></i>
                    </a>` : ''}
                    ${lead.maps_url ? `
                    <a href="${lead.maps_url}" target="_blank" class="action-icon-btn" title="View on Google Maps">
                        <i class="fa-solid fa-map-location-dot"></i>
                    </a>` : ''}
                </div>
            </td>
        `;

        tr.querySelectorAll(".editable-cell").forEach(cell => {
            cell.addEventListener("blur", () => {
                const field = cell.getAttribute("data-field");
                const val = cell.innerText.trim();
                lead[field] = val;
                if (field === "phone") {
                    const cleanDigits = val.replace(/\D/g, "");
                    if (cleanDigits.length >= 10) {
                        lead.whatsapp = `https://wa.me/91${cleanDigits.slice(-10)}`;
                    }
                }
                updateMetrics();
            });
        });

        const statusSelect = tr.querySelector(".status-select");
        if (statusSelect) {
            statusSelect.addEventListener("change", (e) => {
                lead.status = e.target.value;
            });
        }

        const cb = tr.querySelector(".row-select-checkbox");
        cb.addEventListener("change", () => {
            tr.classList.toggle("row-selected", cb.checked);
        });

        leadsTableBody.appendChild(tr);
    });

    // Render Mobile Cards View
    leadsCardsContainer.innerHTML = "";
    filtered.forEach((lead) => {
        const card = document.createElement("div");
        card.className = "lead-mobile-card";

        let distBadge = `<span class="distance-pill dist-close"><i class="fa-solid fa-location-arrow"></i> Nearby</span>`;
        if (lead.distance_km !== null && lead.distance_km !== undefined) {
            const d = lead.distance_km;
            let distClass = "dist-close";
            if (d > 50) distClass = "dist-out";
            else if (d > 30) distClass = "dist-far";
            else if (d > 10) distClass = "dist-mid";
            distBadge = `<span class="distance-pill ${distClass}"><i class="fa-solid fa-location-arrow"></i> ${d} km</span>`;
        }

        const ratingHtml = lead.rating && lead.rating !== "N/A"
            ? `<span class="rating-pill"><i class="fa-solid fa-star"></i> ${lead.rating} (${lead.reviews})</span>`
            : ``;

        const waHref = lead.whatsapp && lead.whatsapp.startsWith("http")
            ? `${lead.whatsapp}?text=${encodeURIComponent(`Hello ${lead.name}, I found your business on Google Maps and wanted to inquire about your services.`)}`
            : (lead.phone && lead.phone !== "N/A" ? `https://wa.me/91${lead.phone.replace(/\D/g, '').slice(-10)}` : null);

        card.innerHTML = `
            <div class="lead-card-top">
                <div>
                    <h4 class="lead-card-title">${escapeHtml(lead.name)}</h4>
                    <div class="lead-card-category">${escapeHtml(lead.category || "Local Business")}</div>
                </div>
                ${distBadge}
            </div>

            <div class="lead-card-meta-row">
                ${ratingHtml}
                ${lead.phone && lead.phone !== 'N/A' ? `<span><i class="fa-solid fa-phone" style="color: var(--primary);"></i> <strong>${escapeHtml(lead.phone)}</strong></span>` : ''}
                ${lead.email ? `<span><i class="fa-solid fa-envelope" style="color: var(--accent-cyan);"></i> ${escapeHtml(lead.email)}</span>` : ''}
            </div>

            ${lead.address && lead.address !== 'N/A' ? `
            <div class="lead-card-address">
                <i class="fa-solid fa-map-pin"></i>
                <span>${escapeHtml(lead.address)}</span>
            </div>` : ''}

            <div class="lead-card-actions">
                ${waHref ? `
                <a href="${waHref}" target="_blank" class="lead-card-wa-btn">
                    <i class="fa-brands fa-whatsapp"></i> Chat
                </a>` : ''}
                
                <button type="button" class="btn btn-secondary btn-sm" onclick="openLeadModal(${lead.id})" title="Details">
                    <i class="fa-solid fa-eye"></i> Details
                </button>
                
                ${lead.phone && lead.phone !== 'N/A' ? `
                <a href="tel:${lead.phone}" class="action-icon-btn" title="Call">
                    <i class="fa-solid fa-phone"></i>
                </a>` : ''}

                ${lead.maps_url ? `
                <a href="${lead.maps_url}" target="_blank" class="action-icon-btn" title="Maps">
                    <i class="fa-solid fa-map-location-dot"></i>
                </a>` : ''}
            </div>
        `;

        leadsCardsContainer.appendChild(card);
    });
}

// --- Sorting ---
function sortTableData(column, ascending) {
    leadsData.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        if (column === "distance_km") {
            valA = (valA !== null && valA !== undefined) ? valA : 999999;
            valB = (valB !== null && valB !== undefined) ? valB : 999999;
            return ascending ? valA - valB : valB - valA;
        }

        if (column === "rating" || column === "reviews" || column === "id") {
            const numA = parseFloat(String(valA).replace(/[^0-9.]/g, "")) || 0;
            const numB = parseFloat(String(valB).replace(/[^0-9.]/g, "")) || 0;
            return ascending ? numA - numB : numB - numA;
        }

        valA = String(valA || "").toLowerCase();
        valB = String(valB || "").toLowerCase();
        return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
}

// --- Lead Dossier Modal ---
window.openLeadModal = function(id) {
    const lead = leadsData.find(l => l.id === id);
    if (!lead) return;

    modalLeadName.textContent = lead.name;
    modalLeadCategory.textContent = lead.category || "Local Business";
    modalLeadDistance.textContent = lead.distance_text || (lead.distance_km ? `${lead.distance_km} km away` : "Nearby");
    modalLeadRating.innerHTML = lead.rating !== "N/A" ? `⭐ ${lead.rating} (${lead.reviews} reviews)` : "N/A";
    modalLeadPhone.textContent = lead.phone || "N/A";
    modalLeadEmail.textContent = lead.email || "Not found";
    modalLeadAddress.textContent = lead.address || "Address not provided";

    modalSocialsRow.innerHTML = "";
    let hasSocials = false;
    ['instagram', 'facebook', 'linkedin', 'twitter'].forEach(soc => {
        if (lead[soc] && lead[soc].startsWith("http")) {
            hasSocials = true;
            const a = document.createElement("a");
            a.href = lead[soc];
            a.target = "_blank";
            a.className = "btn btn-glass btn-sm";
            a.innerHTML = `<i class="fa-brands fa-${soc}"></i> ${soc.toUpperCase()}`;
            modalSocialsRow.appendChild(a);
        }
    });
    modalSocialsSection.style.display = hasSocials ? "block" : "none";

    if (lead.whatsapp && lead.whatsapp.startsWith("http")) {
        modalWhatsAppBtn.style.display = "inline-flex";
        const msg = encodeURIComponent(`Hello ${lead.name}, I saw your profile and would love to connect regarding your services!`);
        modalWhatsAppBtn.href = `${lead.whatsapp}?text=${msg}`;
    } else {
        modalWhatsAppBtn.style.display = "none";
    }

    if (lead.phone && lead.phone !== "N/A") {
        modalCallBtn.style.display = "inline-flex";
        modalCallBtn.href = `tel:${lead.phone}`;
    } else {
        modalCallBtn.style.display = "none";
    }

    if (lead.maps_url) {
        modalMapsBtn.style.display = "inline-flex";
        modalMapsBtn.href = lead.maps_url;
    } else {
        modalMapsBtn.style.display = "none";
    }

    if (lead.website && lead.website.startsWith("http")) {
        modalWebBtn.style.display = "inline-flex";
        modalWebBtn.href = lead.website;
    } else {
        modalWebBtn.style.display = "none";
    }

    leadModal.style.display = "flex";
};

function closeLeadModal() {
    leadModal.style.display = "none";
}

// --- Spreadsheet Actions ---
function addBlankRow() {
    const newLead = {
        id: leadsData.length + 1,
        name: "New Business Lead",
        distance_km: 0,
        distance_text: "0 km",
        category: "General",
        rating: "5.0",
        reviews: "1",
        phone: "",
        whatsapp: "",
        email: "",
        website: "",
        address: userLocation.displayName || "",
        status: "New",
        notes: "Manually added lead"
    };
    leadsData.unshift(newLead);
    updateMetrics();
    renderTable();
    showToast("Added new editable row to top of sheet", "info");
}

function deleteSelectedRows() {
    const selectedCbs = document.querySelectorAll(".row-select-checkbox:checked");
    if (selectedCbs.length === 0) {
        showToast("Please select at least one row using the checkbox to delete!", "error");
        return;
    }

    const idsToDelete = Array.from(selectedCbs).map(cb => parseInt(cb.getAttribute("data-id")));
    leadsData = leadsData.filter(l => !idsToDelete.includes(l.id));
    leadsData.forEach((l, idx) => l.id = idx + 1);
    
    updateMetrics();
    renderTable();
    showToast(`Deleted ${idsToDelete.length} rows successfully`, "info");
}

function clearTableData() {
    if (leadsData.length === 0) return;
    if (confirm("Are you sure you want to clear all leads from this sheet?")) {
        leadsData = [];
        updateMetrics();
        renderTable();
        showToast("Sheet cleared", "info");
    }
}

// --- File Exports & Imports ---
async function downloadFile(url, ext) {
    if (leadsData.length === 0) {
        showToast("No leads to export! Please scan leads or import a file first.", "error");
        return;
    }

    const title = sheetTitleInput.value.trim() || "50km_Local_Leads";
    const filename = `${title}.${ext}`;

    try {
        showToast(`Preparing ${ext.toUpperCase()} export...`, "info");
        const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leads: leadsData, filename })
        });

        if (!resp.ok) throw new Error("Export request failed");

        const blob = await resp.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        showToast(`Downloaded ${filename} successfully!`, "success");
    } catch (e) {
        showToast(`Failed to export ${ext}: ${e.message}`, "error");
    }
}

async function saveSheetToServer() {
    if (leadsData.length === 0) {
        showToast("Nothing to save! Sheet is currently empty.", "error");
        return;
    }

    const title = sheetTitleInput.value.trim() || `Leads_50km_${Date.now()}`;
    try {
        const resp = await fetch("/api/saved-sheets/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leads: leadsData, filename: title })
        });
        const res = await resp.json();
        if (res.success) {
            showToast(res.message, "success");
        } else {
            throw new Error(res.error || "Save failed");
        }
    } catch (e) {
        showToast(`Error saving sheet: ${e.message}`, "error");
    }
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    showToast(`Importing ${file.name}...`, "info");
    try {
        const resp = await fetch("/api/import", {
            method: "POST",
            body: formData
        });
        const res = await resp.json();
        if (res.success && res.leads) {
            leadsData = res.leads;
            sheetTitleInput.value = file.name.replace(/\.[^/.]+$/, "");
            updateMetrics();
            renderTable();
            showToast(`Imported ${res.total} records from ${file.name}!`, "success");
        } else {
            throw new Error(res.error || "Import failed");
        }
    } catch (err) {
        showToast(`Failed to import file: ${err.message}`, "error");
    } finally {
        fileUploadInput.value = "";
    }
}

// --- History & Saved Sheets Modal ---
async function openHistoryModal() {
    historyModal.style.display = "flex";
    savedSheetsList.innerHTML = `<div class="text-center py-4 text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Loading saved sheets...</div>`;
    
    try {
        const resp = await fetch("/api/saved-sheets");
        const res = await resp.json();
        if (res.files && res.files.length > 0) {
            savedSheetsList.innerHTML = "";
            res.files.forEach(f => {
                const item = document.createElement("div");
                item.className = "saved-sheet-item";
                item.innerHTML = `
                    <div>
                        <strong><i class="fa-solid fa-file-excel color-excel"></i> ${escapeHtml(f.filename)}</strong>
                        <div class="text-muted" style="font-size: 11px;">Modified: ${f.modified} • Size: ${f.size_kb} KB</div>
                    </div>
                    <button class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrow-down-to-bracket"></i> Load</button>
                `;
                item.addEventListener("click", () => loadSavedFile(f.filename));
                savedSheetsList.appendChild(item);
            });
        } else {
            savedSheetsList.innerHTML = `<div class="text-center py-4 text-muted">No saved sheets found in exports directory.</div>`;
        }
    } catch (e) {
        savedSheetsList.innerHTML = `<div class="text-center py-4 text-danger">Failed to load saved sheets.</div>`;
    }
}

async function loadSavedFile(filename) {
    try {
        showToast(`Loading ${filename}...`, "info");
        const resp = await fetch(`/api/saved-sheets/${encodeURIComponent(filename)}`);
        const res = await resp.json();
        if (res.leads) {
            leadsData = res.leads;
            sheetTitleInput.value = filename.replace(/\.[^/.]+$/, "");
            updateMetrics();
            renderTable();
            closeHistoryModal();
            showToast(`Loaded ${res.total} leads from ${filename}`, "success");
        }
    } catch (e) {
        showToast(`Failed to load file: ${e.message}`, "error");
    }
}

function closeHistoryModal() {
    historyModal.style.display = "none";
}

// --- Utilities ---
function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    else if (type === "error") icon = "fa-triangle-exclamation";

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
