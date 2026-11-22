# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅ Active |

## Reporting a Vulnerability

PokeGuru is a client-side static application with no backend, database, or user accounts.

If you discover a security vulnerability, please open an issue at:

https://github.com/Linacre/PokeGuru/issues

Please do not disclose the issue publicly until it has been addressed.

## Dependencies and runtime

- **Runtime:** production (Vercel) and CI both build on Node.js 26. The
  `engines`-free `package.json` avoids pinning users to a version that cannot run
  the build, but a Node 26+ toolchain is what is tested.
- **Production audit gate:** CI runs `npm audit --omit=dev --audit-level=high` and
  fails on any high or critical advisory in a production dependency. There are
  currently none.
- **Development-only advisories** are reported but do not block a release; they
  are fixed through reviewed pull requests rather than `npm audit fix --force`,
  which can introduce breaking upgrades.
- **No source maps ship.** CI fails the build if a `.map` file appears in `dist`.
- **CSP and headers** are set both in `vercel.json` (response headers) and as a
  `<meta>` tag for static hosts; the two policies are kept identical.
