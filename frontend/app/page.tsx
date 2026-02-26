import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-[100dvh] px-5 py-6 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col justify-between rounded-3xl border border-white/10 bg-surface/90 p-7 shadow-[0_24px_80px_-35px_rgba(37,244,238,0.45)] ring-1 ring-brand/20 backdrop-blur-sm sm:p-9">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-muted">
            Practical learning bites
          </p>
          <h1 className="font-brand mt-4 bg-gradient-to-r from-brand via-brand-muted to-accent bg-clip-text text-5xl text-transparent sm:text-6xl">
            TeachTok
          </h1>
          <p className="mt-5 max-w-xs text-lg leading-7 text-foreground/85">
            Your kid&apos;s best tool for practical learning!
          </p>
        </div>

        <div className="space-y-4">
          <p className="rounded-2xl border border-accent/30 bg-black/35 px-4 py-3 text-sm text-foreground/80">
            Fast lessons. Real skills. Built for mobile and ready to swipe.
          </p>
          <Link
            href="/content"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-brand px-5 py-4 text-lg font-extrabold text-background transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Start Learning
          </Link>
        </div>
      </section>
    </main>
  );
}
