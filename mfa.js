
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
        verifyButton.disabled = true;
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

        // Check all existing MFA factors
        const { data: factors, error: factorsError } =
            await supabaseClient.auth.mfa.listFactors();

        if (factorsError) throw factorsError;

        const allFactors = factors.all || [];

        const verifiedFactor = allFactors.find(
            factor =>
                factor.factor_type === "totp" &&
                factor.status === "verified"
        );

        const pendingFactor = allFactors.find(
            factor =>
                factor.factor_type === "totp" &&
                factor.status === "unverified"
        );

        if (verifiedFactor) {
            factorId = verifiedFactor.id;

            setupInstructions.style.display = "none";
            qrCode.style.display = "none";

            statusText.textContent =
                "Enter your six-digit authenticator code.";

            await createChallenge();

        } else if (pendingFactor) {
            throw new Error(
                "An incomplete MFA setup already exists. Please contact the administrator to reset it before starting again."
            );

        } else {
            await enrollAuthenticator();
        }

    } catch (error) {
        console.error("MFA initialization error:", error);
        statusText.textContent = "MFA setup could not be completed.";
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
            friendlyName: "Admin Authenticator"
        });

    if (error) throw error;

    factorId = data.id;

    // Display QR code returned by Supabase
    qrCode.src = data.totp.qr_code;
    qrCode.style.display = "block";

    setupInstructions.style.display = "block";

    statusText.textContent =
        "Scan this QR code with Google Authenticator.";

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

        statusText.textContent =
            "Access granted. Opening admin dashboard...";

        window.location.replace("admin.html");

    } catch (error) {
        console.error("MFA verification error:", error);

        message.textContent = error.message;
        message.className = "error";

        verificationCode.value = "";

        try {
            await createChallenge();
        } catch (challengeError) {
            console.error("Challenge error:", challengeError);
        }
    }

    verifyButton.disabled = false;
});

// ==========================================
// START MFA
// ==========================================

initializeMFA();
