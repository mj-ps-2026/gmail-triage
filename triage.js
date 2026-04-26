#!/usr/bin/env node
/**
 * inbox-triage.js — 3-tier version
 * Tiers: inbox (action needed) | digest (FYI, archived) | archive (junk)
 */

import { google } from "googleapis";
import fetch from "node-fetch";

const {
  GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN,
  GEMINI_API_KEY, DIGEST_TO_EMAIL,
  LOOKBACK_HOURS = "1", DRY_RUN = "false",
} = process.env;

const isDryRun = DRY_RUN === "true";
const lookbackMs = parseFloat(LOOKBACK_HOURS) * 60 * 60 * 1000;

// Pre-classified as DIGEST (useful, no action, remove from inbox)
const ALWAYS_DIGEST_PATTERNS = [
  /monarch\.com$/i,
  /musicologie\.app$/i,
  /parentsquare\.com$/i,
  /ptboard\.com$/i,
  /amazon\.com$/i,
  /accounts\.google\.com$/i,
  /linkedin\.com$/i,
  /substack\.com$/i,
  /politico\.com$/i,
  /nextdoor\.com$/i,
  /ifttt\.com$/i,
  /infoemail\.microsoft\.com$/i,
  /customeremail\.microsoftrewards\.com$/i,
];

// Pre-classified as INBOX (always high signal, keep in inbox)
const ALWAYS_INBOX_PATTERNS = [
  /igotanoffer\.com$/i,
  /gethealthie\.com$/i,
  /anthropic\.com$/i,
  /github\.com$/i,
];

// Always archived without AI
const ALWAYS_ARCHIVE_PATTERNS = [
  /turnoutpac\.org$/i,
  /dccc\.org$/i,
  /ak\.dccc\.org$/i,
  /chrispappas\.org$/i,
  /harderforcongress\.com$/i,
  /jamestalarico\.com$/i,
];

function buildGmailClient() {
  const auth = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth });
}

function getSenderDomain(s = "") {
  const m = s.match(/@([\w.-]+)/);
  return m ? m[1].toLowerCase() : "";
}

function preClassify(sender) {
  const d = getSenderDomain(sender);
  if (ALWAYS_ARCHIVE_PATTERNS.some((p) => p.test(d))) return "archive";
  if (ALWAYS_INBOX_PATTERNS.some((p) => p.test(d))) return "inbox";
  if (ALWAYS_DIGEST_PATTERNS.some((p) => p.test(d))) return "digest";
  return null;
}

function extractHeader(headers, name) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function classifyBatch(emails) {
  const list = emails
    .map((e, i) => `[${i}] ID:${e.id}\nFrom: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet}`)
    .join("\n\n");

  const prompt = `You are triaging email for MJ, a product manager. Classify each email into one of three tiers:

INBOX — requires MJ to DO something or RESPOND to someone. A real person is waiting or inaction has a consequence.
DIGEST — useful to know but no action needed (notifications, confirmations, newsletters, alerts, FYI emails).
ARCHIVE — junk: political fundraising, retail promos, travel deals, marketing, reward programs.

Core rule: if MJ doesn't need to do anything or respond to anyone → not INBOX.

Return ONLY a JSON array, no markdown:
[{"id":"...","tier":"inbox|digest|archive","summary":"One sentence (inbox: what action; digest: what happened; archive: empty)"}]

Emails:
${list}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  return JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
}

async function archiveThread(gmail, id) {
  if (isDryRun) { console.log(`[DRY RUN] archive ${id}`); return; }
  await gmail.users.threads.modify({ userId: "me", id, requestBody: { removeLabelIds: ["INBOX"] } });
}

function row(e) {
  const from = e.from.replace(/<.*>/, "").trim();
  return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;vertical-align:top;">
    <b>${from}</b> — ${e.subject}<br>
    <span style="color:#666;font-size:13px;">${e.summary}</span>
  </td></tr>`;
}

