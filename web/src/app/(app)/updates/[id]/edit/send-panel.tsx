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
    <div className="grid gap-4">
      {mock && (
        <p className="notice">
          <strong>Mock email mode.</strong> Nothing leaves this server. Set EMAIL_PROVIDER to resend to send real email.
        </p>
      )}
      <ol className="panel">
        <li className="panel-pad grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[16px] font-semibold">Send a test to yourself</h3>
            {tested ? <span className="pill pill-pos">Done</span> : <span className="pill pill-quiet">First</span>}
          </div>
          <p className="text-muted">
            It goes to <span className="break-all text-ink">{founderEmail}</span>. Check it reads well on your phone.
          </p>
          <form action={testAction}>
            <input type="hidden" name="id" value={id} />
            <button className="btn btn-secondary" disabled={testing} aria-busy={testing}>
              {testing ? "Sending test" : tested ? "Send another test" : "Send test to me"}
            </button>
          </form>
          <div aria-live="polite">
            {testState.message && <p className="ok">{testState.message}</p>}
            {testState.error && <p className="error">{testState.error}</p>}
          </div>
        </li>
        <li className="panel-pad grid gap-3 border-t border-line">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[16px] font-semibold">Send to investors</h3>
            {!tested && <span className="pill pill-quiet">After the test</span>}
          </div>
          <p className="text-muted">
            One email to each of {recipientCount} {recipientCount === 1 ? "investor" : "investors"}, with their own name and link. After sending, this update cannot be changed.
          </p>
          {!confirming ? (
            <div>
              <button type="button" className="btn btn-lg" disabled={!tested || recipientCount === 0} aria-describedby={!tested ? "send-gate" : undefined} onClick={() => setConfirming(true)}>
                Send to investors
              </button>
              {!tested && (
                <p id="send-gate" className="hint mt-2">
                  Send a test first. This unlocks after that.
                </p>
              )}
            </div>
          ) : (
            <form action={sendAction} className="grid gap-3 rounded-lg bg-tint p-4 text-accent-ink" role="group" aria-labelledby="confirm-h">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="confirm" value="yes" />
              <p id="confirm-h" className="font-medium">
                Send this update to {recipientCount} {recipientCount === 1 ? "investor" : "investors"} now?
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="btn" disabled={sending} aria-busy={sending}>
                  {sending ? "Starting" : "Yes, send it"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={sending} aria-busy={sending}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          <div aria-live="polite">{sendState.error && <p className="error">{sendState.error}</p>}</div>
        </li>
      </ol>
    </div>
  );
}
