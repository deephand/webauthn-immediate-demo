// --- DOM Elements ---
const usernameInput = document.getElementById('username');
const otpSection = document.getElementById('otpSection');
const otpInput = document.getElementById('otp');
const passwordSection = document.getElementById('passwordSection'); // Added
const passwordInput = document.getElementById('password');       // Added
const continueButton = document.getElementById('continueButton');
const passkeySignInButton = document.getElementById('passkeySignInButton');
const messageArea = document.getElementById('messageArea');
const signInForm = document.getElementById('signInForm');

// --- Global State ---
let currentSignInMode = 'otp'; // 'otp' or 'password'

// --- Helper Functions ---

/**
 * Generates a random buffer (Uint8Array).
 * @param {number} len - The length of the buffer. Default is 32.
 * @returns {Uint8Array | null} - The random buffer, or null on error.
 */
function generateRandomBuffer(len = 32) {
    if (!window.crypto || !window.crypto.getRandomValues) {
        console.error("Web Crypto API not available.");
        showMessage("Error: Web Crypto API is required for security.", true);
        return null;
    }
    const randomBytes = new Uint8Array(len);
    window.crypto.getRandomValues(randomBytes);
    return randomBytes;
}

/**
 * Displays a message in the main message area.
 * @param {string} text - The message text.
 * @param {boolean} isError - Whether the message is an error. Default is false.
 */
function showMessage(text, isError = false) {
    if (!messageArea) return;
    messageArea.innerHTML = ''; // Clear previous
    if (!text) {
        messageArea.className = 'mt-6 text-center text-sm text-gray-600 min-h-[20px]';
        return;
    }
    const messageElement = document.createElement('div');
    messageElement.textContent = text;
    messageElement.className = `message ${isError ? 'message-error' : 'message-info'}`;
    messageArea.appendChild(messageElement);
    messageArea.className = 'mt-6 text-sm';
}

/**
 * Stores user info and redirects the user to a specified page immediately.
 * @param {string} url - The URL to redirect to.
 * @param {string} username - The username to store.
 * @param {string} method - The sign-in method ('PublicKeyCredential', 'Password', 'OTP').
 */
function storeInfoAndRedirect(url, username, method) {
    console.log(`[signin_script.js] Attempting to store info before redirect: username='${username}', method='${method}'`);
    try {
        console.log('[signin_script.js] Clearing sessionStorage...');
        sessionStorage.clear();
        sessionStorage.setItem('username', username);
        sessionStorage.setItem('signInMethod', method);
        console.log('[signin_script.js] Session storage updated. Current values:');
        console.log(`  username: ${sessionStorage.getItem('username')}`);
        console.log(`  signInMethod: ${sessionStorage.getItem('signInMethod')}`);
    } catch (e) {
        console.error("[signin_script.js] Session storage error:", e);
    }
    console.log(`[signin_script.js] Redirecting immediately to ${url}...`);
    window.location.href = url;
}

// --- Event Listeners ---

