# Setting up the Firebase project

The app keeps each user's list in Cloud Firestore and signs in with Google through Firebase Auth. Everything fits the free Spark plan. One-time setup in the [Firebase console](https://console.firebase.google.com/):

1. **Create a project** (Google Analytics is not needed).
2. **Add a web app** (Project settings > Your apps > Web). Copy `apiKey`, `authDomain`, `projectId` and `appId` into `web/src/firebase.ts`. They identify the project and are not secrets.
3. **Authentication > Sign-in method**: enable **Google**.
4. **Authentication > Settings > Authorized domains**: add the GitHub Pages domain (`<owner>.github.io`). `localhost` is there already for development.
5. **Firestore Database**: create a database in production mode, in a region near the user.
6. **Firestore Database > Rules**: replace them with [`firestore.rules`](../firestore.rules) and publish. Or, with the Firebase CLI: `npx firebase-tools deploy --only firestore:rules --project <project-id>`.

Data layout: `users/{uid}/entries/{key}`, one document per storage key, written through `web/src/storage/firestore.ts`. Each key is one change in the log (`changes:<id>`), written once and never updated.
