
const SUPABASE_URL = "https://wqszwijxuiomyrguyhrx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1FqMpDgBFBn8oMEi-M5c9g_-wJjQ5z4";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

registerForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!fullName || !email || !password) {
    message.textContent = "Please complete all fields.";
    return;
  }

  message.textContent = "Creating your account...";

  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  if (data.user && !data.session) {
    message.textContent =
      "Account created. Check your email to confirm your account before logging in.";
  } else {
    message.textContent =
      "Account created successfully. You can now go to the login page.";
  }
});
