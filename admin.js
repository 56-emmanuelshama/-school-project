
// ==================================
// SUPABASE CONFIGURATION
// ==================================

const SUPABASE_URL = "https://wqszwijxuiomyrguyhrx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1FqMpDgBFBn8oMEi-M5c9g_-wJjQ5z4";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);


let currentAdminId = null;

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
   currentAdminId = user.id;

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("full_name, role")
            .eq("id", user.id)
            .single();

    if (profileError || !profile || profile.role !== "admin") {

        alert("Access denied. Administrator privileges are required.");

        await supabaseClient.auth.signOut();

        window.location.replace("index.html");

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
    claim => ["submitted", "under_review"].includes(
        (claim.status || "").toLowerCase()
    )
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
// LOAD AND MANAGE USERS
// ==================================

async function loadUsers() {

    const usersTable = document.getElementById("usersTable");
    const message = document.getElementById("userManagementMessage");

    usersTable.replaceChildren();
    message.textContent = "Loading users...";

    const { data: users, error } = await supabaseClient
        .from("profiles")
        .select("id, full_name, role, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        message.textContent = "Unable to load users.";
        console.error("User loading error:", error);
        return;
    }

    if (!users || users.length === 0) {
        message.textContent = "No registered users found.";
        return;
    }

    users.forEach(user => {

        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = user.full_name || "Unnamed user";

        const roleCell = document.createElement("td");

        const roleSelect = document.createElement("select");

        ["customer", "claims_officer", "admin"].forEach(role => {

            const option = document.createElement("option");

            option.value = role;
            option.textContent = role.replace("_", " ");

            if (user.role === role) {
                option.selected = true;
            }

            roleSelect.appendChild(option);
        });

        roleCell.appendChild(roleSelect);

        const dateCell = document.createElement("td");

        dateCell.textContent = user.created_at
            ? new Date(user.created_at).toLocaleDateString()
            : "N/A";

        const actionCell = document.createElement("td");

        const saveButton = document.createElement("button");

        saveButton.textContent = "Save Role";
        saveButton.type = "button";

        saveButton.addEventListener("click", async () => {

            const newRole = roleSelect.value;

            if (!["customer", "claims_officer", "admin"].includes(newRole)) {
                alert("Invalid role selected.");
                return;
            }

            if (user.id === currentAdminId) {
                alert("You cannot change your own administrator role here.");
                return;
            }

            if (newRole === user.role) {
                alert("This user already has that role.");
                return;
            }

            saveButton.disabled = true;
            saveButton.textContent = "Saving...";

            const { error: updateError } = await supabaseClient
                .from("profiles")
                .update({
                    role: newRole,
                    updated_at: new Date().toISOString()
                })
                .eq("id", user.id);

            if (updateError) {

                alert("Unable to update user role.");

                console.error("Role update error:", updateError);

                saveButton.disabled = false;
                saveButton.textContent = "Save Role";

                return;
            }

            alert("User role updated successfully!");

            await loadUsers();
        });

                actionCell.appendChild(saveButton);

        row.append(
            nameCell,
            roleCell,
            dateCell,
            actionCell
        );

        usersTable.appendChild(row);
    });

    message.textContent = `Showing ${users.length} registered users.`;
}

// ==================================
// REFRESH USERS
// ==================================

document.getElementById("refreshUsersButton")
    .addEventListener("click", loadUsers);
 // ==================================
 // CLAIMS MANAGEMENT
 // ==================================

async function loadClaimsManagement() {

    const table = document.getElementById("claimsManagementTable");
    const message = document.getElementById("claimsManagementMessage");

    table.replaceChildren();
    message.textContent = "Loading claims...";

    const { data: claims, error } = await supabaseClient
        .from("claims")
        .select("id, claim_number, customer_id, title, claim_amount, status, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        message.textContent = "Unable to load claims.";
        console.error("Claims management error:", error);
        return;
    }

    if (!claims || claims.length === 0) {
        message.textContent = "No insurance claims found.";
        return;
    }

    claims.forEach(claim => {

        const row = document.createElement("tr");

        function createCell(value) {
            const cell = document.createElement("td");
            cell.textContent = value ?? "N/A";
            return cell;
        }

        const claimNumberCell = createCell(claim.claim_number);
        const customerCell = createCell(claim.customer_id);
        const titleCell = createCell(claim.title);

        const amountCell = createCell(
            Number(claim.claim_amount || 0).toLocaleString()
        );

        const statusCell = document.createElement("td");
        const statusSelect = document.createElement("select");

        const statuses = [
            "submitted",
            "under_review",
            "approved",
            "rejected",
            "settled"
        ];

        statuses.forEach(status => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status.replace("_", " ");

            if (claim.status === status) {
                option.selected = true;
            }

            statusSelect.appendChild(option);
        });

        statusCell.appendChild(statusSelect);

        const dateCell = createCell(
            claim.created_at
                ? new Date(claim.created_at).toLocaleDateString()
                : "N/A"
        );

        const actionCell = document.createElement("td");
        const saveButton = document.createElement("button");

        saveButton.type = "button";
        saveButton.textContent = "Update";

        saveButton.addEventListener("click", async () => {

            const newStatus = statusSelect.value;

            if (newStatus === claim.status) {
                alert("No status change has been made.");
                return;
            }

            saveButton.disabled = true;
            saveButton.textContent = "Updating...";

            const { error: updateError } = await supabaseClient
                .from("claims")
                .update({
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq("id", claim.id);

            if (updateError) {
                alert("Unable to update claim status.");
                console.error("Claim update error:", updateError);

                saveButton.disabled = false;
                saveButton.textContent = "Update";
                return;
            }

            alert("Claim status updated successfully!");

            await Promise.all([
                loadClaimsManagement(),
                loadDashboardStats(),
                loadRecentClaims()
            ]);
        });

        actionCell.appendChild(saveButton);

        row.append(
            claimNumberCell,
            customerCell,
            titleCell,
            amountCell,
            statusCell,
            dateCell,
            actionCell
        );

        table.appendChild(row);
    });

    message.textContent = `Showing ${claims.length} insurance claims.`;
}

document.getElementById("refreshClaimsButton")
    .addEventListener("click", async function() {
        await Promise.all([
            loadClaimsManagement(),
            loadDashboardStats(),
            loadRecentClaims()
        ]);
    });
// ==================================
// REFRESH CLAIMS
// ==================================

// ==================================
// LOAD AUDIT LOGS
// ==================================

async function loadAuditLogs() {

    const table = document.getElementById("auditLogsTable");
    const message = document.getElementById("auditMessage");

    table.replaceChildren();
    message.textContent = "Loading audit logs...";

    const { data: logs, error } = await supabaseClient
        .from("claim_audit_log")
        .select("id, claim_id, changed_by, old_status, new_status, changed_at")
        .order("changed_at", { ascending: false })
        .limit(100);

    if (error) {
        message.textContent = "Unable to load audit logs.";
        console.error("Audit log error:", error);
        return;
    }

    if (!logs || logs.length === 0) {
        message.textContent = "No audit activity recorded yet.";
        return;
    }

    logs.forEach(log => {

        const row = document.createElement("tr");

        function createCell(value) {
            const cell = document.createElement("td");
            cell.textContent = value || "N/A";
            return cell;
        }

        row.append(
            createCell(log.claim_id),
            createCell(log.changed_by),
            createCell(log.old_status),
            createCell(log.new_status),
            createCell(
                log.changed_at
                    ? new Date(log.changed_at).toLocaleString()
                    : "N/A"
            )
        );

        table.appendChild(row);
    });

    message.textContent = `Showing ${logs.length} audit records.`;
}


// ==================================
// REFRESH AUDIT LOGS
// ==================================

document.getElementById("refreshAuditButton")
    .addEventListener("click", loadAuditLogs);

// ==================================
// REFRESH USERS
// ==================================

document.getElementById("refreshUsersButton")
    .addEventListener("click", loadUsers);

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
    loadRecentClaims(),
    loadUsers(),
    loadClaimsManagement(),
    loadAuditLogs()
]);
}

initializeDashboard();
