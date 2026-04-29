import { SupabaseClient } from "@supabase/supabase-js";
import {
  Category,
  CategoryLimit,
  defaultCategories,
  getMonthRange,
  RecurringTransaction,
  Transaction,
} from "./finance";

type MaybeDisplayNameError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export type DashboardProfile = {
  id: string;
  email: string;
  display_name: string | null;
};

export type DashboardLoadResult = {
  profile: DashboardProfile | null;
  categories: Category[];
  categoryLimits: CategoryLimit[];
  transactions: Transaction[];
  recurring: RecurringTransaction[];
  supportsDisplayName: boolean;
};

function isMissingDisplayNameColumn(error: MaybeDisplayNameError | null) {
  if (!error) return false;
  const details = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return details.includes("display_name") || error.code === "PGRST204" || error.code === "42703";
}

export async function ensureBaseData(client: SupabaseClient, userId: string, email: string) {
  const { error: profileError } = await client.from("profiles").upsert({ id: userId, email });
  if (profileError) {
    throw profileError;
  }

  const { count, error: categoryCountError } = await client
    .from("categories")
    .select("id", { count: "exact", head: true });
  if (categoryCountError) {
    throw categoryCountError;
  }

  if (count === 0) {
    const { error: categoryInsertError } = await client.from("categories").insert(
      defaultCategories.map((item) => ({
        ...item,
        user_id: userId,
      })),
    );
    if (categoryInsertError) {
      throw categoryInsertError;
    }
  }
}

export async function loadDashboardData(
  client: SupabaseClient,
  userId: string,
  email: string,
  selectedMonth: string,
  supportsDisplayName: boolean,
): Promise<DashboardLoadResult> {
  await ensureBaseData(client, userId, email);

  const { start, end } = getMonthRange(selectedMonth);
  const [categoryResult, limitResult, transactionResult, recurringResult] = await Promise.all([
    client.from("categories").select("*").order("name"),
    client.from("category_limits").select("id,category_id,amount_cents"),
    client
      .from("transactions")
      .select("*")
      .gte("entry_date", start)
      .lt("entry_date", end)
      .order("entry_date", { ascending: false }),
    client.from("recurring_transactions").select("*").order("day_of_month"),
  ]);

  let profileResult;
  let nextSupportsDisplayName = supportsDisplayName;

  if (supportsDisplayName) {
    profileResult = await client.from("profiles").select("id,email,display_name").eq("id", userId).maybeSingle();

    if (isMissingDisplayNameColumn(profileResult.error as MaybeDisplayNameError | null)) {
      nextSupportsDisplayName = false;
      profileResult = await client.from("profiles").select("id,email").eq("id", userId).maybeSingle();
    }
  } else {
    profileResult = await client.from("profiles").select("id,email").eq("id", userId).maybeSingle();
  }

  const firstError =
    profileResult.error ||
    categoryResult.error ||
    limitResult.error ||
    transactionResult.error ||
    recurringResult.error;

  if (firstError) {
    throw firstError;
  }

  const profileRow = profileResult.data as
    | {
        id: string;
        email: string;
        display_name?: string | null;
      }
    | null;

  return {
    profile: profileRow
      ? {
          id: profileRow.id,
          email: profileRow.email,
          display_name: profileRow.display_name ?? null,
        }
      : null,
    categories: categoryResult.data ?? [],
    categoryLimits: limitResult.data ?? [],
    transactions: transactionResult.data ?? [],
    recurring: recurringResult.data ?? [],
    supportsDisplayName: nextSupportsDisplayName,
  };
}

export async function createTransaction(
  client: SupabaseClient,
  payload: Omit<Transaction, "id"> & { user_id: string },
) {
  return client.from("transactions").insert(payload).select("*").single();
}

export async function updateTransactionById(
  client: SupabaseClient,
  id: string,
  payload: Partial<Transaction>,
) {
  return client.from("transactions").update(payload).eq("id", id).select("*").single();
}

export async function deleteTransactionById(client: SupabaseClient, id: string) {
  return client.from("transactions").delete().eq("id", id);
}

export async function createCategory(
  client: SupabaseClient,
  payload: { user_id: string; name: string; type: Category["type"]; color: string },
) {
  return client.from("categories").insert(payload).select("*").single();
}

export async function updateCategoryById(
  client: SupabaseClient,
  id: string,
  payload: Pick<Category, "name" | "color">,
) {
  return client.from("categories").update(payload).eq("id", id).select("*").single();
}

export async function deleteCategoryById(client: SupabaseClient, id: string) {
  return client.from("categories").delete().eq("id", id);
}

export async function upsertCategoryLimit(
  client: SupabaseClient,
  payload: { user_id: string; category_id: string; amount_cents: number; updated_at: string },
) {
  return client
    .from("category_limits")
    .upsert(payload, { onConflict: "user_id,category_id" })
    .select("id,category_id,amount_cents")
    .single();
}

export async function deleteCategoryLimitById(client: SupabaseClient, id: string) {
  return client.from("category_limits").delete().eq("id", id);
}

export async function createRecurringTransaction(
  client: SupabaseClient,
  payload: { user_id: string } & Omit<RecurringTransaction, "id">,
) {
  return client.from("recurring_transactions").insert(payload).select("*").single();
}

export async function updateRecurringTransactionById(
  client: SupabaseClient,
  id: string,
  payload: Omit<RecurringTransaction, "id">,
) {
  return client.from("recurring_transactions").update(payload).eq("id", id).select("*").single();
}

export async function deleteRecurringTransactionById(client: SupabaseClient, id: string) {
  return client.from("recurring_transactions").delete().eq("id", id);
}

export async function updateRecurringActiveState(
  client: SupabaseClient,
  id: string,
  isActive: boolean,
) {
  return client
    .from("recurring_transactions")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("*")
    .single();
}

export async function updateTransactionPaidState(
  client: SupabaseClient,
  id: string,
  isPaid: boolean,
) {
  return client.from("transactions").update({ is_paid: isPaid }).eq("id", id).select("*").single();
}

export async function updateProfileDisplayName(
  client: SupabaseClient,
  userId: string,
  email: string,
  displayName: string | null,
) {
  return client
    .from("profiles")
    .update({ display_name: displayName, email })
    .eq("id", userId);
}
