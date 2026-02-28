import Link from "next/link";

export default function ContentSelectionPage() {
  return (
    <main className="min-h-[100dvh] px-5 py-6 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-[0_24px_80px_-36px_rgba(254,44,85,0.42)] ring-1 ring-accent/25 backdrop-blur-sm sm:p-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-brand-muted">
            Pick your learning lane
          </p>
          <h1 className="font-brand mt-3 bg-gradient-to-r from-foreground via-brand-muted to-brand bg-clip-text text-3xl text-transparent">
            Content Selection
          </h1>
          <p className="mt-3 text-sm leading-6 text-foreground/80">
            Start with one focused topic and more practical paths will roll out soon.
          </p>
        </header>

        <div className="mt-8 space-y-4">
          <Link
            href="/feed/youth-hockey"
            className="group block rounded-3xl border border-brand/30 bg-surface-soft px-5 py-5 transition hover:-translate-y-0.5 hover:border-accent/55 hover:shadow-[0_18px_40px_-25px_rgba(37,244,238,0.55)]"
          >
            <div className="flex items-start gap-4">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-brand text-2xl shadow-[0_10px_20px_-10px_rgba(37,244,238,0.75)]">
                🏒
              </span>
              <div>
                <p className="text-lg font-semibold text-foreground">Youth Hockey</p>
                <p className="mt-1 text-sm text-foreground/75">
                  Skills and skating drills in short, practical clips.
                </p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">
                  Tap to start watching
                </p>
              </div>
            </div>
          </Link>

          <article className="rounded-3xl border border-dashed border-accent/35 bg-black/30 px-5 py-4">
            <p className="text-sm font-semibold text-foreground/82">More content coming soon...</p>
            <p className="mt-1 text-sm text-foreground/60">
              Soccer, coding, science hacks, and more practical topics are on deck.
            </p>
          </article>
        </div>

        <footer className="mt-auto flex items-center justify-between gap-4 pt-6">
          <Link href="/" className="text-sm font-semibold text-brand-muted hover:text-accent-strong">
            ← Back to home
          </Link>
          <Link
            href="/feed/youth-hockey"
            className="text-sm font-semibold text-brand-muted hover:text-accent-strong"
          >
            Skip →
          </Link>
        </footer>
      </section>
    </main>
  );
}
