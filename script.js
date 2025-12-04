// --- DOM Elements ---
const immediateToggle = document.getElementById('immediateToggle');
const passkeysToggle = document.getElementById('passkeysToggle');
const passkeySupportIcon = document.getElementById('passkeySupportIcon');
const passwordsToggle = document.getElementById('passwordsToggle');
const passwordsToggleSection = document.getElementById('passwordsToggleSection');
const passwordSupportIcon = document.getElementById('passwordSupportIcon');
const fedcmToggleSection = document.getElementById('fedcmToggleSection');
const fedcmToggle = document.getElementById('fedcmToggle');
const fedcmSupportIcon = document.getElementById('fedcmSupportIcon');
const signInButton = document.getElementById('signInButton');
const messageArea = document.getElementById('messageArea');
const capabilityStatusDiv = document.getElementById('capability-status');
const explanationTitle = document.getElementById('explanationTitle'); // ** NEW **
const urlParamsExplanationContent = document.getElementById('urlParamsExplanationContent'); // ** NEW **


// --- Global Settings ---
let effectiveUserVerification = 'preferred'; // Default (still used internally)
let triggerImmediateOnLoad = false;
let initialUrlFallbackParam = null;
let initialUrlFedCMParam = null;
let useAutoselectTimeout = false;

// --- SVG Icons ---
const ICON_INFO = `
<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>`;
const ICON_WARN = `
<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
</svg>`;


// --- Helper Functions ---

/**
 * Generates a random buffer (Uint8Array).
 * @param {number} len - The length of the buffer. Default is 32.
 * @returns {Uint8Array | null} - The random buffer, or null on error.
 */
function generateRandomBuffer(len = 32) {
    if (!window.crypto || !window.crypto.getRandomValues) {
        console.error("Web Crypto API not available.");
        showMessage("Error: Web Crypto API is required for challenge generation.", true);
        return null;
    }
    const randomBytes = new Uint8Array(len);
    window.crypto.getRandomValues(randomBytes);
    return randomBytes;
}

/**
 * Displays a message in the capability status area, replacing existing content.
 * @param {string} text - The message text.
 * @param {'success' | 'error' | 'info'} type - The type of message. Default is 'info'.
 */
function showCapabilityStatus(text, type = 'info') {
    if (!capabilityStatusDiv) {
        console.error("Capability status div not found.");
        return;
    }
    capabilityStatusDiv.innerHTML = `<div class="message message-${type}">${text}</div>`;
}

/**
 * Displays a message in the main message area below the button.
 * @param {string} text - The message text.
 * @param {boolean} isError - Whether the message is an error. Default is false.
 */
function showMessage(text, isError = false) {
    if (!messageArea) return;
    messageArea.textContent = text;
    messageArea.className = `mt-6 text-center text-sm min-h-[20px] ${isError ? 'text-red-600 font-semibold' : 'text-gray-600'}`;
}

/**
 * Resets the button state to its default appearance and enables it.
 */
function resetButtonState() {
    // Only reset button if it's not currently in the auto-sign-in state
    if (!signInButton || triggerImmediateOnLoad) return;
    signInButton.disabled = false;
    signInButton.classList.remove('btn-disabled-error', 'opacity-75', 'cursor-wait');
    signInButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
    signInButton.textContent = 'Sign In';
    showMessage('');
}

/**
 * Sets the button state to indicate an error (red, disabled).
 * @param {string} errorMessage - The error message to display.
 */
function setButtonErrorState(errorMessage) {
     if (!signInButton) return;
    signInButton.disabled = true;
    signInButton.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'opacity-75', 'cursor-wait');
    signInButton.classList.add('btn-disabled-error');
    signInButton.textContent = 'Request Not Supported';
    showMessage(errorMessage, true);
}

/**
 * Stores user info and redirects the user to a specified page immediately.
 * @param {string} url - The URL to redirect to.
 * @param {string} username - The username to store.
 * @param {string} method - The sign-in method ('PublicKeyCredential', 'Password', 'OTP').
 */
function storeInfoAndRedirect(url, username, method) {
    console.log(`[script.js] Attempting to store info before redirect: username='${username}', method='${method}'`);
    try {
        console.log('[script.js] Clearing sessionStorage...');
        sessionStorage.clear();
        sessionStorage.setItem('username', username);
        sessionStorage.setItem('signInMethod', method);
        console.log('[script.js] Session storage updated. Current values:');
        console.log(`  username: ${sessionStorage.getItem('username')}`);
        console.log(`  signInMethod: ${sessionStorage.getItem('signInMethod')}`);
    } catch (e) {
        console.error("[script.js] Session storage error:", e);
    }
    console.log(`[script.js] Redirecting immediately to ${url}...`);
    window.location.href = url;
}


