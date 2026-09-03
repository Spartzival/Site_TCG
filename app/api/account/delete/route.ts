import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Session invalide ou utilisateur non connecté." },
        { status: 401 },
      );
    }

    const admin = createAdminSupabaseClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de supprimer le compte.",
      },
      { status: 500 },
    );
  }
}
