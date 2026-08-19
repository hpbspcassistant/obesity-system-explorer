# Security and deployment notes

## Supported deployment

The production baseline is the multi-stage `Dockerfile`, which builds the app
with pinned Node/npm versions and serves the static output through nginx on port
8080. TLS must terminate at the platform ingress or load balancer.

The nginx configuration provides SPA fallback, compression, immutable caching
for hashed assets, a health endpoint at `/healthz`, and restrictive browser
security headers. Review `frame-ancestors` before embedding the app in another
site.

## Data boundary

The app has no backend and makes no external data requests. Persona profiles are
stored in browser local storage and may be exported to JSON. Production operators
must instruct users to use fictional or de-identified personas and define shared
device and exported-file handling.

## Dependency audit

CI runs `npm audit --omit=dev --audit-level=high`. Build-only packages are kept in
`devDependencies`, so the production dependency audit covers code that forms the
runtime application. A full dependency audit currently passes as well.

## Reporting

Replace this section with the deployment owner's security and privacy contact
before public release.
