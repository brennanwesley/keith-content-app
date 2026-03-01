import Link from "next/link";

export default function DemoSettingsPage() {
  return (
    <main className="min-h-[100dvh] px-5 py-6 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-[0_24px_80px_-36px_rgba(37,244,238,0.45)] ring-1 ring-brand/20 backdrop-blur-sm sm:p-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-brand-muted">
            Account controls
          </p>
          <h1 className="font-brand mt-3 bg-gradient-to-r from-foreground via-brand-muted to-accent bg-clip-text text-3xl text-transparent">
            Settings (Demo)
          </h1>
          <p className="mt-3 text-sm leading-6 text-foreground/80">
            Demo mode is intentionally read-only. Preferences and account changes are only
            available after login.
          </p>
        </header>

        <article className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-foreground/80">
          <h2 className="text-sm font-semibold text-foreground">Content Types</h2>
          <p className="mt-2 text-xs text-foreground/70">
            No content types are displayed in demo settings.
          </p>
        </article>

        <article className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-foreground/80">
          <h2 className="text-sm font-semibold text-foreground">Account Profile</h2>
          <p className="mt-2 text-xs text-foreground/70">
            Create an account to manage email, parent/guardian status, and saved preferences.
          </p>
        </article>

        <footer className="mt-auto flex items-center justify-between gap-4 pt-6">
          <Link
            href="/demo/feed/youth-hockey"
            className="text-sm font-semibold text-brand-muted hover:text-accent-strong"
          >
            ← Back to demo feed
          </Link>
          <Link href="/auth" className="text-sm font-semibold text-brand-muted hover:text-accent-strong">
            Create Account / Log In →
          </Link>
        </footer>
      </section>
    </main>
  );
}
