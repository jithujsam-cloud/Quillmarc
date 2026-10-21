import { PlainFrame } from "./plain-frame";

export function LegalPage({ children }: { children: React.ReactNode }) {
  return (
    <PlainFrame width="max-w-2xl">
      <article className="grid gap-3 text-[15px] leading-[24px] [&_h1]:text-[24px] [&_h1]:leading-[30px] [&_h2]:mt-8 [&_h2]:text-[16px] [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1.5">{children}</article>
    </PlainFrame>
  );
}

export function ContactLink({ email }: { email: string }) {
  return email ? <a href={`mailto:${email}`}>{email}</a> : <>the address in your welcome email</>;
}
