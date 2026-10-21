// What the founder does after this screen, so a short form does not sit above a blank screen.
const STEPS = [
  { title: "Review the numbers", body: "Seven figures from Stripe, each with how it was calculated. Edit any of them." },
  { title: "Write the bullets", body: "Wins, problems and asks. About five lines in all." },
  { title: "Choose recipients", body: "Everyone by default. Untick anyone who should not get this one." },
  { title: "Test, then send", body: "A test to you first. Then one email per investor, and you see who read it." },
];

export function StepsAhead({ heading = "What happens next" }: { heading?: string }) {
  return (
    <section className="mt-10" aria-labelledby="ahead-h">
      <h2 id="ahead-h" className="mb-3 text-[16px]">
        {heading}
      </h2>
      <ol className="panel grid sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className={`border-line p-5 ${i > 0 ? "border-t sm:border-t-0" : ""} ${i % 2 === 1 ? "sm:border-l" : ""} ${i >= 2 ? "sm:border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
            <p className="font-medium">{s.title}</p>
            <p className="mt-1 text-[13px] leading-[18px] text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
