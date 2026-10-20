
const SUPABASE_URL = "https://wqszwijxuiomyrguyhrx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);



const SUPABASE_URL = "https://wqszwijxuiomyrguyhrx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1FqMpDgBFBn8oMEi-M5c9g_-wJjQ5z4";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const forgotPassword = document.getElementById("forgotPassword");

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    message.textContent = "Please enter your email and password.";
    return;
  }

  message.textContent = "Signing in...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  message.textContent = "Login successful! Welcome.";

  console.log("Signed-in user:", data.user.id);
});

forgotPassword.addEventListener("click", async function (event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();

  if (!email) {
    message.textContent = "Enter your email first to reset your password.";
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);

  message.textContent = error
    ? error.message
    : "If an account exists, a password-reset email will be sent.";
});
