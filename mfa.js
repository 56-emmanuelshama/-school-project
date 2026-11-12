
// ==========================================
// SUPABASE CONFIGURATION
// ==========================================

const SUPABASE_URL = "https://wqszwijxuiomyrguyhrx.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_1FqMpDgBFBn8oMEi-M5c9g_-wJjQ5z4";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// ==========================================
// HTML ELEMENTS
// ==========================================

const statusText = document.getElementById("statusText");
const setupInstructions = document.getElementById("setupInstructions");
const qrCode = document.getElementById("qrCode");
const verificationCode = document.getElementById("verificationCode");
const verifyButton = document.getElementById("verifyButton");
const message = document.getElementById("message");

let factorId = null;
let challengeId = null;

// ==========================================
// INITIALIZE MFA
// ==========================================

async function initializeMFA() {
    try {
        statusText.textContent = "Checking administrator account...";

        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;

        if (!user) {
            window.location.replace("index.html");
            return;
        }

        // Confirm administrator role
        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .single();

        if (profileError) throw profileError;

        if (profile.role !== "admin") {
            throw new Error("Administrator access only.");
        }

        // Check existing MFA factors
        const { data: factors, error: factorsError } =
            await supabaseClient.auth.mfa.listFactors();

        if (factorsError) throw factorsError;

        const verifiedFactor = factors.totp.find(
            factor => factor.status === "verified"
        );

        if (verifiedFactor) {
            factorId = verifiedFactor.id;

            setupInstructions.style.display = "none";
            statusText.textContent =
                "Enter the six-digit code from your authenticator app.";

            await createChallenge();
        } else {
            await enrollAuthenticator();
        }

    } catch (error) {
        console.error("MFA initialization error:", error);
        message.textContent = error.message;
        message.className = "error";
    }
}

// ==========================================
// ENROLL AUTHENTICATOR AND DISPLAY QR CODE
// ==========================================

async function enrollAuthenticator() {
    statusText.textContent = "Creating your authenticator setup...";

    const { data, error } =
        await supabaseClient.auth.mfa.enroll({
            factorType: "totp",
            friendlyName: "Admin Authenticator 3"
        });

    if (error) throw error;

    factorId = data.id;

    // Display the QR code returned by Supabase
    qrCode.src = data.totp.qr_code;
    qrCode.style.display = "block";

    setupInstructions.style.display = "block";

    statusText.textContent =
        "Scan the QR code with Google Authenticator.";

    await createChallenge();
}

// ==========================================
// CREATE MFA CHALLENGE
// ==========================================

async function createChallenge() {
    const { data, error } =
        await supabaseClient.auth.mfa.challenge({
            factorId: factorId
        });

    if (error) throw error;

    challengeId = data.id;

    verifyButton.disabled = false;
}

// ==========================================
// VERIFY SIX-DIGIT CODE
// ==========================================

verifyButton.addEventListener("click", async function () {
    const code = verificationCode.value.trim();

    if (!/^\d{6}$/.test(code)) {
        message.textContent = "Enter a valid six-digit code.";
        message.className = "error";
        return;
    }

    verifyButton.disabled = true;
    message.textContent = "Verifying your code...";
    message.className = "";

    try {
        const { error } = await supabaseClient.auth.mfa.verify({
            factorId: factorId,
            challengeId: challengeId,
            code: code
        });

        if (error) throw error;

        const { data: assurance, error: assuranceError } =
            await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();

        if (assuranceError) throw assuranceError;

        if (assurance.currentLevel !== "aal2") {
            throw new Error("MFA verification was not completed.");
        }

        message.textContent = "Verification successful!";
        message.className = "success";

        statusText.textContent = "Access granted. Opening admin dashboard...";

        window.location.replace("admin.html");

    } catch (error) {
        console.error("MFA verification error:", error);

        message.textContent = error.message;
        message.className = "error";

        verificationCode.value = "";

        // Generate a fresh challenge for another attempt
        try {
            await createChallenge();
        } catch (challengeError) {
            console.error(challengeError);
        }
    }

    verifyButton.disabled = false;
});

// ==========================================
// START
// ==========================================

initializeMFA();
