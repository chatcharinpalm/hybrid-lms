import { redirect } from "next/navigation";

// The back office opens straight onto the live exam monitor; the other tools are in the sidebar.
export default function BackofficeHome() {
  redirect("/backoffice/monitor");
}
