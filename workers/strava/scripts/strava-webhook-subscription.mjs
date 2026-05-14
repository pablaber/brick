#!/usr/bin/env node

import process from 'node:process';

const STRAVA_PUSH_SUBSCRIPTIONS_URL = 'https://www.strava.com/api/v3/push_subscriptions';

const command = process.argv[2];

if (!command || !['view', 'create', 'delete'].includes(command)) {
  printUsage();
  process.exit(1);
}

const clientId = requireEnv('STRAVA_CLIENT_ID');
const clientSecret = requireEnv('STRAVA_CLIENT_SECRET');

if (command === 'view') {
  await viewSubscription({ clientId, clientSecret });
  process.exit(0);
}

if (command === 'create') {
  const callbackUrl = requireEnv('STRAVA_WEBHOOK_CALLBACK_URL');
  const verifyToken = requireEnv('STRAVA_WEBHOOK_VERIFY_TOKEN');

  await createSubscription({
    clientId,
    clientSecret,
    callbackUrl,
    verifyToken
  });
  process.exit(0);
}

if (command === 'delete') {
  const subscriptionId = process.argv[3];
  if (!subscriptionId) {
    console.error('Missing subscription id. Usage: webhook:delete -- <subscription-id>');
    process.exit(1);
  }

  await deleteSubscription({ clientId, clientSecret, subscriptionId });
  process.exit(0);
}

async function viewSubscription({ clientId, clientSecret }) {
  const url = new URL(STRAVA_PUSH_SUBSCRIPTIONS_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);

  const response = await fetch(url, { method: 'GET' });
  const body = await parseJsonBody(response);

  if (!response.ok) {
    throw new Error(
      `Unable to view Strava webhook subscription: ${response.status} ${safeStringify(body)}`
    );
  }

  console.log(safeStringify(body));
}

async function createSubscription({ clientId, clientSecret, callbackUrl, verifyToken }) {
  const existing = await fetchFirstSubscription({ clientId, clientSecret });
  if (existing) {
    console.log('A Strava webhook subscription already exists for this app.');
    console.log(safeStringify(existing));
    return;
  }

  const response = await fetch(STRAVA_PUSH_SUBSCRIPTIONS_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      callback_url: callbackUrl,
      verify_token: verifyToken
    }).toString()
  });
  const body = await parseJsonBody(response);

  if (!response.ok) {
    throw new Error(
      `Unable to create Strava webhook subscription: ${response.status} ${safeStringify(body)}`
    );
  }

  console.log('Created Strava webhook subscription.');
  console.log(safeStringify(body));
}

async function deleteSubscription({ clientId, clientSecret, subscriptionId }) {
  const url = new URL(`${STRAVA_PUSH_SUBSCRIPTIONS_URL}/${encodeURIComponent(subscriptionId)}`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);

  const response = await fetch(url, { method: 'DELETE' });
  const body = await parseJsonBody(response);

  if (!response.ok) {
    throw new Error(
      `Unable to delete Strava webhook subscription: ${response.status} ${safeStringify(body)}`
    );
  }

  console.log('Deleted Strava webhook subscription.');
  if (body != null) {
    console.log(safeStringify(body));
  }
}

async function fetchFirstSubscription({ clientId, clientSecret }) {
  const url = new URL(STRAVA_PUSH_SUBSCRIPTIONS_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);

  const response = await fetch(url, { method: 'GET' });
  const body = await parseJsonBody(response);

  if (!response.ok) {
    throw new Error(`Unable to check existing Strava subscription: ${response.status}`);
  }

  if (!Array.isArray(body) || body.length === 0) {
    return null;
  }

  return body[0];
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function parseJsonBody(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function printUsage() {
  console.error('Usage: node scripts/strava-webhook-subscription.mjs <view|create|delete <id>>');
}
