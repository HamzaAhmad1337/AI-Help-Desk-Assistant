import test from "node:test";
import assert from "node:assert/strict";
import {
  createTicket,
  listTickets,
  getTicket,
  ValidationError,
  _resetForTests,
  _removeForTests,
} from "../src/tickets.js";

test.beforeEach(() => _resetForTests());

test("creates a ticket with a reference and open status", () => {
  const ticket = createTicket({ subject: "VPN down", description: "Cannot connect." });
  assert.match(ticket.reference, /^HD-\d{4}-\d{4}$/);
  assert.equal(ticket.status, "open");
  assert.equal(ticket.priority, "normal");
});

test("references increment", () => {
  const first = createTicket({ subject: "A", description: "a" });
  const second = createTicket({ subject: "B", description: "b" });
  assert.notEqual(first.reference, second.reference);
});

test("rejects a missing subject", () => {
  assert.throws(() => createTicket({ description: "no subject" }), ValidationError);
});

test("rejects a missing description", () => {
  assert.throws(() => createTicket({ subject: "no body" }), ValidationError);
});

test("rejects an invalid priority", () => {
  assert.throws(
    () => createTicket({ subject: "A", description: "a", priority: "catastrophic" }),
    ValidationError
  );
});

test("truncates overlong input rather than rejecting it", () => {
  const ticket = createTicket({ subject: "x".repeat(500), description: "y".repeat(9000) });
  assert.equal(ticket.subject.length, 200);
  assert.equal(ticket.description.length, 4000);
});

test("lists newest first and looks up by reference", () => {
  createTicket({ subject: "First", description: "1" });
  const second = createTicket({ subject: "Second", description: "2" });

  assert.equal(listTickets()[0].subject, "Second");
  assert.equal(getTicket(second.reference).subject, "Second");
  assert.equal(getTicket("HD-0000-9999"), null);
});

test("does not reissue a reference after an earlier ticket is removed", () => {
  const first = createTicket({ subject: "A", description: "a" });
  const second = createTicket({ subject: "B", description: "b" });

  // Simulate the first ticket being purged, then issue another. Deriving the
  // next reference from a count would hand out `second`'s reference again.
  _removeForTests(first.reference);
  const third = createTicket({ subject: "C", description: "c" });

  assert.notEqual(third.reference, second.reference);
  assert.notEqual(third.reference, first.reference);
});
