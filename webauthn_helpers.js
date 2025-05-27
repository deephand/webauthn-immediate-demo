// webauthn-helpers.js

// Helper function to generate a secure challenge (client-side, for demo only)
// In a real application, this MUST be done on the server.
function generateSecureChallenge() {
    return crypto.getRandomValues(new Uint8Array(32));
}

// Helper function to create a passkey
export async function createPasskey(username) {
    try {
        // Generate challenge CLIENT-SIDE (for demo purposes ONLY)
        const challenge = generateSecureChallenge();

        const userId = crypto.getRandomValues(new Uint8Array(16));

        const publicKeyCredentialCreationOptions = {
            challenge: challenge,
            rp: {
                name: "Your WebAuthn Demo", // CHANGE THIS to your app's name
            },
            user: {
                id: userId,
                name: username,
                displayName: username,
            },
            pubKeyCredParams: [
                { type: "public-key", alg: -7 }, // ES256
                { type: "public-key", alg: -257 } // RS256
            ],
            timeout: 60000,
            attestation: "direct",
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "preferred"
            }
        };

        const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions
        });

        // No server interaction - just display a success message (for the demo)
        return `<p>Passkey created successfully!</p>`; // Simplified success

    } catch (error) {
        console.error("Passkey creation error:", error);
        return `<p>Passkey creation failed: ${error}</p>`; // Show error
    }
}

// Helper function to authenticate with a passkey (including immediate mediation)
export async function authenticateWithPasskey(mediation, password) {
    try {
        // Generate challenge CLIENT-SIDE (for demo purposes ONLY)
        const challenge = generateSecureChallenge();

        const allowCredentials = [];

        const options = {
            mediation: mediation ? 'immediate' : undefined,
            password: password,
            publicKey: {
                challenge: challenge,
                allowCredentials: allowCredentials,
                timeout: 60000,
                userVerification: 'preferred'
            }
        };

        const credential = await navigator.credentials.get(options);

        let username = "User"; // Default
        let credentialType = "Unknown";

        if (credential instanceof PublicKeyCredential) {
            credentialType = "Passkey";
            // No reliable way to get username client-side without server verification
            username = "User"; // Keep default for the demo, since no server.
            return { username, credentialType };

        } else if (credential instanceof PasswordCredential) {
            credentialType = "Password";
            username = credential.id;
             return { username, credentialType };
        } else {
            throw new Error("Unexpected credential type");
        }

    } catch (error) {
        console.error("Authentication failed:", error);
        throw error; // Re-throw
    }
}

// Helper function for Cross-Device Authentication (CDA)
export async function performCDAAuthentication() {
    try {
        // Generate challenge CLIENT-SIDE (for demo purposes ONLY)
        const challenge = generateSecureChallenge();

        const allowCredentials = [];

        const options = {
            mediation: undefined, // Disable immediate mediation
            publicKey: {
                challenge: challenge,
                allowCredentials: allowCredentials,
                timeout: 60000,
                userVerification: 'required',
                authenticatorSelection: {
                    authenticatorAttachment: 'cross-platform',
                },
            },
        };

        const credential = await navigator.credentials.get(options);

        // Handle Credential (Similar to authenticateWithPasskey, but no server)
        if (credential instanceof PublicKeyCredential) {
            return { username: "User", credentialType: "Passkey (CDA)" }; // Default username

        } else {
             throw new Error("Unexpected credential type for CDA");
        }

    } catch (error) {
        console.error("CDA Sign-In Error:", error);
        throw error; // Re-throw
    }
}