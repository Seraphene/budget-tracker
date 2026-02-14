import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const actionSchema = z.enum(["create_board", "join_board", "add_item", "get_board"]);

const payloadSchema = z.object({
  action: actionSchema,
  username: z.string().min(1),
  pin: z.string().min(4),
  board_code: z.string().optional(),
  board_name: z.string().optional(),
  item_name: z.string().optional(),
  target_price: z.number().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "API route is live. Use POST /api/board for actions.",
  });
}

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing N8N_WEBHOOK_URL in environment.",
      },
      { status: 500 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid payload.",
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { "x-webhook-secret": webhookSecret } : {}),
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });

    const text = await upstream.text();

    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: upstream.status });
    } catch {
      return NextResponse.json(
        { ok: upstream.ok, raw: text },
        { status: upstream.status || 500 },
      );
    }
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not reach n8n webhook.",
      },
      { status: 502 },
    );
  }
}
