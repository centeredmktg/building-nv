import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reconcilePayments, isConnected } from "@/lib/quickbooks/sync";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isConnected())) {
    return NextResponse.json({ error: "No active QBO connection" }, { status: 422 });
  }

  const result = await reconcilePayments();

  return NextResponse.json(result);
}
