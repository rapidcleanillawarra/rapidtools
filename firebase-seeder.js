import admin from 'firebase-admin';
import fs from 'fs'; // Import the file system module
import { fileURLToPath } from 'url'; // To handle __dirname in ES modules
import { dirname, join } from 'path'; // To handle __dirname in ES modules

// Replicate __dirname functionality in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// !! IMPORTANT !!
// 1. Your service account key JSON file.
// 2. MAKE SURE this file is in your .gitignore to prevent committing it!
const serviceAccountFileName = 'rapidclean-ba9be-firebase-adminsdk-fbsvc-e2cb2cc40c.json';
const serviceAccountPath = join(__dirname, serviceAccountFileName);

// --- Your Firebase Project ID ---
// Ensure this matches your actual Firebase Project ID
const FIREBASE_PROJECT_ID = 'rapidclean-ba9be'; 

// Read and parse the service account key
let serviceAccount;
try {
  const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
  serviceAccount = JSON.parse(serviceAccountFile);
} catch (error) {
  console.error(`Error reading or parsing service account key file at ${serviceAccountPath}:`, error.message);
  console.error('Please ensure the file exists in the root directory and is valid JSON.');
  process.exit(1);
}

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: FIREBASE_PROJECT_ID // Explicitly set the projectId
  });
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

// --- Define Users to Seed Here ---
const usersToSeed = [
  {
    email: 'testuser1@example.com',
    password: 'SuperSecretPassword1!', // Must be at least 6 characters
    firstName: 'Test',
    lastName: 'UserOne'
  },
  {
    email: 'testuser2@example.com',
    password: 'AnotherSecurePwd2@',
    firstName: 'Another',
    lastName: 'UserTwo'
  },
  // Add more user objects here
];

async function seedUsers() {
  console.log('Starting user seeding process...');
  let successCount = 0;
  let failureCount = 0;

  for (const userData of usersToSeed) {
    const { email, password, firstName, lastName } = userData;

    if (!password || password.length < 6) {
      console.error(`Password for ${email} is too short (less than 6 characters). Skipping.`);
      failureCount++;
      continue;
    }

    let userRecord; // Define userRecord here to potentially use in catch block for rollback
    try {
      // 1. Create user in Firebase Authentication
      userRecord = await auth.createUser({
        email: email,
        password: password,
        emailVerified: true, // Optional: set email as verified
        disabled: false
      });
      console.log(`Successfully created Firebase Auth user: ${userRecord.uid} for email: ${email}`);

      // 2. Add additional user details to Firestore
      //    The document ID will be the Firebase Auth UID for easy linking.
      await db.collection('rapidtools_users').doc(userRecord.uid).set({
        email: email, 
        first_name: firstName,
        last_name: lastName,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Successfully added user details to Firestore for UID: ${userRecord.uid}`);
      successCount++;

    } catch (error) {
      console.error(`Failed to seed user ${email}:`, error.message);
      failureCount++;
      // Optional: If auth user was created but Firestore failed, you might want to delete the auth user.
      if (error.message.includes('firestore') && userRecord && userRecord.uid) { // Basic check if Firestore failed
        try {
          await auth.deleteUser(userRecord.uid);
          console.log(`Rolled back Firebase Auth user creation for ${email} due to Firestore error.`);
        } catch (deleteError) {
          console.error(`Failed to roll back Firebase Auth user ${email}:`, deleteError);
        }
      }
    }
    console.log('---'); // Separator for each user attempt
  }

  console.log('\nUser seeding process completed.');
  console.log(`Successfully seeded users: ${successCount}`);
  console.log(`Failed to seed users: ${failureCount}`);
  
  process.exit(0);
}

// Run the seeder
seedUsers().catch(error => {
    console.error('Unhandled error in seedUsers function:', error);
    process.exit(1);
}); 