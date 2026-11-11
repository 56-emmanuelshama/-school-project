
// ==========================================
// LOGIN AND ROLE-BASED REDIRECTION
// ==========================================


const SUPABASE_URL = "https://wqszwijxuiomyrguyhrx.supabase.co";

// Keep your actual existing Supabase publishable key here
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1FqMpDgBFBn8oMEi-M5c9g_-wJjQ5z4";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

loginForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "Signing in...";
    loginButton.disabled = true;

    try {

        // 1. Authenticate user with Supabase
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        // 2. Retrieve user role
        const { data: profile, error: profileError } = await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", data.user.id)
            .single();

        if (profileError || !profile) {
            await supabaseClient.auth.signOut();
            throw new Error("Your user profile could not be found.");
        }

        // 3. Redirect according to role
        if (profile.role === "customer") {

            window.location.replace("customer.html");

        } else if (profile.role === "admin") {

            window.location.replace("admin.html");

        } else if (profile.role === "claims_officer") {

            window.location.replace("claims-officer.html");

        } else {

            await supabaseClient.auth.signOut();
            throw new Error("Your account has an invalid role.");

        }

    } catch (error) {

        console.error("Login error:", error);
        message.textContent = error.message;

    } finally {

        loginButton.disabled = false;

    }

});
