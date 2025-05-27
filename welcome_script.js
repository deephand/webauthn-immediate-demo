// --- DOM Elements ---
const greetingElement = document.getElementById('greeting');
const signInMethodElement = document.getElementById('signInMethod');
const catImageElement = document.getElementById('catImage');
const passkeyOfferElement = document.getElementById('passkeyOffer');
const createPasskeyButton = document.getElementById('createPasskeyButton');
const passkeyMessageArea = document.getElementById('passkeyMessageArea');

// --- Helper Functions ---

/**
 * Generates a random buffer (Uint8Array). Used for challenge.
 * @param {number} len - The length of the buffer. Default is 32.
 * @returns {Uint8Array | null} - The random buffer, or null on error.
 */
function generateRandomBuffer(len = 32) {
    if (!window.crypto || !window.crypto.getRandomValues) {
        console.error("Web Crypto API not available.");
        showPasskeyMessage("Error: Web Crypto API is required.", true);
        return null;
    }
    const randomBytes = new Uint8Array(len);
    window.crypto.getRandomValues(randomBytes);
    return randomBytes;
}

/**
 * Displays a message in the passkey creation message area.
 * @param {string} text - The message text.
 * @param {boolean} isError - Whether the message is an error. Default is false.
 */
function showPasskeyMessage(text, isError = false) {
    if (!passkeyMessageArea) return;
    passkeyMessageArea.textContent = text;
    passkeyMessageArea.className = `mt-3 text-xs min-h-[16px] ${isError ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'}`;
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Retrieve user info from sessionStorage
    let username = 'Guest'; // Default username
    let signInMethod = 'Unknown'; // Default method
    try {
        username = sessionStorage.getItem('username') || username;
        signInMethod = sessionStorage.getItem('signInMethod') || signInMethod;
    } catch (e) {
        console.error("Session storage error:", e);
        if(signInMethodElement) signInMethodElement.textContent = "Could not retrieve session details.";
    }

    // Optional: Clear storage after retrieving (uncomment if desired)
    // try {
    //     sessionStorage.removeItem('username');
    //     sessionStorage.removeItem('signInMethod');
    // } catch (e) { console.error("Session storage clear error:", e); }


    // 2. Update Greeting and Sign-in Method display
    if (greetingElement) {
        greetingElement.textContent = `Welcome, ${username}!`;
    }
    if (signInMethodElement) {
        let methodText = `You signed in via ${signInMethod}.`;
        if (signInMethod === 'PublicKeyCredential') {
            methodText = "You signed in securely with a Passkey!";
        } else if (signInMethod === 'OTP') {
            methodText = "You signed in using a One-Time Password.";
        } else if (signInMethod === 'Password') {
            methodText = "You signed in using your Password.";
        }
        signInMethodElement.textContent = methodText;
    }

    // 3. Fetch and display Cat Image
    if (catImageElement) {
        const timestamp = Date.now();
        catImageElement.src = `https://cataas.com/cat?t=${timestamp}`;
    }

    // 4. Show Passkey Creation Offer if applicable
    if (signInMethod !== 'PublicKeyCredential' && passkeyOfferElement) {
        passkeyOfferElement.classList.remove('hidden');

        if (createPasskeyButton) {
            createPasskeyButton.addEventListener('click', async () => {
                // Pass the currently displayed username for creation
                const usernameToCreate = sessionStorage.getItem('username') || 'Guest';
                await createPasskey(usernameToCreate);
            });
        }
    }
});


// --- Passkey Creation Logic ---

/**
 * Attempts to create a new passkey (PublicKeyCredential).
 * @param {string} currentUsername - The username to associate with the passkey.
 */
async function createPasskey(currentUsername) {
    if (!navigator.credentials || !navigator.credentials.create || typeof PublicKeyCredential === "undefined") {
        showPasskeyMessage("WebAuthn API (create) not available/supported.", true);
        return;
    }
    // ** DEMO ONLY: Check TextEncoder support (needed for encoding username to user.id) **
    if (typeof TextEncoder === "undefined") {
         showPasskeyMessage("TextEncoder API not supported, cannot create passkey.", true);
         return;
    }

    showPasskeyMessage("Creating passkey...", false);
    if(createPasskeyButton) createPasskeyButton.disabled = true;

    try {
        const challengeBuffer = generateRandomBuffer();
        if (!challengeBuffer) {
            if(createPasskeyButton) createPasskeyButton.disabled = false;
            return; // Error message shown by generateRandomBuffer
        }

        // ** DEMO ONLY: Encode username into user.id **
        // ** WARNING: Not recommended for production! Use a stable, non-personally-identifiable ID. **
        const userIdBuffer = new TextEncoder().encode(currentUsername);

        const publicKeyCredentialCreationOptions = {
            rp: { name: "WebAuthn Demo", id: window.location.hostname },
            user: {
                id: userIdBuffer, // Use encoded username as user handle
                name: currentUsername, // Username (for account selection hints)
                displayName: currentUsername, // Display name (for account selection hints)
            },
            challenge: challengeBuffer,
            pubKeyCredParams: [ { type: "public-key", alg: -7 }, { type: "public-key", alg: -257 } ],
            authenticatorSelection: {
                // authenticatorAttachment: "platform", // Optional preference
                userVerification: "required",
                residentKey: "required", // Required for discoverable credential (passkey)
            },
            timeout: 60000,
        };

        console.log("Calling navigator.credentials.create with options:", JSON.stringify(publicKeyCredentialCreationOptions, (key, value) => {
            if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
                 // Represent ArrayBuffer as Base64URL for slightly better logging if needed
                 // This is a basic conversion, consider a library for robust handling
                 try {
                     let binary = '';
                     const bytes = new Uint8Array(value);
                     bytes.forEach((byte) => binary += String.fromCharCode(byte));
                     return `[Buffer: ${window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}]`;
                 } catch (e) {
                     return `[Buffer length=${value.byteLength}]`; // Fallback
                 }
            }
            return value;
        }));

        const newCredential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions
        });

        if (newCredential) {
            console.log("New passkey credential created:", newCredential);
            showPasskeyMessage("Passkey created successfully!", false);
            // In a real app, send newCredential data to server here
        } else {
             showPasskeyMessage("Passkey creation failed unexpectedly.", true);
        }

    } catch (error) {
        console.error("navigator.credentials.create error:", error.name, error.message);
        let errorMessage = `Passkey creation failed: ${error.message}`;
        if (error.name === 'NotAllowedError') {
            errorMessage = "Passkey creation cancelled or not allowed.";
        } else if (error.name === 'InvalidStateError') {
             errorMessage = "Passkey creation failed: Invalid state. Perhaps one already exists for this user/device?";
        }
        showPasskeyMessage(errorMessage, true);
    } finally {
         if(createPasskeyButton) createPasskeyButton.disabled = false;
    }
}