// --- Core Sign-In Logic ---

/**
 * Attempts the navigator.credentials.get() call based on current settings.
 * @param {boolean} [useImmediateMediation=false] - Whether to force 'immediate' mediation for this specific call (e.g., for onload).
 */
async function attemptSignIn(useImmediateMediation = false) {
    console.log("[script.js] attemptSignIn called. useImmediateMediation:", useImmediateMediation);
    // Clear session storage at the start of the attempt
    try {
        console.log("[script.js] Clearing sessionStorage before sign-in attempt...");
        sessionStorage.clear();
    } catch(e) {
        console.error("[script.js] Failed to clear session storage:", e);
    }

    // Don't reset button state if it's an auto-onload attempt
    if (!useImmediateMediation) {
        resetButtonState();
    }
    showMessage('Attempting sign in...');

    if (!navigator.credentials || !navigator.credentials.get) {
         setButtonErrorState("WebAuthn API (navigator.credentials.get) not available.");
         return;
    }

    try {
        let getOptions = {};

        if (passkeysToggle.checked) {
            const challengeBuffer = generateRandomBuffer();
            if (!challengeBuffer) return;

            const publicKeyCredentialRequestOptions = {
                challenge: challengeBuffer,
                timeout: useAutoselectTimeout ? 300042 : 300000,
                userVerification: effectiveUserVerification,
                rpId: window.location.hostname,
                allowCredentials: []
            };
            getOptions.publicKey = publicKeyCredentialRequestOptions;
        }

        // Determine mediation: force 'immediate' if specified, otherwise use toggle state
        if (useImmediateMediation) {
            getOptions.mediation = 'immediate';
            console.log("[script.js] Forcing mediation: 'immediate' for this call.");
        } else if (immediateToggle.checked) {
            getOptions.mediation = 'immediate';
            console.log("[script.js] Using mediation: 'immediate' from toggle.");
        } else {
             console.log("[script.js] Using default mediation (optional).");
        }

        // Add password option if toggle is checked AND enabled
        if (passwordsToggle.checked && !passwordsToggle.disabled) {
             getOptions.password = true;
             console.log("[script.js] Requesting password credential.");
        }

        // Add FedCM option if toggle is checked AND enabled
        if (fedcmToggle && fedcmToggle.checked && !fedcmToggle.disabled) {
            getOptions.identity = {
                providers: [{
                    configURL: "https://bbddcaf6-380b-4e5a-b8e1-08eae44d61f9-00-2v5ggpej3d5zx.picard.replit.dev/fedcm.json",
                    clientId: window.location.origin,
                    nonce: Math.random().toString(36).substring(2),
                }]
            };
            console.log("[script.js] Requesting federated credential.");
        }

        if (Object.keys(getOptions).length === 0) {
            setButtonErrorState("No credential type requested. Please enable passkeys or passwords.");
            return;
        }

        if (Object.keys(getOptions).length === 1 && getOptions.mediation) {
            setButtonErrorState("Requesting with only a mediation hint is not allowed.");
            return;
        }


        console.log("[script.js] Calling navigator.credentials.get with options:", JSON.stringify(getOptions, (key, value) => {
            if (value instanceof Uint8Array || value instanceof ArrayBuffer) return `[Buffer length=${value.byteLength}]`;
            return value;
        }));

        const credential = await navigator.credentials.get(getOptions);

        if (credential) {
            console.log("[script.js] Credential received:", credential);
            let rawMethod = credential.type;
            let methodToStore = 'Unknown';
            let usernameToStore = "Demo User"; // Default

            if (rawMethod === 'public-key') {
                 methodToStore = 'PublicKeyCredential';
                 console.log("[script.js] Credential type is public-key.");
                 if (credential.response && credential.response.userHandle && typeof TextDecoder !== "undefined") {
                     try {
                         const decodedUsername = new TextDecoder().decode(credential.response.userHandle);
                         if (decodedUsername) {
                             usernameToStore = decodedUsername;
                             console.log("[script.js] Decoded username from userHandle:", usernameToStore);
                         } else { console.warn("[script.js] UserHandle decoded to empty string."); }
                     } catch (decodeError) {
                         console.error("[script.js] Failed to decode userHandle:", decodeError);
                     }
                 } else { console.warn("[script.js] UserHandle not found or TextDecoder not supported. Using default username 'Demo User'."); }
            } else if (rawMethod === 'password') {
                methodToStore = 'Password';
                console.log("[script.js] Credential type is password.");
                usernameToStore = credential.id || "Password User";
                console.log("[script.js] Using username from PasswordCredential ID:", usernameToStore);
            } else {
                 console.warn(`[script.js] Unknown credential type received: ${rawMethod}`);
                 methodToStore = rawMethod;
            }

            storeInfoAndRedirect('welcome.html', usernameToStore, methodToStore);

        } else {
             console.log("[script.js] navigator.credentials.get returned null.");
             if (!useImmediateMediation) {
                 showMessage("Sign in cancelled or no credential selected immediately.", false);
             } else {
                  showMessage("Auto sign-in: No credential selected immediately.", false);
             }
        }

    } catch (error) {
        console.error("[script.js] navigator.credentials.get error:", error.name, error.message);

        if (error.name === 'NotAllowedError') {
             console.log(`[script.js] NotAllowedError received. Initial URL fallback param was: '${initialUrlFallbackParam}'`);
             let signinRedirectUrl = 'signin.html';
             if (initialUrlFallbackParam === 'pw') {
                 signinRedirectUrl += '?type=pw';
                 console.log(`[script.js] Appending ?type=pw to signin.html redirect because initialUrlFallbackParam was 'pw'.`);
             }
             if (initialUrlFedCMParam) {
                signinRedirectUrl += signinRedirectUrl.includes('?') ? '&fedcm=true' : '?fedcm=true';
                console.log(`[script.js] Appending fedcm=true to signin.html redirect because fedcm was true.`);
             }
             console.log(`[script.js] Redirecting to ${signinRedirectUrl}...`);
             window.location.href = signinRedirectUrl;
        }
        else if (error.name === 'NotSupportedError') {
            setButtonErrorState(`Error: ${error.message} (This combination might not be supported).`);
        } else if (error.name === 'SecurityError') {
             setButtonErrorState(`Security Error: ${error.message}. Ensure you are using HTTPS.`);
        } else {
            setButtonErrorState(`An unexpected error occurred: ${error.name} - ${error.message}`);
        }
    }
}

