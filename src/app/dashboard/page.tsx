import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/auth/session";

export default async function DashboardIndex() {
  const account = await getCurrentAccount();
  redirect(account ? `/dashboard/${account.business.slug}` : "/login");
}
