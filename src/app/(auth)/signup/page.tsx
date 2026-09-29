import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Create account · StreamReach" };

export default function SignUpPage() {
  return (
    <Suspense>
      <h1 className="text-3xl font-semibold tracking-tight">Join StreamReach</h1>
      <p className="text-ink-2 mt-2">Report what you see in your local stream, or receive stream alerts in your clinic.</p>
      <div className="mt-8">
        <SignUpForm />
      </div>
    </Suspense>
  );
}
