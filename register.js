




// SUPABASE CONFIGURATION

const SUPABASE_URL = "https://wqszwijxuiomyrguyhrx.supabase.co";

// Keep your actual existing Supabase publishable key here
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1FqMpDgBFBn8oMEi-M5c9g_-wJjQ5z4";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
registerForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const registerButton = registerForm.querySelector('button[type="submit"]');

    message.textContent = "Creating your account...";
    registerButton.disabled = true;

    try {
        
const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
        data: {
            full_name: fullName
        },
        emailRedirectTo: window.location.origin + "/index.html"
    }
});


        if (error) {
            throw error;
        }

        if (!data.user) {
            throw new Error("Supabase did not return a user account.");
        }

        if (!data.session) {
            message.textContent =
                "Account created! Please confirm your email, then log in.";
            return;
        }

        message.textContent = "Account created successfully!";
        window.location.replace("customer.html");

    } catch (error) {
        console.error("Registration error:", error);
        message.textContent = error.message;

    } finally {
        registerButton.disabled = false;
    }
});