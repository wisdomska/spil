#!/usr/bin/env node
// Rejects commit messages that carry AI attribution. Used by the Husky
// commit-msg hook (path argument) and by CI (message on stdin).
import { readFileSync } from "node:fs";

const BANNED = /co-authored-by|generated with|claude|anthropic/i;

const file = process.argv[2];
const message = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8");
const body = message
  .split("\n")
  .filter((line) => !line.startsWith("#"))
  .join("\n");

const match = body.match(BANNED);
if (match) {
  console.error(`commit message rejected: contains "${match[0]}". AI attribution is not allowed.`);
  process.exit(1);
}
