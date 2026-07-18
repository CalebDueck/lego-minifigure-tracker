# Testing And Launch Steps

This file is the shortest path from "repo exists" to "I can use the site with my own data".

## Before first run

Complete these Firebase console steps for project `lego-tracker-490006`:

1. Go to `Build > Authentication > Sign-in method`.
2. Enable `Google`.
3. Go to `Build > Authentication > Settings`.
4. Confirm `localhost` is in `Authorized domains`.
5. If you plan to use your current GitHub Pages site, add this host to `Authorized domains`:
   - `calebdueck.github.io`
6. Do not enter the full GitHub Pages URL with `/lego-minifigure-tracker/`.
   Firebase wants the host only.
7. Go to `Build > Firestore Database`.
8. Create the database.
9. Start in `Production mode` if you want the repo's [firestore.rules](firestore.rules) to be the real access policy.
10. Deploy the rules before first real use:

```bash
firebase deploy --only firestore:rules
```

## Local test run

Serve the app locally:

```bash
python3 -m http.server 4173 -d site
```

Open:

```text
http://localhost:4173
```

## GitHub Pages test run

Your current GitHub Pages site is:

```text
https://calebdueck.github.io/lego-minifigure-tracker/
```

Use that URL after you push the rebuilt app to the publishing branch.

## First-use checklist

1. The app loads and shows the Star Wars catalog.
2. The top bar says `Cloud sync` instead of `Local device mode`.
3. Click `Sign in with Google`.
4. Sign in as `calebdueck@gmail.com`.
5. Confirm the overlay disappears after sign-in.
6. Pick a figure and click `Log owned`.
7. Add:
   - `quantity`
   - `condition`
   - `How you got it`
   - `Needs condition upgrade` if applicable
   - collection notes
8. Save the collection log.
9. Add a few figures to the wishlist.
10. Reorder the wishlist from the detail panel.
11. Refresh the page.
12. Confirm your collection and wishlist data are still present.
13. Sign out and sign back in.
14. Confirm the same data reloads from Firestore.

## What success looks like

- Google sign-in works.
- Only your account is accepted.
- Collection entries persist after refresh.
- Wishlist ranking persists after refresh.
- Search works.
- Sorting by `BrickLink / release order`, `Character`, `Movie / series`, and `Name` works.
- Images load from remote URLs.

## If sign-in fails

Check these first:

1. `Authentication > Sign-in method > Google` is enabled.
2. The domain you are using is listed in `Authentication > Settings > Authorized domains`.
3. You are signing in as `calebdueck@gmail.com`.
4. The values in [firebase-config.js](site/src/firebase-config.js) still match the web app shown in Firebase console.

## If data does not save

Check these next:

1. Firestore Database exists in the same Firebase project.
2. Firestore rules are deployed:

```bash
firebase deploy --only firestore:rules
```

3. In Firestore, look for the path:

```text
users/{your_uid}/state/main
```

4. If the document exists but writes fail, open browser devtools and inspect the Firestore permission error.

## GitHub Pages option

This repo includes a GitHub Pages workflow at [.github/workflows/pages.yml](.github/workflows/pages.yml). To use it:

1. Push the repo to GitHub.
2. In GitHub, enable `Pages` for the repository using `GitHub Actions`.
3. Run the workflow or push to `main`.
4. Add `calebdueck.github.io` to Firebase `Authorized domains`.

If you host on GitHub Pages, Firebase Auth and Firestore still remain the backend.

## Firebase Hosting option

This repo also includes [firebase.json](firebase.json) and [.firebaserc](.firebaserc). After installing the Firebase CLI:

```bash
firebase login
firebase deploy
```

That is the cleaner production host for this app.
