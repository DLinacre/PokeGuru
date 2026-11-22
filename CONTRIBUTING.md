# Contributing to PokeGuru

Thank you for your interest in contributing to PokeGuru! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/lin4cre/PokeGuru/issues)
2. If not, create a new issue with:
   - Clear title describing the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/OS information
   - Screenshots if applicable

### Suggesting Features

1. Check existing issues for similar suggestions
2. Create a new issue with the "enhancement" label
3. Describe the feature and its use case
4. Explain how it benefits users

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Test your changes locally
5. Commit with clear, descriptive messages:
   ```bash
   git commit -m "feat: add card comparison feature"
   ```
6. Push to your fork
7. Open a Pull Request against `main`

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/PokeGuru.git
cd PokeGuru

# Install dependencies
npm install

# Start development server
npm run dev
```

## Code Style

- Use TypeScript for all new code
- Follow existing code patterns and naming conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Ensure code is formatted consistently

### Commit Message Format

Use conventional commits format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example:
```
feat: add card price history chart
fix: resolve search pagination issue
docs: update API usage documentation
```

## Testing

Before submitting a PR:

1. Ensure the app builds successfully:
   ```bash
   npm run build
   ```

2. Test on different screen sizes (mobile, tablet, desktop)

3. Verify functionality works as expected

## Questions?

Feel free to open an issue for any questions about contributing.

Thank you for helping make PokeGuru better! 🎴

## Testing before a pull request

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run test:e2e:install   # first time only: downloads Chromium
npm run test:e2e           # Playwright, four device profiles + axe-core
```

Browser tests run against the production build served by `vite preview`. If the
TCGdex API is unreachable they skip the data-dependent cases and say so rather
than inventing fixtures.

## Windows

Everything runs in PowerShell: there are no Unix-only environment prefixes in any
package script, and the GitHub Pages build is a Node wrapper
(`scripts/build-pages.mjs`).
