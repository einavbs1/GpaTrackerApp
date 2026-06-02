# Degree GPA Calculator

Client-side GPA application with Google Sign-In via Firebase Authentication and cloud persistence via Firestore.

## Setup

1. Install Node.js 18+.
2. Run `npm install`.
3. Enable Google Sign-In in Firebase Authentication for the configured Firebase project.
4. Create Firestore and apply the rules from `firestore.rules`.

## Run

`npm run dev:web`

## Features

- Google Sign-In gated access
- Firestore persistence per authenticated Firebase UID
- Auto-save on every mutation
- Semester, annual, and cumulative GPA calculations
- Binary pass course handling
- JSON backup export/import with schema validation

## Firestore structure

- Collection: `appStates`
- Document ID: authenticated user's Firebase UID

Each document stores the full `AppState` object.

## Firebase project

The project is initialized directly in [src/firebase.ts](c:\Users\EINAVBE\Documents\AverageToarCalculate\src\firebase.ts) using the provided Firebase configuration.
