import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Retornar token (em produção, usar JWT real do Supabase)
  const { data: { session } } = await supabase.auth.getSession();

  return NextResponse.json({
    token: session?.access_token,
    user: {
      id: user.id,
      email: user.email,
    },
  });
}