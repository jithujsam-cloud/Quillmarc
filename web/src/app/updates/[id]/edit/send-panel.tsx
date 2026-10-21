"use client";
import { useActionState, useState } from "react";
import { sendTestAction, sendToInvestors } from "@/lib/actions/updates";
import type { FormState } from "@/lib/actions/setup";

export function SendPanel({ id, testSentAt, recipientCount, founderEmail, mock }: { id: string; testSentAt: string | null; recipientCount: number; founderEmail: string; mock: boolean }) {
  const [testState, testAction, testing] = useActionState<FormState, FormData>(sendTestAction, {});
  const [sendState, sendAction, sending] = useActionState<FormState, FormData>(sendToInvestors, {});
  const [confirming, setConfirming] = useState(false);
  const tested = Boolean(testSentAt) || Boolean(testState.message);

  return (
    <div className="space-y-8">
      {mock && (
        <p className="notice">
          <strong>Mock email mode.</strong> Nothing leaves this server. Set EMAIL_PROVIDER=resend to send real email.
        </p>
      )}
      <section aria-labelledby="test-h" className="space-y-3">
        <h3 id="test-h" className="text-2xl">
          1. Send a test to yourself
        </h3>
        <p className="text-muted">
          It goes to <span className="num break-all">{founderEmail}</span>. Check it reads well on your phone.
        </p>
        <form action={testAction}>
          <input type="hidden" name="id" value={id} />
          <button className="btn btn-secondary" disabled={testing}>
            {testing ? "Sending test" : tested ? "Send another test" : "Send test to me"}
          </button>
        </form>
        <div aria-live="polite">
          {testState.message && <p className="text-ok">{testState.message}</p>}
          {testState.error && <p className="error">{testState.error}</p>}
          {!testState.message && testSentAt && <p className="hint">A test was sent for this update.</p>}
        </div>
      </section>

      <section aria-labelledby="send-h" className="space-y-3">
        <h3 id="send-h" className="text-2xl">
          2. Send to investors
        </h3>
        <p className="text-muted">
          One email to each of <span className="num">{recipientCount}</span> {recipientCount === 1 ? "investor" : "investors"}. After sending, this update cannot be changed.
        </p>
        {!tested && <p id="send-gate" className="hint">Send a test first. The button unlocks after that.</p>}
        {!confirming ? (
          <button type="button" className="btn" disabled={!tested || recipientCount === 0} aria-describedby={!tested ? "send-gate" : undefined} onClick={() => setConfirming(true)}>
            Send to investors
          </button>
        ) : (
          <form action={sendAction} className="card space-y-4 p-5" role="group" aria-labelledby="confirm-h">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="confirm" value="yes" />
            <p id="confirm-h" className="font-medium">
              Send this update to {recipientCount} {recipientCount === 1 ? "investor" : "investors"} now?
            </p>
            <div className="flex flex-wrap gap-3">
              <button className="btn" disabled={sending}>
                {sending ? "Starting" : "Yes, send it"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={sending}>
                Cancel
              </button>
            </div>
          </form>
        )}
        <div aria-live="polite">{sendState.error && <p className="error">{sendState.error}</p>}</div>
      </section>
    </div>
  );
}
