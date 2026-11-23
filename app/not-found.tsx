import Link from "next/link";
import { AppHeader } from "@/components/Brand";

export default function NotFound() {
  return (
    <>
      <AppHeader />
      <main className="bg-cream">
        <div className="mx-auto max-w-read px-[18px] py-28 text-center">
          <h1 className="text-[40px]">
            That page <span className="accent">isn&apos;t here.</span>
          </h1>
          <p className="lead mt-4">The session or proposal doesn&apos;t exist, or it has expired.</p>
          <Link href="/" className="btn btn-primary mt-8">
            Start a new scope →
          </Link>
        </div>
      </main>
    </>
  );
}
