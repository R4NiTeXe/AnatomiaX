# ADR-003: Bounded Google OAuth Round-Trip

Status: accepted.

## Context

`passport-oauth20` performs the code exchange and profile fetch with no
built-in timeout: a stalled Google endpoint hangs the callback request
(and its worker) indefinitely. The `GoogleStrategy` options offer no
timeout knob, and the hang happens inside the passport guard — before any
controller code runs.

## Decision

- Bound `GoogleAuthGuard.canActivate` around `super.canActivate` with
  `withOAuthTimeout` (default 15s, tunable via `OAUTH_TIMEOUT_MS`).
- Timeout surfaces as `RequestTimeoutException` (408, generic message);
  the work's own error wins the race when it settles first, so real
  provider/auth failures are never masked. Late work rejection is absorbed
  to avoid unhandled rejections after the 408 is sent.
- `OAUTH_TIMEOUT_MS` is optional with a safe default; garbage falls back
  at runtime, and production boot validation rejects non-positive integers.
- The timeout helper is a pure exported function with unit specs; the guard
  itself stays thin (passport internals are not worth mocking).

## Consequences

- Worst-case callback latency is bounded; users see a retryable 408
  instead of a hanging request on provider stalls.
- The initial (redirect) leg resolves instantly, so the bound never bites
  there.
