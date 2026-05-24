const PROCORE_BASE = "https://api.procore.com";
const CLIENT_ID = process.env.PROCORE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.PROCORE_CLIENT_SECRET ?? "";
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/procore/callback`;

export function getProcoreAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    state,
  });
  return `https://login.procore.com/oauth/authorize?${params}`;
}

export async function exchangeProcoreCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://login.procore.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
    }),
  });
  if (!res.ok) throw new Error(`Procore token exchange failed: ${res.status}`);
  return res.json();
}

export async function refreshProcoreToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://login.procore.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Procore token refresh failed: ${res.status}`);
  return res.json();
}

async function procoreGet<T>(path: string, accessToken: string, companyId?: string): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Procore-Company-Id": companyId ?? "",
  };
  const res = await fetch(`${PROCORE_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`Procore API error ${res.status}: ${path}`);
  return res.json();
}

export async function getProcoreMe(accessToken: string) {
  return procoreGet<{ id: number; login: string; name: string }>(
    "/vapid/me",
    accessToken
  );
}

export async function getProcoreCompanies(accessToken: string) {
  return procoreGet<Array<{ id: number; name: string }>>(
    "/vapid/companies",
    accessToken
  );
}

export async function createProcoreDirectCost(
  accessToken: string,
  companyId: string,
  projectId: string,
  data: {
    description: string;
    date: string; // YYYY-MM-DD
    totalAmount: number; // dollars
    vendorId?: string;
    costCodeId?: string;
    lineItemTypeId?: string;
    invoiceNumber?: string;
  }
) {
  const body = {
    direct_cost: {
      direct_cost_type: "invoice",
      status: "approved",
      description: data.description,
      invoice_number: data.invoiceNumber,
      date: data.date,
      received_date: data.date,
      line_items: [
        {
          description: data.description,
          quantity: 1,
          unit_cost: data.totalAmount,
          cost_code_id: data.costCodeId ? Number(data.costCodeId) : undefined,
          line_item_type_id: data.lineItemTypeId
            ? Number(data.lineItemTypeId)
            : undefined,
        },
      ],
    },
  };

  const res = await fetch(
    `${PROCORE_BASE}/rest/v1.0/projects/${projectId}/direct_costs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Procore-Company-Id": companyId,
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Procore direct cost creation failed: ${err}`);
  }
  return res.json();
}