async function sendDigest(gmail, inbox, digest) {
  const total = inbox.length + digest.length;
  if (total === 0) { console.log("Nothing to digest."); return; }

  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });

  const inboxHtml = inbox.length ? `
    <h3 style="color:#c0392b;margin:24px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">⚡ Needs Attention (${inbox.length})</h3>
    <table style="width:100%;border-collapse:collapse;">${inbox.map(row).join("")}</table>` : "";

  const digestHtml = digest.length ? `
    <h3 style="color:#555;margin:24px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">📋 FYI (${digest.length})</h3>
    <table style="width:100%;border-collapse:collapse;">${digest.map(row).join("")}</table>` : "";

  const html = `<div style="font-family:-apple-system,Georgia,serif;max-width:620px;color:#1a1a1a;padding:0 16px;">
  <div style="border-bottom:3px solid #1a1a1a;padding-bottom:12px;margin-bottom:4px;">
    <h2 style="margin:0;font-size:20px;">📬 Inbox Digest</h2>
    <p style="margin:4px 0 0;color:#888;font-size:13px;">${now} · ${total} email${total !== 1 ? "s" : ""}</p>
  </div>
  ${inboxHtml}${digestHtml}
  <p style="color:#ccc;font-size:11px;margin-top:32px;">Gemini 2.0 Flash + GitHub Actions</p>
</div>`;

  const subject = inbox.length
    ? `📬 ${inbox.length} need attention, ${digest.length} FYI — ${now}`
    : `📋 Digest (${digest.length} FYI) — ${now}`;

  const msg = [`From: ${DIGEST_TO_EMAIL}`, `To: ${DIGEST_TO_EMAIL}`, `Subject: ${subject}`,
    `MIME-Version: 1.0`, `Content-Type: text/html; charset=utf-8`, ``, html].join("\r\n");
  const raw = Buffer.from(msg).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  if (isDryRun) { console.log(`[DRY RUN] digest: ${inbox.length} inbox, ${digest.length} FYI`); return; }
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  console.log(`✅ Digest sent — ${inbox.length} inbox, ${digest.length} FYI`);
}

async function main() {
  console.log(`\n🔍 Triage — lookback: ${LOOKBACK_HOURS}h, dry_run: ${isDryRun}\n`);
  const gmail = buildGmailClient();

  const cutoff = Math.floor((Date.now() - lookbackMs) / 1000);
  const listRes = await gmail.users.threads.list({ userId: "me", labelIds: ["INBOX"], q: `after:${cutoff}`, maxResults: 200 });
  const threads = listRes.data.threads ?? [];
  console.log(`📥 ${threads.length} threads\n`);
  if (!threads.length) return;

  const emails = [];
  for (const t of threads) {
    try {
      const d = await gmail.users.threads.get({ userId: "me", id: t.id, format: "METADATA", metadataHeaders: ["From", "Subject"] });
      const msg = d.data.messages?.[0];
      const h = msg?.payload?.headers ?? [];
      emails.push({ id: t.id, from: extractHeader(h, "From"), subject: extractHeader(h, "Subject"), snippet: msg?.snippet?.slice(0, 200) ?? "" });
    } catch (e) { console.warn(`Skip ${t.id}: ${e.message}`); }
    await sleep(50);
  }

  const forAI = [], preInbox = [], preDigest = [], preArchive = [];
  for (const e of emails) {
    const tier = preClassify(e.from);
    if (tier === "archive") preArchive.push(e);
    else if (tier === "inbox") preInbox.push({ ...e, summary: "(see email)" });
    else if (tier === "digest") preDigest.push({ ...e, summary: e.snippet?.slice(0, 100) ?? "" });
    else forAI.push(e);
  }

  console.log(`🏷️  Pre: ${preInbox.length} inbox, ${preDigest.length} digest, ${preArchive.length} archive, ${forAI.length} → AI\n`);

  for (const e of preArchive) { console.log(`🗑️  ${e.from} — ${e.subject}`); await archiveThread(gmail, e.id); await sleep(100); }
  for (const e of preDigest) { console.log(`📋 ${e.from} — ${e.subject}`); await archiveThread(gmail, e.id); await sleep(100); }

  const aiInbox = [], aiDigest = [];
  for (let i = 0; i < forAI.length; i += 15) {
    const batch = forAI.slice(i, i + 15);
    console.log(`\n🤖 Batch ${Math.floor(i/15)+1}/${Math.ceil(forAI.length/15)} (${batch.length})...`);
    try {
      const results = await classifyBatch(batch);
      const map = Object.fromEntries(results.map((r) => [r.id, r]));
      for (const e of batch) {
        const r = map[e.id];
        if (!r) { aiInbox.push({ ...e, summary: "(unclassified)" }); continue; }
        if (r.tier === "archive") { console.log(`🗑️  ${e.from} — ${e.subject}`); await archiveThread(gmail, e.id); await sleep(100); }
        else if (r.tier === "digest") { console.log(`📋 ${e.from} — ${e.subject}`); aiDigest.push({ ...e, summary: r.summary }); await archiveThread(gmail, e.id); await sleep(100); }
        else { console.log(`⚡ ${e.from} — ${e.subject}`); aiInbox.push({ ...e, summary: r.summary }); }
      }
    } catch (err) {
      console.error(`Gemini error: ${err.message}`);
      for (const e of batch) aiInbox.push({ ...e, summary: "(AI error)" });
    }
    await sleep(1000);
  }

  const allInbox = [...preInbox, ...aiInbox];
  const allDigest = [...preDigest, ...aiDigest];
  console.log(`\n📊 ${allInbox.length} inbox, ${allDigest.length} digest`);
  await sendDigest(gmail, allInbox, allDigest);
}

main().catch((e) => { console.error(e); process.exit(1); });
