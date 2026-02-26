import Link from "next/link";

export default function ContentSelectionPage() {
  return (
    <main className="min-h-[100dvh] px-5 py-6 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col rounded-3xl border border-brand/10 bg-surface/95 p-6 shadow-[0_20px_60px_-30px_rgba(19,48,67,0.45)] backdrop-blur-sm sm:p-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-brand/90">
            Pick your learning lane
          </p>
          <h1 className="font-brand mt-3 text-3xl text-brand-strong">Content Selection</h1>
          <p className="mt-3 text-sm leading-6 text-foreground/80">
            Start with one focused topic and more practical paths will roll out soon.
          </p>
        </header>

        <div className="mt-8 space-y-4">
          <Link
            href="/feed/youth-hockey"
            className="group block rounded-3xl border border-brand/15 bg-surface-soft px-5 py-5 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_14px_30px_-20px_rgba(19,48,67,0.65)]"
          >
            <div className="flex items-start gap-4">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                🏒
              </span>
              <div>
                <p className="text-lg font-semibold text-brand-strong">Youth Hockey</p>
                <p className="mt-1 text-sm text-foreground/75">
                  Skills and skating drills in short, practical clips.
                </p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                  Tap to start watching
                </p>
              </div>
            </div>
          </Link>

          <article className="rounded-3xl border border-dashed border-brand/20 bg-white/80 px-5 py-4">
            <p className="text-sm font-semibold text-foreground/75">More content coming soon...</p>
            <p className="mt-1 text-sm text-foreground/60">
              Soccer, coding, science hacks, and more practical topics are on deck.
            </p>
          </article>
        </div>

        <footer className="mt-auto pt-6">
          <Link href="/" className="text-sm font-semibold text-brand hover:text-brand-strong">
            ← Back to home
          </Link>
        </footer>
      </section>
    </main>
  );
}
