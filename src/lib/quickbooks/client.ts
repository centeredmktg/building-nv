import OAuthClient from "intuit-oauth";
import { prisma } from "@/lib/prisma";
import type { QboApiError } from "./types";

const QBO_BASE_URLS = {
  sandbox: "https://sandbox-quickbooks.api.intuit.com/v3/company",
  production: "https://quickbooks.api.intuit.com/v3/company",
} as const;

type QboEnvironment = "sandbox" | "production";

export function buildQboUrl(
  environment: QboEnvironment,
  realmId: string,
  entity: string,
  entityId?: string
): string {
  const base = QBO_BASE_URLS[environment];
  const path = entityId ? `${entity}/${entityId}` : entity;
  return `${base}/${realmId}/${path}`;
}

export function parseQboError(body: unknown): string {
  if (!body || typeof body !== "object") return "Unknown QBO API error";
  const fault = (body as QboApiError).Fault;
  if (!fault?.Error?.length) return "Unknown QBO API error";
  const err = fault.Error[0];
  return `${err.Message}: ${err.Detail}`;
}

function getEnvironment(): QboEnvironment {
  return (process.env.QBO_ENVIRONMENT as QboEnvironment) || "sandbox";
}

function createOAuthClient(): OAuthClient {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const redirectUri = process.env.QBO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "QBO_CLIENT_ID, QBO_CLIENT_SECRET, and QBO_REDIRECT_URI must be set"
    );
  }

  return new OAuthClient({
    clientId,
    clientSecret,
    environment: getEnvironment() === "production" ? "production" : "sandbox",
    redirectUri,
  });
}

async function getActiveConnection() {
  const connection = await prisma.qboConnection.findFirst({
    where: { isActive: true },
  });
  if (!connection) throw new Error("No active QBO connection");
  return connection;
}

async function refreshTokenIfNeeded(
  oauthClient: OAuthClient,
  connection: Awaited<ReturnType<typeof getActiveConnection>>
) {
  // Refresh if access token expires within 5 minutes
  const fiveMinutes = 5 * 60 * 1000;
  if (connection.accessTokenExpiresAt.getTime() - Date.now() < fiveMinutes) {
    oauthClient.setToken({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
      token_type: "bearer",
      expires_in: 0,
      x_refresh_token_expires_in: 0,
      realmId: connection.realmId,
    });

    const response = await oauthClient.refresh();
    const newToken = response.getJson();

    await prisma.qboConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: newToken.access_token,
        refreshToken: newToken.refresh_token,
        accessTokenExpiresAt: new Date(
          Date.now() + newToken.expires_in * 1000
        ),
        refreshTokenExpiresAt: new Date(
          Date.now() + newToken.x_refresh_token_expires_in * 1000
        ),
      },
    });

    return newToken.access_token;
  }

  return connection.accessToken;
}

/**
 * Make an authenticated request to the QBO REST API.
 * Handles token refresh and retry on 401.
 */
export async function qboRequest<T>(
  method: "GET" | "POST",
  entity: string,
  entityId?: string,
  body?: unknown
): Promise<T> {
  const connection = await getActiveConnection();
  const oauthClient = createOAuthClient();
  const accessToken = await refreshTokenIfNeeded(oauthClient, connection);

  const url = buildQboUrl(
    getEnvironment(),
    connection.realmId,
    entity,
    entityId
  );

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 429) {
    // Rate limited — wait and retry once
    await new Promise((r) => setTimeout(r, 2000));
    const retryResponse = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!retryResponse.ok) {
      const errorBody = await retryResponse.json().catch(() => null);
      throw new Error(parseQboError(errorBody));
    }

    return retryResponse.json() as Promise<T>;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(parseQboError(errorBody));
  }

  return response.json() as Promise<T>;
}

/**
 * Query QBO entities using SQL-like query syntax.
 */
export async function qboQuery<T>(query: string): Promise<T> {
  const connection = await getActiveConnection();
  const oauthClient = createOAuthClient();
  const accessToken = await refreshTokenIfNeeded(oauthClient, connection);

  const baseUrl = QBO_BASE_URLS[getEnvironment()];
  const url = `${baseUrl}/${connection.realmId}/query?query=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(parseQboError(errorBody));
  }

  return response.json() as Promise<T>;
}

/**
 * Get the intuit-oauth client for OAuth flow (auth routes only).
 */
export function getOAuthClient(): OAuthClient {
  return createOAuthClient();
}
