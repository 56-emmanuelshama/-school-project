
// ==================================
// SUPABASE CONFIGURATION
// ==================================

const SUPABASE_URL = "https://wqszwijxuiomyrguyhrx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1FqMpDgBFBn8oMEi-M5c9g_-wJjQ5z4";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);


// ==================================
// PAGE ELEMENTS
// ==================================

const adminName = document.getElementById("adminName");
const profileEmail = document.getElementById("profileEmail");
const logoutButton = document.getElementById("logoutButton");


// ==================================
// ADMIN AUTHENTICATION
// ==================================

async function checkAdminAccess() {

    const { data: sessionData, error: sessionError } =
        await supabaseClient.auth.getSession();

    if (sessionError || !sessionData.session) {
        window.location.replace("index.html");
        return false;
    }

    const user = sessionData.session.user;

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("full_name, role")
            .eq("id", user.id)
            .single();

    if (profileError || !profile || profile.role !== "admin") {

        alert("Access denied. Administrator privileges are required.");

        await supabaseClient.auth.signOut();

        window.location.replace("login.html");

        return false;
    }

    adminName.textContent = profile.full_name || "Administrator";
    profileEmail.textContent = user.email || "Email unavailable";

    return true;
}


// ==================================
// LOAD DASHBOARD STATISTICS
// ==================================

async function loadDashboardStats() {

    const totalUsersElement = document.getElementById("totalUsers");
    const totalClaimsElement = document.getElementById("totalClaims");
    const pendingClaimsElement = document.getElementById("pendingClaims");
    const approvedClaimsElement = document.getElementById("approvedClaims");

    const { count: totalUsers, error: usersError } =
        await supabaseClient
            .from("profiles")
            .select("*", { count: "exact", head: true });

    const { data: claims, error: claimsError } =
        await supabaseClient
            .from("claims")
            .select("status");

    if (usersError || claimsError) {
        totalUsersElement.textContent = "Error";
        totalClaimsElement.textContent = "Error";
        pendingClaimsElement.textContent = "Error";
        approvedClaimsElement.textContent = "Error";

        console.error("Dashboard loading error:", usersError || claimsError);
        return;
    }

    const pending = claims.filter(
        claim => (claim.status || "").toLowerCase() === "pending"
    ).length;

    const approved = claims.filter(
        claim => (claim.status || "").toLowerCase() === "approved"
    ).length;

    totalUsersElement.textContent = totalUsers ?? 0;
    totalClaimsElement.textContent = claims.length;
    pendingClaimsElement.textContent = pending;
    approvedClaimsElement.textContent = approved;
}


// ==================================
// LOAD RECENT CLAIMS
// ==================================

async function loadRecentClaims() {

    const tableBody = document.getElementById("recentClaims");

    const { data: claims, error } = await supabaseClient
        .from("claims")
        .select("claim_number, title, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

    tableBody.replaceChildren();

    if (error) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.textContent = "Unable to load claims. Check database permissions.";

        row.appendChild(cell);
        tableBody.appendChild(row);

        console.error("Claims loading error:", error);
        return;
    }

    if (!claims || claims.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.textContent = "No claims have been submitted yet.";

        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    claims.forEach(claim => {

        const row = document.createElement("tr");

        const claimNumberCell = document.createElement("td");
        claimNumberCell.textContent = claim.claim_number || "N/A";

        const titleCell = document.createElement("td");
        titleCell.textContent = claim.title || "Untitled claim";

        const statusCell = document.createElement("td");
        const statusBadge = document.createElement("span");

        const status = (claim.status || "unknown").toLowerCase();

        statusBadge.className = "status " + status;
        statusBadge.textContent = claim.status || "Unknown";

        statusCell.appendChild(statusBadge);

        const dateCell = document.createElement("td");

        dateCell.textContent = claim.created_at
            ? new Date(claim.created_at).toLocaleDateString()
            : "N/A";

        row.append(
            claimNumberCell,
            titleCell,
            statusCell,
            dateCell
        );

        tableBody.appendChild(row);
    });
}


// ==================================
// SIDEBAR NAVIGATION
// ==================================

const navigationLinks = document.querySelectorAll(".nav-link");

const sections = document.querySelectorAll(
    ".dashboard-section, .placeholder-section"
);

navigationLinks.forEach(link => {

    link.addEventListener("click", function(event) {

        const targetId = this.getAttribute("href");

        if (!targetId || !targetId.startsWith("#")) return;

        event.preventDefault();

        sections.forEach(section => {
            section.style.display = "none";
        });

        const targetSection = document.querySelector(targetId);

        if (targetSection) {
            targetSection.style.display = "block";
        }

        navigationLinks.forEach(nav => {
            nav.classList.remove("active");
        });

        this.classList.add("active");
    });
});


// ==================================
// LOGOUT
// ==================================

logoutButton.addEventListener("click", async function() {

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("Unable to sign out. Please try again.");
        console.error(error);
        return;
    }

    window.location.replace("index.html");
});


// ==================================
// INITIALIZE ADMIN DASHBOARD
// ==================================

async function initializeDashboard() {

    const authorized = await checkAdminAccess();

    if (!authorized) return;

    await Promise.all([
        loadDashboardStats(),
        loadRecentClaims()
    ]);
}

initializeDashboard();
