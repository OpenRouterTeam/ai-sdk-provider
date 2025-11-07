# Contributing to the OpenRouter AI SDK Provider

Thank you for your interest in contributing to the OpenRouter provider for the Vercel AI SDK! This guide will help you get started as a contributor.

## Getting Started

### Prerequisites

- Node.js v18 or higher
- pnpm v9.15.0 or higher (the project uses pnpm as its package manager)

### Setting Up the Repository

1. Fork the repository on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/YOUR-USERNAME/ai-sdk-provider.git
   cd ai-sdk-provider
   ```

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Build the project:

   ```bash
   pnpm build
   ```

## Development Workflow

### Building

To build the package during development:

```bash
# Build once
pnpm build

# Build in watch mode for continuous development
pnpm dev
```

### Code Style and Formatting

We use Biome for code linting and formatting. Before submitting a PR, make sure your code passes all checks:

```bash
# Check both linting and formatting
pnpm stylecheck

# Fix formatting issues automatically
pnpm format

# Run linting and formatting checks
pnpm stylecheck
```

### Type Checking

Ensure your changes pass TypeScript type checking:

```bash
pnpm typecheck
```

## Testing

The project includes tests for both Node.js and Edge environments. Make sure to run the tests before submitting a PR:

```bash
# Run all tests
pnpm test

# Run only Node.js tests
pnpm test:node

# Run only Edge environment tests
pnpm test:edge
```

### Writing Tests

When adding new features or fixing bugs, please include tests. Test files follow the naming convention of `*.test.ts` and are located in the same directory as the files they test.

Examples of test files include:

- `openrouter-chat-language-model.test.ts`
- `openrouter-usage-accounting.test.ts`
- `openrouter-stream-usage-accounting.test.ts`

## Adding New Features

When adding new features to the OpenRouter provider:

1. Start by understanding the existing architecture in the `src` directory
2. Update the relevant type definitions in `types.ts` if needed
3. Implement the feature in the appropriate files
4. Add tests to verify the functionality
5. Update the README.md to document the new feature
6. Update the CHANGELOG.md if applicable

### Example: Usage Accounting Feature

The usage accounting feature provides an example of how to add features to the provider:

1. Added types in `types.ts` for usage accounting
2. Enhanced response schemas to include usage data
3. Updated the implementation in `openrouter-chat-language-model.ts`
4. Added tests in `openrouter-usage-accounting.test.ts` and `openrouter-stream-usage-accounting.test.ts`
5. Updated README.md with usage examples

## Pull Request Process

1. Create a new branch for your changes
2. Make your changes, including tests and documentation updates
3. Run all checks locally before submitting:
   ```bash
   pnpm stylecheck    # Check formatting
   pnpm typecheck     # Check types
   pnpm build         # Build the project
   pnpm test          # Run all tests
   ```
4. Fix any issues found by the checks (use `pnpm format` for formatting)
5. Commit with clear, descriptive messages
6. Push to your fork and submit a pull request
7. Update the PR description with any relevant information

**Note:** Our CI will automatically run all these checks on your PR. PRs with failing checks cannot be merged.

### PR Title Convention

Use a descriptive title that explains the change:

- `fix: <description>` for bug fixes
- `feat: <description>` for new features
- `docs: <description>` for documentation changes
- `test: <description>` for test changes
- `chore: <description>` for maintenance tasks

## Release Process

The project maintainers will handle versioning and publishing. When your contribution is merged, it will be included in the next release.

## Getting Help

If you have questions about contributing, please open a GitHub issue in the repository.

Thank you for contributing to the OpenRouter AI SDK Provider!
