# Admin deployment checklist

The admin UI and Firebase rules both require the Firebase Authentication custom claim `admin: true`.
The claim script uses the Firebase Admin SDK only and must be run from a trusted local or server environment.
Never place a service-account JSON file in this repository or expose it through a `VITE_` environment variable.

## 1. Assign the custom claim

Authenticate Application Default Credentials for Firebase project `airbrushnink-9f735`. Use either a trusted service account through `GOOGLE_APPLICATION_CREDENTIALS` or local ADC configured with Google Cloud CLI.

Then run one of:

```powershell
npm run admin:claim -- --project-id airbrushnink-9f735
npm run admin:claim -- --email airbrushnink@gmail.com --project-id airbrushnink-9f735
npm run admin:claim -- --uid 1AWLkAfMGjgDSNik9bRsIWROGW73 --project-id airbrushnink-9f735
```

The no-argument form verifies that the email still resolves to the expected UID before assigning the claim. The script preserves existing custom claims and prints the resolved UID, email, and `admin` value.

After assigning the claim, sign out of the website and sign back in. Existing Firebase ID tokens do not gain new claims until refreshed.

## 2. Deploy Firebase rules

Review the project selection first:

```powershell
firebase use
firebase deploy --only firestore:rules
firebase deploy --only storage
```

The rules keep all browser access to `orders` denied. Public reads are limited to `siteContent/home` and the Storage paths used by the homepage, gallery, and storefront. Only an authenticated token with `admin: true` can write those paths.

## 3. Build and publish the frontend

```powershell
npm test
npm run lint
npm run build
```

The build lifecycle now copies `index.html` into known client-side route directories, including `admin`, `admin/home`, `admin/artwork`, `login`, `upload`, and the public portfolio/gallery routes.

The restored admin sections are:

- `/admin` - overview
- `/admin/home` - homepage content
- `/admin/artwork` - artwork and portfolio media in Firebase Storage
- `/upload` - compatibility redirect to `/admin/artwork`

Shop products do not have a Firebase admin collection. Product metadata and Stripe Price IDs remain maintained in `src/data/products.js` and must ship through a reviewed frontend deployment.

After review, commit and push normally. Do not run the repository's GitHub Pages deploy command for the DigitalOcean production site.

## 4. Configure DigitalOcean App Platform

In the static-site component settings, configure the custom page as:

```yaml
catchall_document: index.html
```

In the control panel this is **Settings > Static Site > Custom Pages > Catchall**, with page name `index.html`. A catch-all is preferred over the JavaScript `404.html` compatibility fallback because direct client-side routes return the application shell immediately.

Trigger a manual DigitalOcean deployment only after the frontend commit is available to App Platform. Verify direct, refreshed visits to `/admin`, `/admin/home`, and `/login` after deployment.
