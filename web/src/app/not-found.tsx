import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-md px-4 pt-24">
      <h1 className="text-4xl">Page not found</h1>
      <p className="mt-4 text-muted">This link may have expired, or the update was deleted.</p>
      <Link href="/" className="btn mt-8">
        Go to Quillmarc
      </Link>
    </main>
  );
}
