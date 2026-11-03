import Link from "next/link";

export function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md px-6 text-center">
      <h1 className="font-display text-2xl font-bold">Event not found</h1>
      <p className="mt-2 text-muted">It may have been deleted on another device. Try syncing, or head back to your events.</p>
      <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-xl bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover">
        Back to events
      </Link>
    </div>
  );
}
