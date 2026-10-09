import { redirect } from "next/navigation";

// Teachers sign in on the shared /login page (teacher tab); old links still work.
export default function BackofficeLoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = searchParams.next ? `&next=${encodeURIComponent(searchParams.next)}` : "";
  redirect(`/login?as=teacher${next}`);
}
