
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

async function checkCustomerAccess() {

    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error || !data.session) {
        window.location.replace("index.html");
        return false;
    }

    currentUser = data.session.user;

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

    // Enforce MFA AAL2
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

    customerName.textContent = profile.full_name || "Customer";
    customerEmail.textContent = currentUser.email || "";

    return true;
}

// ==================================
// LOAD CUSTOMER CLAIMS AND PAYMENTS
// ==================================

async function loadCustomerClaims() {

    const { data: claims, error } = await supabaseClient
        .from("claims")
        .select(`
            id,
            claim_number,
            title,
            claim_amount,
            processing_fee,
            payment_status,
            status,
            created_at
        `)
        .eq("customer_id", currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {

        console.error("Claims loading error:", error);

        claimsTable.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 7;
        cell.textContent = "Unable to load your claims.";

        row.appendChild(cell);
        claimsTable.appendChild(row);

        return;
    }

    claimsTable.replaceChildren();

    // Load payment records belonging to this customer
    const { data: payments, error: paymentError } =
        await supabaseClient
            .from("claim_payments")
            .select("claim_id, payment_status, created_at, mpesa_receipt_number")
            .eq("customer_id", currentUser.id)
            .order("created_at", { ascending: false });

    if (paymentError) {
        console.error("Payment records loading error:", paymentError);
    }

    // Store the latest payment record for each claim
    const latestPayments = new Map();

    (payments || []).forEach(payment => {

        if (!latestPayments.has(payment.claim_id)) {
            latestPayments.set(payment.claim_id, payment);
        }
    });

    const total = claims.length;

    const pending = claims.filter(claim =>
        ["submitted", "pending", "under_review"].includes(
            (claim.status || "").toLowerCase()
        )
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

        cell.colSpan = 7;
        cell.textContent = "You have not submitted any claims yet.";

        row.appendChild(cell);
        claimsTable.appendChild(row);

        return;
    }

    claims.forEach(claim => {

        const row = document.createElement("tr");

        function createCell(value) {
            const cell = document.createElement("td");
            cell.textContent = value ?? "N/A";
            return cell;
        }

        // Claim number
        const claimNumberCell = createCell(
            claim.claim_number || "N/A"
        );

        // Category
        const categoryCell = createCell(
            claim.title || "N/A"
        );

        // Claim amount
        const amountCell = createCell(
            "KSh " + Number(claim.claim_amount || 0).toLocaleString()
        );

        // Processing fee
        const feeCell = createCell(
            claim.processing_fee !== null &&
            claim.processing_fee !== undefined
                ? "KSh " + Number(claim.processing_fee).toLocaleString()
                : "Not assigned"
        );

        // Payment status
        const paymentCell = document.createElement("td");

        const latestPayment = latestPayments.get(claim.id);

        let paymentStatus = (
            claim.payment_status || "unpaid"
        ).toLowerCase();

        if (paymentStatus !== "paid" && latestPayment) {
            paymentStatus = (
                latestPayment.payment_status || paymentStatus
            ).toLowerCase();
        }

        const paymentBadge = document.createElement("span");

        paymentBadge.className = "status " + paymentStatus;
        paymentBadge.textContent = paymentStatus.replace("_", " ");

        paymentCell.appendChild(paymentBadge);

        // Show M-Pesa receipt if available
        if (latestPayment?.mpesa_receipt_number) {

            const receipt = document.createElement("small");

            receipt.textContent =
                "Receipt: " + latestPayment.mpesa_receipt_number;

            receipt.style.display = "block";

            paymentCell.appendChild(receipt);
        }

        // Claim status
        const statusCell = createCell(
            claim.status || "Unknown"
        );

        statusCell.className =
            "status " + (claim.status || "unknown").toLowerCase();

        // Date submitted
        const dateCell = createCell(
            claim.created_at
                ? new Date(claim.created_at).toLocaleDateString()
                : "N/A"
        );

        // Payment action
        const paymentActionCell = document.createElement("td");

        if (paymentStatus === "paid") {

            paymentActionCell.textContent = "Payment complete";

        } else if (claim.processing_fee === null ||
                   claim.processing_fee === undefined) {

            paymentActionCell.textContent =
                "Waiting for administrator to assign fee";

        } else if (paymentStatus === "pending") {

            paymentActionCell.textContent =
                "Payment request pending. Please wait.";

        } else {

            const phoneInput = document.createElement("input");

            phoneInput.type = "tel";
            phoneInput.placeholder = "07XXXXXXXX";
            phoneInput.maxLength = 12;
            phoneInput.required = true;
            phoneInput.style.width = "125px";

            const payButton = document.createElement("button");

            payButton.type = "button";
            payButton.textContent = "Pay with M-Pesa";

            payButton.addEventListener("click", async () => {

                let phoneNumber = phoneInput.value.trim();

                // Convert local Kenyan number to Daraja format
                if (/^0[17]\d{8}$/.test(phoneNumber)) {
                    phoneNumber = "254" + phoneNumber.substring(1);
                }

                if (!/^254[17]\d{8}$/.test(phoneNumber)) {

                    alert(
                        "Enter a valid Kenyan mobile number, for example 0712345678."
                    );

                    phoneInput.focus();
                    return;
                }

                if (
                    !Number.isInteger(Number(claim.processing_fee)) ||
                    Number(claim.processing_fee) < 1
                ) {

                    alert("The processing fee assigned to this claim is invalid.");
                    return;
                }

                payButton.disabled = true;
                payButton.textContent = "Sending request...";

                try {

                    const { data, error } =
                        await supabaseClient.functions.invoke(
                            "mpesa-stk-push",
                            {
                                body: {
                                    claimId: claim.id,
                                    phoneNumber: phoneNumber
                                }
                            }
                        );

                    if (error) {
                        throw error;
                    }

                    if (!data || !data.success) {
                        throw new Error(
                            data?.message || "Unable to initiate M-Pesa payment."
                        );
                    }

                    alert(
                        data.customerMessage ||
                        "M-Pesa payment request sent. Check your phone and enter your M-Pesa PIN."
                    );

                    await loadCustomerClaims();

                } catch (error) {

                    console.error("M-Pesa payment error:", error);

                    alert(
                        error.message ||
                        "Payment request failed. Please try again."
                    );

                    payButton.disabled = false;
                    payButton.textContent = "Pay with M-Pesa";
                }
            });

            paymentActionCell.append(
                phoneInput,
                document.createElement("br"),
                payButton
            );
        }

        row.append(
            claimNumberCell,
            categoryCell,
            amountCell,
            feeCell,
            paymentCell,
            statusCell,
            dateCell,
            paymentActionCell
        );

        claimsTable.appendChild(row);
    });
}

// ==================================
// SUBMIT NEW CLAIM
// ==================================

claimForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const category = document.getElementById("claimType").value;

    const amount = Number(
        document.getElementById("claimAmount").value
    );

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

        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError || !sessionData.session) {

            message.textContent =
                "Your session has expired. Please log in again.";

            return;
        }

        const userId = sessionData.session.user.id;

        if (currentUser && currentUser.id !== userId) {

            message.textContent =
                "Session mismatch. Please log in again.";

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

        const { error } = await supabaseClient
            .from("claims")
            .insert(claimData);

        if (error) {

            console.error("Claim submission error:", error);

            message.textContent = "Error: " + error.message;

            return;
        }

        message.textContent =
            "Your claim was submitted successfully!";

        claimForm.reset();

        await loadCustomerClaims();

    } catch (error) {

        console.error("Unexpected claim error:", error);

        message.textContent =
            "An unexpected error occurred.";

    } finally {

        submitButton.disabled = false;
    }
});

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

async function initializeCustomerDashboard() {

    const authorized = await checkCustomerAccess();

    if (!authorized) return;

    await loadCustomerClaims();
}

initializeCustomerDashboard();