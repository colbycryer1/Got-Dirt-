const ACC_BASE = "https://developer.api.autodesk.com";
const CLIENT_ID = process.env.ACC_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.ACC_CLIENT_SECRET ?? "";
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/acc/callback`;

export function getAccAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "data:read data:write",
    state,
  });
  return `https://developer.api.autodesk.com/authentication/v2/authorize?${params}`;
}

export async function exchangeAccCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
  });
  const res = await fetch(`${ACC_BASE}/authentication/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`ACC token exchange failed: ${res.status}`);
  return res.json();
}

export async function refreshAccToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  const res = await fetch(`${ACC_BASE}/authentication/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`ACC token refresh failed: ${res.status}`);
  return res.json();
}

export async function getAccUserProfile(accessToken: string) {
  const res = await fetch(`${ACC_BASE}/userprofile/v1/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`ACC profile fetch failed: ${res.status}`);
  return res.json() as Promise<{ userId: string; userName: string; emailId: string }>;
}

export async function getAccHubs(accessToken: string) {
  const res = await fetch(`${ACC_BASE}/project/v1/hubs`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`ACC hubs fetch failed: ${res.status}`);
  return res.json() as Promise<{ data: Array<{ id: string; attributes: { name: string } }> }>;
}

export async function createAccBudgetLineItem(
  accessToken: string,
  projectId: string,
  containerId: string,
  data: {
    description: string;
    amount: number; // dollars
    budgetSegmentId?: string;
    date: string; // YYYY-MM-DD
    referenceNumber?: string;
  }
) {
  const body = {
    data: {
      type: "budget_payment_applications",
      attributes: {
        description: data.description,
        amount: data.amount,
        date: data.date,
        reference_number: data.referenceNumber,
        budget_segment_id: data.budgetSegmentId,
      },
    },
  };

  const res = await fetch(
    `${ACC_BASE}/cost/v1/containers/${containerId}/payment-applications`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ACC budget line item creation failed: ${err}`);
  }
  return res.json();
}
