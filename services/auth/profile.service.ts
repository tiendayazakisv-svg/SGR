import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function getProfile(id: string) {
  return await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
}