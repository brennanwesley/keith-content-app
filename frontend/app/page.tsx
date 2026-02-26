import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-[100dvh] px-5 py-6 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col justify-between rounded-3xl border border-brand/10 bg-surface/90 p-7 shadow-[0_20px_60px_-30px_rgba(19,48,67,0.45)] backdrop-blur-sm sm:p-9">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand">
            Practical learning bites
          </p>
          <h1 className="font-brand mt-4 text-5xl text-brand-strong sm:text-6xl">
            TeachTok
          </h1>
          <p className="mt-5 max-w-xs text-lg leading-7 text-foreground/85">
            Your kid&apos;s best tool for practical learning!
          </p>
        </div>

        <div className="space-y-4">
          <p className="rounded-2xl border border-brand/15 bg-surface-soft px-4 py-3 text-sm text-foreground/80">
            Fast lessons. Real skills. Built for mobile and ready to swipe.
          </p>
          <Link
            href="/content"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-brand px-5 py-4 text-lg font-bold text-white transition hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Start Learning
          </Link>
        </div>
      </section>
    </main>
  );
}
