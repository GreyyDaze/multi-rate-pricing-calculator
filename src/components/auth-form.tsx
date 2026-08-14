"use client";

import { Eye, EyeOff, Loader2, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/toast";
import { useSession } from "@/lib/session-hooks";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast("error", typeof body.error === "string" ? body.error : "Something went wrong.");
        return;
      }
      toast("success", isLogin ? "Welcome back." : "Account created. Welcome!");
      await refresh();
      router.replace("/");
      router.refresh();
    } catch {
      toast("error", "Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-[0.9375rem] font-medium text-secondary">
        {isLogin ? "Welcome back" : "Get started"}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.01em] sm:text-3xl">
        {isLogin ? "Sign in to your account" : "Create your account"}
      </h1>
      <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-secondary">
        {isLogin
          ? "Access your quotes and invoices — all totals are computed and stored by the server."
          : "Set up your workspace in seconds."}
      </p>

      <form className="mt-12 space-y-6" onSubmit={handleSubmit}>
        <div className="row">
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="row">
          <label htmlFor="password" className="label">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={8}
              placeholder={isLogin ? "Your password" : "At least 8 characters"}
              className="input pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-secondary transition-colors hover:text-onsurface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : isLogin ? (
            <LogIn className="h-4 w-4" aria-hidden="true" />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden="true" />
          )}
          {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-10 text-[0.9375rem] text-secondary">
        {isLogin ? (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-primary underline underline-offset-4">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary underline underline-offset-4">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}