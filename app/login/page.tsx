import { redirect } from "next/navigation";

export default function OldLoginPage() {
  redirect("/auth/login");
}