// 1. Continue Button Logic
continueButton.addEventListener('click', () => {
    console.log("[signin_script.js] Continue button clicked. Mode:", currentSignInMode);
    try {
        console.log("[signin_script.js] Clearing sessionStorage before attempt...");
        sessionStorage.clear();
    } catch(e) {
        console.error("[signin_script.js] Failed to clear session storage:", e);
    }

    showMessage('');
    const username = usernameInput.value.trim();

    if (!username) {
        showMessage("Please enter a username.", true);
        usernameInput.focus();
        return;
    }

    if (currentSignInMode === 'otp') {
        // OTP Flow
        if (otpSection.classList.contains('hidden')) {
            // First stage: Show OTP
            console.log("[signin_script.js] OTP Flow: Showing OTP field.");
            otpSection.classList.remove('hidden');
            passwordSection.classList.add('hidden'); // Ensure password section is hidden
            continueButton.textContent = "Sign In";
            otpInput.focus();
        } else {
            // Second stage: Sign in with OTP
            console.log("[signin_script.js] OTP Flow: Attempting OTP sign-in.");
            const otp = otpInput.value.trim();
             if (!otp) {
                showMessage("Please enter the OTP (type anything).", true);
                otpInput.focus();
                return;
            }
            storeInfoAndRedirect('welcome.html', username, 'OTP');
        }
    } else if (currentSignInMode === 'password') {
        // Password Flow - now two-step
        if (passwordSection.classList.contains('hidden')) {
            // First stage: Show Password field
            console.log("[signin_script.js] Password Flow: Showing Password field.");
            passwordSection.classList.remove('hidden');
            otpSection.classList.add('hidden'); // Ensure OTP section is hidden
            continueButton.textContent = "Sign In with Password";
            passwordInput.focus();
        } else {
            // Second stage: Sign in with Password
            console.log("[signin_script.js] Password Flow: Attempting Password sign-in.");
            const password = passwordInput.value; // Don't trim password
            if (!password) {
                showMessage("Please enter your password.", true);
                passwordInput.focus();
                return;
            }
            // For demo, any password works. In real app, verify password here.
            storeInfoAndRedirect('welcome.html', username, 'Password');
        }
    }
});

// 2. Passkey Sign In Button Logic
passkeySignInButton.addEventListener('click', async () => {
    console.log("[signin_script.js] Passkey Sign In button clicked.");
    try {
        console.log("[signin_script.js] Clearing sessionStorage before passkey attempt...");
        sessionStorage.clear();
    } catch(e) {
        console.error("[signin_script.js] Failed to clear session storage:", e);
    }

    showMessage('');
    showMessage('Attempting passkey sign in...', false);
    const usernameFromInput = usernameInput.value.trim();

    if (!navigator.credentials || !navigator.credentials.get || typeof PublicKeyCredential === "undefined") {
         showMessage("WebAuthn API not available/supported.", true);
         return;
    }
     if (typeof TextDecoder === "undefined") {
         showMessage("TextDecoder API not supported, cannot read passkey username.", true);
         return;
     }

    try {
        const challengeBuffer = generateRandomBuffer();
        if (!challengeBuffer) return;

        const publicKeyCredentialRequestOptions = {
            challenge: challengeBuffer,
            timeout: 60000,
            userVerification: 'preferred',
            rpId: window.location.hostname,
            allowCredentials: []
        };

        const getOptions = { publicKey: publicKeyCredentialRequestOptions };

        console.log("[signin_script.js] Calling navigator.credentials.get for passkey:", JSON.stringify(getOptions, (key, value) => {
             if (value instanceof Uint8Array || value instanceof ArrayBuffer) return `[Buffer length=${value.byteLength}]`;
             return value;
        }));

        const credential = await navigator.credentials.get(getOptions);

        if (credential && credential.type === 'public-key') {
            console.log("[signin_script.js] Passkey credential received:", credential);
            let usernameToStore = usernameFromInput || "Passkey User";
            let methodToStore = 'PublicKeyCredential';

            if (credential.response && credential.response.userHandle) {
                try {
                    const decodedUsername = new TextDecoder().decode(credential.response.userHandle);
                    if (decodedUsername) {
                        usernameToStore = decodedUsername;
                        console.log("[signin_script.js] Decoded username from userHandle:", usernameToStore);
                    } else { console.warn("[signin_script.js] UserHandle decoded to empty string."); }
                } catch (decodeError) {
                    console.error("[signin_script.js] Failed to decode userHandle:", decodeError);
                }
            } else { console.warn("[signin_script.js] UserHandle not found in credential response. Using fallback username."); }
            storeInfoAndRedirect('welcome.html', usernameToStore, methodToStore);

        } else if (credential) {
             console.warn(`[signin_script.js] Received credential is not type public-key: ${credential.type}`);
             let methodToStore = credential.type === 'password' ? 'Password' : credential.type;
             let nameToStore = (methodToStore === 'Password' && credential.id) ? credential.id : (usernameFromInput || "Signed-in User");
             showMessage(`Sign in successful via ${methodToStore}.`, false);
             storeInfoAndRedirect('welcome.html', nameToStore, methodToStore);
        }
         else {
             console.log("[signin_script.js] navigator.credentials.get returned null.");
             showMessage("Passkey sign in cancelled or failed unexpectedly.", true);
        }

    } catch (error) {
        console.error("[signin_script.js] Passkey navigator.credentials.get error:", error.name, error.message);
        let errorMessage = `Passkey sign in failed: ${error.message}`;
        if (error.name === 'NotAllowedError') {
            errorMessage = "Passkey sign in cancelled or not allowed.";
        } else if (error.name === 'SecurityError') {
            errorMessage = `Security Error: ${error.message}. Ensure HTTPS.`;
        }
        showMessage(errorMessage, true);
    }
});

