// Toggle between login and register forms
document.getElementById('showRegister').addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    clearErrors();
});

document.getElementById('showLogin').addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    clearErrors();
});

// Login form submission
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const btnText = document.getElementById('loginBtnText');
    const loader = document.getElementById('loginLoader');

    errorDiv.textContent = '';
    btnText.style.display = 'none';
    loader.style.display = 'block';

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = '/chatbot';
        } else {
            errorDiv.textContent = data.message || 'Login failed';
            btnText.style.display = 'block';
            loader.style.display = 'none';
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        btnText.style.display = 'block';
        loader.style.display = 'none';
    }
});

// Register form submission
document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const errorDiv = document.getElementById('registerError');
    const btnText = document.getElementById('registerBtnText');
    const loader = document.getElementById('registerLoader');

    errorDiv.textContent = '';

    // Validation
    if (username.length < 3) {
        errorDiv.textContent = 'Username must be at least 3 characters';
        return;
    }

    if (password.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters';
        return;
    }

    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        return;
    }

    btnText.style.display = 'none';
    loader.style.display = 'block';

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = '/chatbot';
        } else {
            errorDiv.textContent = data.message || 'Registration failed';
            btnText.style.display = 'block';
            loader.style.display = 'none';
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        btnText.style.display = 'block';
        loader.style.display = 'none';
    }
});

function clearErrors() {
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
}
