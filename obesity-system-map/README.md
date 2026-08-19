# Obesity Systems Explorer

A client-only React application for exploring the Foresight obesity system map,
tracing causal routes, creating de-identified persona profiles, and reviewing HPB
programme reach.

## Requirements

- Node 24.13.0
- npm 11.6.2

The versions are pinned in `.nvmrc`, `package.json`, and the production image.

## Local development

```sh
npm ci
npm run dev
```

Before opening a pull request or release:

```sh
npm run check
```

This runs linting, unit/data-integrity tests, the production build, and the
production dependency audit.

## Production deployment

The portable production target is the included Docker image:

```sh
docker build -t obesity-system-map .
docker run --rm -p 8080:8080 obesity-system-map
```

The app is then available at `http://localhost:8080/`; `/healthz` is the health
probe. Terminate TLS at the deployment platform. The nginx configuration owns SPA
fallback, compression, cache policy, and browser security headers.

For a non-container static host, publish `dist/` and reproduce the routing,
caching, and headers from `nginx.conf`. The default build is rooted at `/`. For a
subpath deployment:

```sh
VITE_BASE_PATH=/obesity-map/ npm run build
```

Configure the host to fall back unknown application routes to `index.html`.

## Data handling

Profiles are stored only in the browser and can be exported as JSON. Use fictional
or de-identified personas; do not enter real names or identifiable health data.
See `public/privacy.html` and `SECURITY.md` before production release.

## Release checklist

1. Start from a clean, reviewed commit on `main`.
2. Confirm the CI `verify` and `container` jobs pass.
3. Replace the placeholder security/privacy contact in `SECURITY.md`.
4. Confirm the final hostname, TLS, monitoring, and backup/rollback owner.
5. Smoke-test Explore, Trace, Profile, Intervention, JSON import/export, and PNG
   export in supported browsers and at mobile/tablet/desktop widths.
