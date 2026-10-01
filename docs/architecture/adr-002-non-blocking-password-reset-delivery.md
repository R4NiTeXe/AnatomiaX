# ADR-002: Non-Blocking Password-Reset Delivery

Status: accepted.

## Context

`AuthService.requestPasswordReset` awaited `PasswordResetDelivery.dispatch`,
so the HTTP response waited on SMTP I/O. The transporter already had bounded
timeouts (10s connect/greeting, 20s socket), but a dead relay still held the
request — and its worker — for tens of seconds, and a slow relay added
latency to every reset request.

## Decision

- Fire-and-forget dispatch: `void Promise.resolve().then(() => dispatch())`
  with a `.catch(() => undefined)` sink. Deferring past the tick also
  contains a synchronously throwing transport so the request still resolves.
- Anti-enumeration semantics unchanged: the endpoint always returns
  `{ status: 'ok' }`, dispatch never throws and never logs tokens/URLs, and
  the token row is created before dispatch starts.
- Bounded transporter timeouts stay as the second line of defense for the
  background send itself.
- E2E tests flush one macrotask (`setImmediate`) after the request before
  asserting on the fake delivery — the only place that observes the
  now-async side effect.

## Consequences

- Reset-request latency is DB-bound only. Delivery failures are visible in
  server logs, not in responses (by design — no oracle).
- Any future test asserting on delivery side effects must flush the
  deferred dispatch first.
