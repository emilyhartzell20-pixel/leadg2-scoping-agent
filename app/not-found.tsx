import Link from "next/link";
import { AppHeader } from "@/components/Brand";

export default function NotFound() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-3 text-4xl">Not found</h1>
        <p className="mt-3 text-steel">That session or proposal doesn&apos;t exist (or has expired).</p>
        <Link href="/" className="mt-8 inline-block rounded bg-orange px-5 py-3 font-heading text-sm font-extrabold text-midnight">
          Start a new scope
        </Link>
      </main>
    </>
  );
}
