import test from "node:test";
import assert from "node:assert/strict";
import { parseVCards } from "../src/lib/vcard";

const SAMPLE = `BEGIN:VCARD
VERSION:3.0
FN:Riya Kapoor
N:Kapoor;Riya;;;
TEL;TYPE=CELL:+91 98765 43210
EMAIL;TYPE=INTERNET:riya@example.com
END:VCARD
BEGIN:VCARD
VERSION:2.1
N:Iyer;Sam;;;
TEL;TYPE=CELL:9876500000
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:No Contact Details
END:VCARD`;

test("reads name, phone and email out of a vCard export", () => {
  const contacts = parseVCards(SAMPLE);
  assert.equal(contacts.length, 2, "the contact with no phone or email is skipped");

  assert.deepEqual(contacts[0], {
    name: "Riya Kapoor",
    emails: ["riya@example.com"],
    phones: ["+91 98765 43210"],
  });

  // Falls back to the structured N field when FN is missing.
  assert.equal(contacts[1].name, "Sam Iyer");
  assert.deepEqual(contacts[1].phones, ["9876500000"]);
});

test("handles CRLF, folded lines and item-prefixed keys", () => {
  const folded = [
    "BEGIN:VCARD",
    "FN:A Very Long Name That Got",
    "  Folded",
    "item1.EMAIL;type=INTERNET:folded@example.com",
    "END:VCARD",
  ].join("\r\n");

  const [contact] = parseVCards(folded);
  assert.equal(contact.name, "A Very Long Name That Got Folded");
  assert.deepEqual(contact.emails, ["folded@example.com"]);
});

test("decodes quoted-printable values", () => {
  const encoded = [
    "BEGIN:VCARD",
    "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Jos=C3=A9",
    "TEL:+919876543210",
    "END:VCARD",
  ].join("\n");

  assert.equal(parseVCards(encoded)[0].name, "José");
});

test("empty or junk input yields nothing rather than throwing", () => {
  assert.deepEqual(parseVCards(""), []);
  assert.deepEqual(parseVCards("not a vcard at all"), []);
});
