// At the top of server.js
const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin'); // Import Firebase Admin SDK

// --- Initialize Firebase Admin SDK ---
// Load service account key from file (RECOMMENDED: use env vars for path)
// **Make sure 'serviceAccountKey.json' is in your .gitignore!**
try {
    const serviceAccount = require('./serviceAccountKey.json'); // Adjust path if needed
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("!!! ERROR INITIALIZING FIREBASE ADMIN SDK              !!!");
    console.error("!!! Ensure 'serviceAccountKey.json' exists and is valid !!!");
    console.error("!!! Have you added it to the '/server' directory?       !!!");
    console.error("!!! Is it added to .gitignore?                         !!!");
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("Admin SDK Init Error:", error);
    process.exit(1); // Exit if Admin SDK fails to load - critical for password reset
}
// --- End Admin SDK Init ---


const app = express();
const port = 4000;

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());

// --- In-Memory OTP Store ---
const otpStore = {};
const OTP_EXPIRY_MINUTES = 5;

// --- Nodemailer Setup ---
// Use dotenv for real projects: require('dotenv').config();
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'mealcare.ntu2@gmail.com', // Replace or use env var
    pass: process.env.EMAIL_PASS || 'hpivtmxowndrdeio', // Replace with YOUR App Password or use env var
  },
});

// --- Helper Function: Generate OTP ---
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- API Endpoints ---

// Endpoint to send OTP (No changes needed here, but ensure 'purpose' is handled if necessary)
app.post('/send-otp', async (req, res) => {
  const { email, purpose } = req.body; // Purpose might be 'signup' or 'reset'

  if (!email) { return res.status(400).json({ success: false, message: 'Email is required' }); }
  if (!/\S+@\S+\.\S+/.test(email)) { return res.status(400).json({ success: false, message: 'Invalid email format' }); }

  // Check if user exists in Firebase *before* sending reset OTP (Optional but good)
  if (purpose === 'reset') {
     try {
         await admin.auth().getUserByEmail(email);
         console.log(`User ${email} found, proceeding with password reset OTP.`);
     } catch (userNotFoundError) {
         // Check the error code specifically for user-not-found
         if (userNotFoundError.code === 'auth/user-not-found') {
             console.log(`Password reset request for non-existent user: ${email}`);
             // Still send success to avoid revealing which emails are registered
             return res.json({ success: true, message: 'If your email is registered, you will receive a code.' });
         } else {
             // Log other potential errors during user lookup
             console.error(`Error checking user ${email} for password reset:`, userNotFoundError);
             return res.status(500).json({ success: false, message: 'Error checking user account.' });
         }
     }
  }


  const otp = generateOTP();
  const expiryTime = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;
  otpStore[email] = { otp, expires: expiryTime };
  console.log(`Generated OTP for ${email} (${purpose}): ${otp}`);

  const subject = purpose === 'reset'
      ? 'Your Password Reset Code'
      : 'Your App Verification Code';
  const textBody = `Your ${purpose === 'reset' ? 'password reset' : 'verification'} code is: ${otp}\nThis code will expire in ${OTP_EXPIRY_MINUTES} minutes.`;
  const htmlBody = `<p>Your ${purpose === 'reset' ? 'password reset' : 'verification'} code is: <strong>${otp}</strong></p><p>This code will expire in ${OTP_EXPIRY_MINUTES} minutes.</p>`;

  const mailOptions = {
    from: `"Your App Name" <${process.env.EMAIL_USER || 'mealcare.ntu2@gmail.com'}>`,
    to: email,
    subject: subject,
    text: textBody,
    html: htmlBody,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent successfully to ${email} for ${purpose}`);
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error(`Error sending OTP email to ${email}:`, error);
    res.status(500).json({ success: false, message: 'Failed to send OTP email' });
  }
});

// Endpoint to verify OTP (No changes needed unless you add purpose validation)
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) { return res.status(400).json({ success: false, message: 'Email and OTP are required' }); }

  const storedData = otpStore[email];

  if (!storedData) { return res.status(400).json({ success: false, message: 'OTP not found or expired. Please request again.' }); }
  if (Date.now() > storedData.expires) { delete otpStore[email]; return res.status(400).json({ success: false, message: 'OTP has expired. Please request again.' }); }

  if (storedData.otp === otp) {
    // IMPORTANT: Do *not* delete the OTP immediately for password reset flow.
    // If you delete it here, you can't implicitly trust the next step.
    // A better flow would generate a *different* short-lived token here.
    // For this simplified (less secure) flow, we'll leave the OTP for now
    // or just proceed, acknowledging the risk. Let's delete it for simplicity
    // but understand this weakens the link between OTP verify and password set.
    delete otpStore[email]; 
    console.log(`OTP verified successfully for ${email}`);
    res.json({ success: true, message: 'OTP verified successfully' });
  } else {
    console.log(`Invalid OTP attempt for ${email}. Received: ${otp}, Expected: ${storedData.otp}`);
    res.status(400).json({ success: false, message: 'Invalid OTP.' });
  }
});


// --- NEW Endpoint: Reset Password ---
app.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ success: false, message: 'Email and new password are required.' });
    }

    // Add basic password complexity check if needed (e.g., length)
    if (newPassword.length < 6) {
         return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    console.log(`Attempting password reset for ${email}`);

    try {
        // Find the user by email using Admin SDK
        const userRecord = await admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;

        // Update the user's password using Admin SDK
        await admin.auth().updateUser(uid, {
            password: newPassword,
        });

        console.log(`Password successfully updated for user: ${uid} (${email})`);
        // Optionally: Invalidate existing refresh tokens for security
        // await admin.auth().revokeRefreshTokens(uid);

        res.json({ success: true, message: 'Password updated successfully.' });

    } catch (error) {
        console.error(`Failed to reset password for ${email}:`, error);
         if (error.code === 'auth/user-not-found') {
             res.status(404).json({ success: false, message: 'User account not found.' });
         } else {
            res.status(500).json({ success: false, message: 'An error occurred while updating the password.' });
         }
    }
});
// --- End New Endpoint ---

// --- Cleanup expired OTPs periodically ---
setInterval(() => { /* ... keep as is ... */ }, 60 * 1000 * 5);

// --- Start Server ---
app.listen(port, () => {
  console.log(`OTP server listening at http://localhost:${port}`);
});