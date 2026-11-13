
// ==========================================
// CUSTOMER MULTI-FACTOR AUTHENTICATION
// ==========================================

const SUPABASE_URL =
    "https://wqszwijxuiomyrguyhrx.supabase.co";

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
const verificationSection =
    document.getElementById("verificationSection");
const verificationCode =
    document.getElementById("verificationCode");
const verifyButton = document.getElementById("verifyButton");
const message = document.getElementById("message");

let currentFactorId = null;

// ==========================================
// DISPLAY MESSAGES
// ==========================================

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "red" : "green";
}

// ==========================================
// DISPLAY HIGH-RESOLUTION QR CODE
// ==========================================

function displayQRCode(qrData) {

    if (!qrData) {
        throw new Error("Supabase did not return a QR code.");
    }

    qrCode.alt = "Scan this QR code using Google Authenticator";
    qrCode.style.width = "300px";
    qrCode.style.height = "300px";
    qrCode.style.display = "block";
    qrCode.style.margin = "20px auto";
    qrCode.style.padding = "10px";
    qrCode.style.backgroundColor = "#ffffff";
    qrCode.style.objectFit = "contain";

    const sourceImage = new Image();

    sourceImage.onload = function () {

        try {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            canvas.width = 640;
            canvas.height = 640;

            // White background
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, 640, 640);

            // Add a white border around the QR code
            const padding = 48;
            const availableSize = 640 - (padding * 2);

            const originalWidth = sourceImage.naturalWidth || 512;
            const originalHeight = sourceImage.naturalHeight || 512;

            const scale = Math.min(
                availableSize / originalWidth,
                availableSize / originalHeight
            );

            const width = originalWidth * scale;
            const height = originalHeight * scale;

            const x = (640 - width) / 2;
            const y = (640 - height) / 2;

            context.drawImage(
                sourceImage,
                x,
                y,
                width,
                height
            );

            // Display as PNG
            qrCode.src = canvas.toDataURL("image/png");

            console.log("QR code converted successfully.");
            console.log("QR image dimensions:", qrCode.naturalWidth);

        } catch (error) {
            console.error("QR conversion error:", error);

            // Fallback: display original Supabase QR
            qrCode.src = qrData;
        }
    };

    sourceImage.onerror = function () {
        console.error("Original QR image failed to load.");
        showMessage("Unable to display QR code. Please try again.", true);
    };

    sourceImage.src = qrData;
}

// ==========================================
// INITIALIZE CUSTOMER MFA
// ==========================================

async function initializeCustomerMFA() {

    try {

        statusText.textContent = "Checking your account...";

        // 1. Check session
        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        const session = sessionData.session;

        if (!session) {
            window.location.replace("index.html");
            return;
        }

        // 2. Verify customer role
        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .single();

        if (profileError || !profile) {
            throw new Error("Customer profile could not be found.");
        }

        if (profile.role !== "customer") {
            throw new Error("This page is only for customer accounts.");
        }

        // 3. Check existing MFA factors
        const { data: factorData, error: factorError } =
            await supabaseClient.auth.mfa.listFactors();

        if (factorError) throw factorError;

        const factors = factorData.all || [];

        const verifiedFactor = factors.find(
            factor =>
                factor.factor_type === "totp" &&
                factor.status === "verified"
        );

        if (verifiedFactor) {

            // Existing customer with MFA
            currentFactorId = verifiedFactor.id;

            statusText.textContent =
                "Enter the six-digit code from Google Authenticator.";

            verificationSection.hidden = false;
            setupInstructions.hidden = true;

        } else {

            // 4. Remove incomplete previous setup attempts
            const pendingFactors = factors.filter(
                factor =>
                    factor.factor_type === "totp" &&
                    factor.status === "unverified"
            );

            for (const factor of pendingFactors) {

                const { error: removalError } =
                    await supabaseClient.auth.mfa.unenroll({
                        factorId: factor.id
                    });

                if (removalError) throw removalError;
            }

            // 5. Enroll a new TOTP factor
            const { data: enrollment, error: enrollmentError } =
                await supabaseClient.auth.mfa.enroll({
                    factorType: "totp",
                    friendlyName: "Customer Authenticator"
                });

            if (enrollmentError) throw enrollmentError;

            currentFactorId = enrollment.id;

            // 6. Display QR code
            setupInstructions.hidden = false;
            verificationSection.hidden = false;

            statusText.textContent =
                "Scan this QR code using Google Authenticator.";

            displayQRCode(enrollment.totp.qr_code);
        }

    } catch (error) {

        console.error("Customer MFA initialization error:", error);

        statusText.textContent = "MFA setup could not continue.";

        showMessage(error.message, true);
    }
}

// ==========================================
// VERIFY AUTHENTICATOR CODE
// ==========================================

verifyButton.addEventListener("click", async function () {

    const code = verificationCode.value.trim();

    if (!/^\d{6}$/.test(code)) {
        showMessage("Please enter a valid six-digit code.", true);
        return;
    }

    if (!currentFactorId) {
        showMessage("No MFA factor is available.", true);
        return;
    }

    verifyButton.disabled = true;
    showMessage("Verifying your code...");

    try {

        // 1. Create a fresh challenge
        const { data: challenge, error: challengeError } =
            await supabaseClient.auth.mfa.challenge({
                factorId: currentFactorId
            });

        if (challengeError) throw challengeError;

        // 2. Verify six-digit code
        const { error: verifyError } =
            await supabaseClient.auth.mfa.verify({
                factorId: currentFactorId,
                challengeId: challenge.id,
                code: code
            });

        if (verifyError) throw verifyError;

        // 3. Confirm AAL2
        const { data: assurance, error: assuranceError } =
            await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();

        if (assuranceError) throw assuranceError;

        if (assurance.currentLevel !== "aal2") {
            throw new Error("MFA verification was not completed.");
        }

        showMessage("Verification successful! Redirecting...");

        window.location.replace("customer.html");

    } catch (error) {

        console.error("Customer MFA verification error:", error);

        verificationCode.value = "";

        showMessage(error.message, true);

    } finally {

        verifyButton.disabled = false;
    }
});

// ==========================================
// START CUSTOMER MFA
// ==========================================

initializeCustomerMFA();