// 3. Enter Key Handling
usernameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        // If password field is visible and focused, or OTP is visible and focused, trigger continue
        if ((!passwordSection.classList.contains('hidden') && document.activeElement === passwordInput) ||
            (!otpSection.classList.contains('hidden') && document.activeElement === otpInput)) {
            continueButton.click();
        } else { // Otherwise, advance to the next field (OTP or Password)
            continueButton.click(); // This will show OTP/Password or attempt sign-in
        }
    }
});

otpInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        continueButton.click();
    }
});

passwordInput.addEventListener('keydown', (event) => { // Added for password field
    if (event.key === 'Enter') {
        event.preventDefault();
        continueButton.click();
    }
});

// --- Initial Setup ---

async function initiateFedCM() {
  if (!window.IdentityCredential) {
    console.log("FedCM is not supported on this browser.");
    return;
  }

  try {
    console.log("[signin_script.js] Starting FedCM passive mode request...");
    const cred = await navigator.credentials.get({
      identity: {
        providers: [
          {
            configURL: "https://fedcm-idp-demo.onrender.com/fedcm.json",
            clientId: window.location.origin,
            nonce: Math.random().toString(36).substring(2),
          },
        ],
        mode: "passive",

      },
      mediation: "required",
    });

    console.log("[signin_script.js] FedCM request completed.");

    if (cred) {
      console.log("FedCM credential received:", cred);
      // We don't have a real backend, so we'll just redirect to the welcome page
      // and store the user's name in sessionStorage.
      storeInfoAndRedirect("welcome.html", "FedCM User", "Federated");
    } else {
      console.log("FedCM credential is null.");
    }
  } catch (e) {
    console.error(`FedCM error [${e.name}]: ${e.message}`, e);
    if (e.name === 'NetworkError') {
        showMessage("Passive sign-in failed (NetworkError). User might not be signed in to IdP.", true);
    } else {
        showMessage(
        "FedCM failed. Check browser support and ensure third-party cookies are enabled.",
        true
        );
    }
  }
}

function initializeSignInPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const fedcmParam = urlParams.get('fedcm');

    if (fedcmParam) {
        initiateFedCM();
    }

    console.log("[signin_script.js] Initializing sign-in page.");
    const typeParam = urlParams.get('type');

    // Always hide both sections initially
    otpSection.classList.add('hidden');
    passwordSection.classList.add('hidden');
    continueButton.textContent = "Continue"; // Generic "Continue" for the first step

    if (typeParam === 'pw') {
        console.log("[signin_script.js] URL parameter 'type=pw' found. Setting mode to password.");
        currentSignInMode = 'password';
        // Password section will be revealed on first click of "Continue"
    } else {
        console.log("[signin_script.js] No 'type=pw' parameter. Defaulting to OTP mode.");
        currentSignInMode = 'otp';
        // OTP section will be revealed on first click of "Continue"
    }
    usernameInput.focus(); // Focus username first
    showMessage(''); // Clear any stale messages
}

// Run initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSignInPage);
} else {
    initializeSignInPage();
}
