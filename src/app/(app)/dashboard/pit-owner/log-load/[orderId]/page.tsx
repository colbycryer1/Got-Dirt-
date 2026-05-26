import { redirect } from "next/navigation";

// The log load interface lives at /operator.
// Any deep-link to the old route is redirected there.
export default function LogLoadRedirect() {
  redirect("/operator");
}
