"use client";

import { useMemo, useState } from "react";
import { CreditCard, Smartphone, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

type PaymentMethod = "CARD" | "MPESA";

interface PaymentSimulationProps {
  amount: number;
  method: PaymentMethod;
  onSuccess: (method: PaymentMethod) => void;
}

type Step = "entry" | "processing" | "success";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function luhnValid(cardNumber: string) {
  const digits = onlyDigits(cardNumber);
  let sum = 0;
  let doubleNext = false;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (doubleNext) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleNext = !doubleNext;
  }

  return digits.length >= 13 && sum % 10 === 0;
}

function validateCardExpiry(expiry: string) {
  const clean = expiry.trim();
  if (!/^\d{2}\/\d{2}$/.test(clean)) return false;

  const [mm, yy] = clean.split("/").map(Number);
  if (mm < 1 || mm > 12) return false;

  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  if (yy < currentYear) return false;
  if (yy === currentYear && mm < currentMonth) return false;
  return true;
}

function normalizeMpesaPhone(value: string) {
  const digits = onlyDigits(value);
  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  if (value.trim().startsWith("+")) return value.trim();
  return `+${digits}`;
}

function validateMpesaPhone(value: string) {
  const normalized = normalizeMpesaPhone(value);
  return /^\+2547\d{8}$/.test(normalized);
}

export function PaymentSimulation({ amount, method, onSuccess }: PaymentSimulationProps) {
  const [step, setStep] = useState<Step>("entry");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validCard = useMemo(() => {
    const cardDigits = onlyDigits(cardNumber);
    return luhnValid(cardDigits) && validateCardExpiry(cardExpiry) && /^\d{3,4}$/.test(onlyDigits(cardCvc));
  }, [cardNumber, cardExpiry, cardCvc]);

  const validMpesa = useMemo(() => validateMpesaPhone(mpesaPhone), [mpesaPhone]);

  const submit = () => {
    setError(null);

    if (method === "CARD" && !validCard) {
      setError("Please provide valid card details.");
      return;
    }

    if (method === "MPESA" && !validMpesa) {
      setError("Enter a valid Safaricom number, for example 0712 345 678.");
      return;
    }

    setStep("processing");
    setTimeout(() => {
      setStep("success");
      setTimeout(() => onSuccess(method), 1000);
    }, 2500);
  };

  return (
    <div className="card glass animate-fade-in" style={{ padding: "2rem", maxWidth: "520px", margin: "0 auto" }}>
      {step === "entry" ? (
        <div className="stack">
          <h3 className="flex items-center gap-2">
            <ShieldCheck className="text-success" />
            Secure Payment
          </h3>
          <p className="text-muted">
            Total Amount: <strong style={{ color: "var(--text)" }}>KES {(amount / 100).toLocaleString()}</strong>
          </p>

          {method === "CARD" ? (
            <div className="stack mt-4" style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: "0.4rem", fontWeight: 600 }}>
                <CreditCard size={18} />
                Card details
              </div>
              <input
                type="text"
                placeholder="Card Number"
                className="input"
                value={cardNumber}
                onChange={(event) => setCardNumber(event.target.value)}
                style={{ width: "100%" }}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="MM/YY"
                  className="input"
                  value={cardExpiry}
                  onChange={(event) => setCardExpiry(event.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="text"
                  placeholder="CVC"
                  className="input"
                  value={cardCvc}
                  onChange={(event) => setCardCvc(event.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <button onClick={submit} className="btn btn-primary mt-2" style={{ width: "100%" }}>
                Pay with Card
              </button>
            </div>
          ) : (
            <div className="stack mt-4" style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Smartphone size={18} />
                <span style={{ fontWeight: 600 }}>M-Pesa STK Push</span>
              </div>
              <input
                type="text"
                placeholder="Phone Number (0712 345 678)"
                className="input"
                value={mpesaPhone}
                onChange={(event) => setMpesaPhone(event.target.value)}
                style={{ width: "100%" }}
              />
              <button
                onClick={submit}
                className="btn btn-primary mt-2"
                style={{ width: "100%", background: "#16a34a", boxShadow: "0 4px 14px 0 rgba(22, 163, 74, 0.4)" }}
              >
                Send STK Push
              </button>
            </div>
          )}

          {error ? <p style={{ color: "var(--error)", marginTop: "0.4rem" }}>{error}</p> : null}
        </div>
      ) : null}

      {step === "processing" ? (
        <div className="stack items-center justify-center text-center" style={{ padding: "3rem 0" }}>
          <Loader2 className="animate-spin text-accent" size={48} />
          <h3 className="mt-4">{method === "MPESA" ? "Waiting for M-Pesa PIN..." : "Authorizing card..."}</h3>
          <p className="text-muted">
            {method === "MPESA"
              ? "A simulated STK prompt has been sent to your phone."
              : "We are simulating secure card authorization."}
          </p>
        </div>
      ) : null}

      {step === "success" ? (
        <div className="stack items-center justify-center text-center animate-fade-in" style={{ padding: "3rem 0" }}>
          <CheckCircle2 className="text-success" size={64} />
          <h3 className="mt-4">Payment Successful</h3>
          <p className="text-muted">Finalizing order and notifying seller/admin now.</p>
        </div>
      ) : null}
    </div>
  );
}

