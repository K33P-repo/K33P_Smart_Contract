# Firebase Authentication Guide for K33P Mobile Apps

This guide explains how to set up Firebase Authentication for phone number verification in your Android and iOS mobile apps.

## 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Give your project a name and configure the settings as needed

## 2. Add Your Mobile Apps to Firebase

### For Android:

1. In the Firebase console, click "Add app" and select Android
2. Enter your app's package name (e.g., `com.yourcompany.k33p`)
3. Download the `google-services.json` file and add it to your Android project's `app` directory
4. Follow the setup instructions to add the Firebase SDK to your app

### For iOS:

1. In the Firebase console, click "Add app" and select iOS
2. Enter your app's bundle ID (e.g., `com.yourcompany.k33p`)
3. Download the `GoogleService-Info.plist` file and add it to your Xcode project
4. Follow the setup instructions to add the Firebase SDK to your app

## 3. Enable Phone Authentication

1. In the Firebase console, go to Authentication > Sign-in method
2. Enable "Phone" as a sign-in provider
3. Save your changes

## 4. Set Up Firebase Admin SDK on the Backend

1. In the Firebase console, go to Project settings > Service accounts
2. Click "Generate new private key" to download a service account JSON file
3. Set the `FIREBASE_SERVICE_ACCOUNT` environment variable with the contents of the JSON file

## 5. Mobile App Implementation

Implement Firebase Phone Authentication in your mobile apps following the official documentation:

- [Firebase Phone Authentication for Android](https://firebase.google.com/docs/auth/android/phone-auth)
- [Firebase Phone Authentication for iOS](https://firebase.google.com/docs/auth/ios/phone-auth)

## 6. Testing

Firebase provides test phone numbers for development:

1. Use `+1 650-555-3434` as the phone number
2. Use `123456` as the verification code

## 7. Security Considerations

1. Always verify ID tokens on your backend before granting access to protected resources
2. Set appropriate security rules in Firebase to protect your data
3. Implement proper error handling for failed authentication attempts

## Additional Resources

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Firebase Authentication REST API](https://firebase.google.com/docs/reference/rest/auth)