function getBoolean(value) {
    if (value === null) {
        return false;
    }
    return value === 'true';
}

// --- Initialization ---

function initializeDemo() {
    console.log("[script.js] Initializing demo...");

    // 0. Parse URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    initialUrlFallbackParam = urlParams.get('fallback');
    const uvParam = urlParams.get('uv');
    const immediateOnLoadParam = getBoolean(urlParams.get('immediate_onload'));
    const autoselectParam = getBoolean(urlParams.get('autoselect'));
    initialUrlFedCMParam = getBoolean(urlParams.get('fedcm'));

    if (initialUrlFallbackParam === 'pw') {
        console.log("[script.js] URL parameter 'fallback=pw' was present on initial load. This will be used if redirection to signin.html occurs due to NotAllowedError.");
    }

    if (autoselectParam) {
        useAutoselectTimeout = true;
        console.log("[script.js] URL parameter 'autoselect' found. Using special timeout 300042.");
    }

    // Check for essential elements
     if (!immediateToggle || !passkeysToggle || !passkeySupportIcon || !passwordsToggle || !passwordsToggleSection || !passwordSupportIcon || !signInButton || !messageArea || !capabilityStatusDiv || !explanationTitle || !urlParamsExplanationContent) { // Added new elements
        console.error("[script.js] One or more required DOM elements are missing. Cannot initialize demo.");
        if(capabilityStatusDiv) capabilityStatusDiv.innerHTML = `<div class="message message-error">Initialization Error: Page elements missing.</div>`;
        if(signInButton) signInButton.disabled = true;
        return;
    }


    const validUVOptions = ['required', 'preferred', 'discouraged'];

    if (uvParam && validUVOptions.includes(uvParam.toLowerCase())) {
        effectiveUserVerification = uvParam.toLowerCase();
        console.log(`[script.js] User Verification set to '${effectiveUserVerification}' from URL parameter.`);
    } else {
        effectiveUserVerification = 'preferred'; // Default
        console.log(`[script.js] Using default User Verification: '${effectiveUserVerification}'.`);
        if (uvParam) {
            console.warn(`[script.js] Invalid 'uv' parameter value ignored: ${uvParam}`);
        }
    }

    if (immediateOnLoadParam === 'true') {
        triggerImmediateOnLoad = true;
        console.log("[script.js] Immediate sign-in on load requested via URL parameter.");
        signInButton.disabled = true;
        signInButton.textContent = 'Auto Sign-In Triggered...';
        signInButton.classList.add('opacity-75', 'cursor-wait');
    }


    // 1. Check PublicKeyCredential capabilities
    if (typeof PublicKeyCredential === "undefined") {
        showCapabilityStatus("WebAuthn not supported by this browser.", 'error');
        signInButton.disabled = true;
        signInButton.classList.add('opacity-50', 'cursor-not-allowed');
        passkeysToggle.disabled = true;
    } else {
        passkeySupportIcon.innerHTML = ICON_INFO;
        passkeySupportIcon.title = "Passkeys are supported.";
    }

    if (typeof PublicKeyCredential.getClientCapabilities !== "function") {
        showCapabilityStatus("getClientCapabilities() not supported by this browser.", 'info');
    }

    (async () => {
        try {
            const capabilities = await PublicKeyCredential.getClientCapabilities('public-key');
            console.log('[script.js] Client Capabilities:', capabilities);
            if (capabilities && capabilities.immediateGet === true) {
                showCapabilityStatus("✅ Browser supports `immediateGet` capability!", 'success');
            } else {
                showCapabilityStatus("ℹ️ Browser does not report `immediateGet` capability. The 'immediate' mediation might not work as expected.", 'info');
            }

            if (triggerImmediateOnLoad) {
                console.log("[script.js] Triggering immediate sign-in now.");
                await attemptSignIn(true);
            }

        } catch (error) {
            console.error("[script.js] Error checking client capabilities:", error);
            showCapabilityStatus(`Error checking capabilities: ${error.message}`, 'error');
             signInButton.disabled = true;
             signInButton.classList.add('opacity-50', 'cursor-not-allowed');
             if (triggerImmediateOnLoad) {
                 showMessage("Could not check capabilities, auto sign-in cancelled.", true);
                 signInButton.textContent = 'Sign In';
                 signInButton.classList.remove('opacity-75', 'cursor-wait');
                 signInButton.disabled = false;
                 triggerImmediateOnLoad = false;
             }
        }
    })();


    // 2. Check PasswordCredential support
    if (typeof PasswordCredential !== 'undefined') {
        console.log("[script.js] PasswordCredential supported.");
        passwordSupportIcon.innerHTML = ICON_INFO;
        passwordSupportIcon.title = "You can add passwords in the browser's password manager.";
        passwordsToggle.disabled = false;
        passwordsToggleSection.classList.remove('toggle-disabled');
    } else {
        console.warn("[script.js] PasswordCredential not supported.");
        passwordSupportIcon.innerHTML = ICON_WARN;
        passwordSupportIcon.title = "PasswordCredential not supported by this browser.";
        passwordsToggle.disabled = true;
        passwordsToggleSection.classList.add('toggle-disabled');
    }

    // 3. Check FedCM support
    if (!!initialUrlFedCMParam) {
        console.log("[script.js] URL parameter 'fedcm' found. FedCM is enabled.");
        fedcmToggleSection.classList.remove('hidden');
        if (typeof IdentityCredential !== 'undefined') {
            console.log("[script.js] IdentityCredential supported.");
            fedcmSupportIcon.innerHTML = ICON_INFO;
            fedcmSupportIcon.title = "You can sign in to bbddcaf6-380b-4e5a-b8e1-08eae44d61f9-00-2v5ggpej3d5zx.picard.replit.dev to test federation.";
            fedcmToggle.disabled = false;
            fedcmToggle.checked = true;
        } else {
            console.warn("[script.js] IdentityCredential not supported.");
            fedcmSupportIcon.innerHTML = ICON_WARN;
            fedcmSupportIcon.title = "IdentityCredential not supported by this browser.";
            fedcmToggle.disabled = true;
        }
    }

     if (typeof TextDecoder === "undefined") {
         console.warn("[script.js] TextDecoder API not supported, cannot read passkey username if encoded in userHandle.");
     }


    // 3. Attach Sign In button click listener
    if (!triggerImmediateOnLoad) {
        signInButton.addEventListener('click', () => attemptSignIn(false));
    } else {
         console.log("[script.js] Manual sign-in button listener NOT attached due to immediate_onload=true.");
    }

    // ** NEW: Add click listener for expandable section **
    if (explanationTitle && urlParamsExplanationContent) {
        explanationTitle.addEventListener('click', () => {
            urlParamsExplanationContent.classList.toggle('expanded');
            const arrow = explanationTitle.querySelector('.arrow');
            if (arrow) {
                arrow.classList.toggle('expanded');
            }
        });
    }


    // 4. Attach Toggle listeners
    immediateToggle.addEventListener('change', resetButtonState);
    passkeysToggle.addEventListener('change', resetButtonState);
    passwordsToggle.addEventListener('change', () => {
        if (!passwordsToggle.disabled) {
            resetButtonState();
        }
    });
}

// --- Run Initialization ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDemo);
} else {
    initializeDemo();
}
