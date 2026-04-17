import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOAuthClient } from "@/lib/quickbooks/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oauthClient = getOAuthClient();

  try {
    const response = await oauthClient.createToken(req.url);
    const token = response.getJson();

    // Deactivate any existing connections
    await prisma.qboConnection.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    const realmId = token.realmId || oauthClient.getToken().realmId;
    let companyName = `QBO Company ${realmId}`;

    try {
      oauthClient.setToken(token);
      const companyInfo = await oauthClient.makeApiCall({
        url: `https://${
          process.env.QBO_ENVIRONMENT === "production"
            ? "quickbooks"
            : "sandbox-quickbooks"
        }.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`,
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const parsed = companyInfo.json || JSON.parse(companyInfo.body);
      companyName = parsed.CompanyInfo?.CompanyName || companyName;
    } catch {
      // Use fallback name
    }

    await prisma.qboConnection.create({
      data: {
        realmId,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
        refreshTokenExpiresAt: new Date(
          Date.now() + token.x_refresh_token_expires_in * 1000
        ),
        companyName,
        connectedBy: session.user?.email || "unknown",
        isActive: true,
      },
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${baseUrl}/internal/settings/quickbooks?connected=true`
    );
  } catch (error) {
    console.error("[QBO] OAuth callback error:", error);
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${baseUrl}/internal/settings/quickbooks?error=auth_failed`
    );
  }
}
