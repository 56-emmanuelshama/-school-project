
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        message.textContent = "Please enter your email and password.";
        return;
    }

    message.textContent =
        "Login page ready. Authentication will be connected to Firebase next.";
});

document.getElementById("forgotPassword").addEventListener(
    "click",
    function (event) {
        event.preventDefault();
        message.textContent =
            "Password recovery will be implemented with Firebase.";
    }
);
