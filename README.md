# Star Wars Minifigure Holocron

Private LEGO Star Wars minifigure tracker with:

- a full local catalog built from Rebrickable bulk downloads
- collection logging with quantity, condition, acquisition source, and upgrade notes
- a ranked wishlist
- sorting by release fallback, character, and movie or series
- local mode by default, with Firebase Auth + Firestore sync once configured

## App files

- App entry: [site/index.html](site/index.html)
- Firebase config to fill: [site/src/firebase-config.js](site/src/firebase-config.js)
- Catalog builder: [scripts/build_catalog.py](scripts/build_catalog.py)
- Catalog overrides: [catalog/overrides.json](catalog/overrides.json)
- Test checklist: [TESTING.md](TESTING.md)

## Local run

Serve the `site/` directory over HTTP:

```bash
python3 -m http.server 4173 -d site
```

Then open `http://localhost:4173`.

If Firebase config is blank, the app runs in local device mode and saves state in `localStorage`.

## Firebase setup

1. Create a Firebase project.
2. Register a Web app in Firebase.
3. Enable Google Authentication in Firebase Auth.
4. Create a Firestore database in production or test mode.
5. Copy your Web app values into [site/src/firebase-config.js](site/src/firebase-config.js).

Required values:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

Optional:

- `ownerEmail` to reject the wrong signed-in Google account in the UI

## Firestore rules

The repo includes [firestore.rules](firestore.rules). This version allows a signed-in user to read and write only their own `users/{uid}/state/main` document.

## Firebase Hosting

The repo includes [firebase.json](firebase.json) with Hosting pointed at `site/`.

Typical deploy flow:

```bash
firebase login
firebase deploy
```

This repo includes [.firebaserc](.firebaserc), so the default project is already set to `lego-tracker-490006`.

## GitHub Pages

The repo includes a GitHub Pages workflow at [.github/workflows/pages.yml](.github/workflows/pages.yml) that publishes the contents of `site/`.

Your current Pages URL is:

```text
https://calebdueck.github.io/lego-minifigure-tracker/
```

If you host on GitHub Pages, add `calebdueck.github.io` to Firebase `Authentication > Settings > Authorized domains`.

## Catalog rebuild

Rebuild the catalog whenever you want fresher source data:

```bash
python3 scripts/build_catalog.py
```

This writes:

- [catalog.json](site/data/catalog.json)
- [catalog-meta.json](site/data/catalog-meta.json)

## Notes

- The catalog currently uses Rebrickable bulk data as the canonical source.
- `bricklinkNumber` is override-driven. Until that mapping is enriched, the app falls back to first Star Wars appearance order for the `BrickLink / release order` sort.
