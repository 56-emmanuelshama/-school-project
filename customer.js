
// ==================================
// SUPABASE CONFIGURATION
// ==================================

const SUPABASE_URL = "https://wqszwijxuiomyrguyhrx.supabase.co";

// Use the same publishable key as your working index.js
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1FqMpDgBFBn8oMEi-M5c9g_-wJjQ5z4";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);


// ==================================
// PAGE ELEMENTS
// ==================================

const customerName = document.getElementById("customerName");
const customerEmail = document.getElementById("customerEmail");
const claimForm = document.getElementById("claimForm");
const claimsTable = document.getElementById("claimsTable");
const message = document.getElementById("message");
const logoutButton = document.getElementById("logoutButton");

let currentUser = null;


// ==================================
// VERIFY CUSTOMER ACCESS
// ==================================

// ==================================
// VERIFY CUSTOMER ACCESS
// ==================================

async function checkCustomerAccess() {

    // 1. Check authenticated session
    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error || !data.session) {
        window.location.replace("index.html");
        return false;
    }

    currentUser = data.session.user;

    // 2. Confirm customer role
    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("full_name, role")
            .eq("id", currentUser.id)
            .single();

    if (profileError || !profile) {
        alert("Your customer profile could not be found.");
        await supabaseClient.auth.signOut();
        window.location.replace("index.html");
        return false;
    }

    if (profile.role !== "customer") {

        if (profile.role === "admin") {
            window.location.replace("mfa.html");
        } else {
            window.location.replace("index.html");
        }

        return false;
    }

    // 3. Enforce MFA verification (AAL2)
    const { data: assuranceData, error: assuranceError } =
        await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();

    if (assuranceError) {
        console.error("Customer MFA assurance error:", assuranceError);
        await supabaseClient.auth.signOut();
        window.location.replace("index.html");
        return false;
    }

    if (assuranceData.currentLevel !== "aal2") {
        window.location.replace("customer-mfa.html");
        return false;
    }

    // 4. Display customer information
    customerName.textContent = profile.full_name || "Customer";
    customerEmail.textContent = currentUser.email || "";

    return true;
}



// ==================================
// LOAD CUSTOMER CLAIMS
// ==================================

async function loadCustomerClaims() {

    const { data: claims, error } = await supabaseClient
        .from("claims")
        .select("claim_number, title, claim_amount, status, created_at")
        .eq("customer_id", currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Claims loading error:", error);
        claimsTable.innerHTML =
            '<tr><td colspan="5">Unable to load your claims.</td></tr>';
        return;
    }

    claimsTable.replaceChildren();

    const total = claims.length;

    const pending = claims.filter(
        claim => (claim.status || "").toLowerCase() === "pending"
    ).length;

    const approved = claims.filter(
        claim => (claim.status || "").toLowerCase() === "approved"
    ).length;

    document.getElementById("totalClaims").textContent = total;
    document.getElementById("pendingClaims").textContent = pending;
    document.getElementById("approvedClaims").textContent = approved;

    if (total === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent = "You have not submitted any claims yet.";

        row.appendChild(cell);
        claimsTable.appendChild(row);
        return;
    }

    claims.forEach(claim => {

        const row = document.createElement("tr");

        const values = [
            claim.claim_number || "N/A",
            claim.title || "N/A",
            "KSh " + Number(claim.claim_amount || 0).toLocaleString(),
            claim.status || "Unknown",
            claim.created_at
                ? new Date(claim.created_at).toLocaleDateString()
                : "N/A"
        ];

        values.forEach((value, index) => {

            const cell = document.createElement("td");
            cell.textContent = value;

            if (index === 3) {
                const status = String(value).toLowerCase();
                cell.className = "status " + status;
            }

            row.appendChild(cell);
        });

        claimsTable.appendChild(row);
    });
}


// ==================================
// SUBMIT NEW CLAIM
// ==================================
// SUBMIT NEW CLAIM
// ==================================

claimForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const category = document.getElementById("claimType").value;
    const amount = Number(document.getElementById("claimAmount").value);
    const description =
        document.getElementById("description").value.trim();

    if (!category || !description || !Number.isFinite(amount) || amount <= 0) {
        message.textContent = "Please enter valid claim details.";
        return;
    }

    const submitButton = document.getElementById("submitButton");

    submitButton.disabled = true;
    message.textContent = "Submitting your claim...";

    try {
        // Get the current authenticated session
        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError || !sessionData.session) {
            message.textContent = "Your session has expired. Please log in again.";
            return;
        }

        const userId = sessionData.session.user.id;

        console.log("Logged-in user ID:", userId);
        console.log("Current user ID:", currentUser?.id);
        console.log("Claim status:", "submitted");

        if (currentUser && currentUser.id !== userId) {
            message.textContent = "Session mismatch. Please log in again.";
            return;
        }

        currentUser = sessionData.session.user;

        const claimNumber =
            "CLM-" + Date.now() + "-" +
            Math.floor(Math.random() * 1000);

        const claimData = {
            claim_number: claimNumber,
            customer_id: userId,
            title: category,
            description: description,
            claim_amount: amount,
            status: "submitted"
        };

        console.log("Claim data:", claimData);

        const { error } = await supabaseClient
            .from("claims")
            .insert(claimData);

        if (error) {
            console.error("Claim submission error:", error);
            message.textContent = "Error: " + error.message;
            return;
        }

        message.textContent = "Your claim was submitted successfully!";
        claimForm.reset();

        await loadCustomerClaims();

    } catch (error) {
        console.error("Unexpected claim error:", error);
        message.textContent = "An unexpected error occurred.";

    } finally {
        submitButton.disabled = false;
    }
});

// ==================================
// LOGOUT
// ==================================
// ==================================
// LOGOUT
// ==================================

logoutButton.addEventListener("click", async function() {

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("Unable to log out. Please try again.");
        console.error("Logout error:", error);
        return;
    }

    window.location.replace("index.html");
});

// ==================================
// INITIALIZE CUSTOMER DASHBOARD
// ==================================
// ==================================
// INITIALIZE CUSTOMER DASHBOARD
// ==================================

async function initializeCustomerDashboard() {

    const authorized = await checkCustomerAccess();

    if (!authorized) return;

    await loadCustomerClaims();
}

initializeCustomerDashboard();