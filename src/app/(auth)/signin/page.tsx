import Link from "next/link";
import { Suspense } from "react";
import { DemoAccess, SignInForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Sign in · StreamReach" };

export default function SignInPage() {
  return (
    <Suspense>
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="text-ink-2 mt-2">Sign in to monitor your city&apos;s streams.</p>
      <div className="mt-8">
        <SignInForm />
      </div>
      <p className="text-sm text-ink-2 mt-4">
        New to StreamReach?{" "}
        <Link href="/signup" className="text-accent font-medium hover:underline">
          Create an account
        </Link>
      </p>
      <div className="flex items-center gap-3 my-8 text-xs text-ink-3">
        <span className="h-px flex-1 bg-line" />
        or explore with a demo account
        <span className="h-px flex-1 bg-line" />
      </div>
      <DemoAccess />
    </Suspense>
  );
}
