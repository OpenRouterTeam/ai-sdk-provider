# Changelog

All notable changes to the OpenRouter AI SDK Provider will be documented in this file.

## [Unreleased] - 2025-05-22

### Added

- Added support for OpenRouter usage accounting feature
  - Allows tracking token usage details directly in API responses
  - Includes cost, cached tokens, and reasoning tokens information
  - Available in both streaming and non-streaming APIs
  - See [Usage Accounting PR](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/64) for details

### Changed

- Updated schema to support OpenRouter usage accounting response format

## [0.4.2]

### Added

- Anthropic cache control

## [Unreleased]

### Fixed

- Fixed type compatibility with ai SDK v3.4.33 by properly exporting LanguageModelV1 interface types
