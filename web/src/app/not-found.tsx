import Link from "next/link";
import { PlainFrame } from "@/components/plain-frame";

export default function NotFound() {
  return (
    <PlainFrame>
      <h1 className="text-[24px] leading-[30px]">Page not found</h1>
      <p className="mt-2 text-muted">This link may have expired, or the update was deleted.</p>
      <Link href="/" className="btn mt-6">
        Go to Quillmarc
      </Link>
    </PlainFrame>
  );
}
