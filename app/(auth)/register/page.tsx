"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const COUNTRY_CODES = [
  { label: "Kenya (+254)", value: "+254" },
  { label: "Uganda (+256)", value: "+256" },
  { label: "Tanzania (+255)", value: "+255" }
];

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(countryCode: string, localPhone: string): string {
  let digits = localPhone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return `${countryCode}${digits}`;
}

function isValidPhone(countryCode: string, localPhone: string): boolean {
  const digits = localPhone.replace(/\D/g, "");
  const normalizedDigits = digits.startsWith("0") ? digits.slice(1) : digits;

  if (countryCode === "+254") {
    return /^[17]\d{8}$/.test(normalizedDigits);
  }

  return normalizedDigits.length >= 7 && normalizedDigits.length <= 12;
}

function getPasswordStrength(password: string): { label: "Weak" | "Fair" | "Strong"; score: number } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { label: "Weak", score: 1 };
  if (score <= 4) return { label: "Fair", score: 2 };
  return { label: "Strong", score: 3 };
}

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+254");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nameValid = name.trim().length >= 2;
  const phoneValid = isValidPhone(countryCode, phone);
  const emailValid = isValidEmail(email.trim());
  const passwordValid = password.length >= 8;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const canSubmit = nameValid && phoneValid && emailValid && passwordValid && passwordsMatch && !loading;

  const onRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setStatus(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        phone: normalizePhone(countryCode, phone),
        email: email.trim(),
        password
      })
    });

    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setStatus(payload.error || "Registration failed");
      return;
    }

    setStatus("Account created successfully.");
    router.push("/account");
    router.refresh();
  };

  return (
    <main>
      <section className="auth-container">
        <article className="card auth-card">
          <h1>Create your account</h1>
          <p className="auth-subtext">It only takes a few seconds</p>

          <form className="stack" onSubmit={onRegister}>
            <label className="stack auth-field">
              <span className="auth-label-row">
                <span>Full Name</span>
                <span className={nameValid ? "field-check ok" : "field-check"}>{nameValid ? "OK" : "..."}</span>
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Joseph Wekesa"
                autoComplete="name"
                required
              />
            </label>

            <label className="stack auth-field">
              <span className="auth-label-row">
                <span>Phone Number</span>
                <span className={phoneValid ? "field-check ok" : "field-check"}>{phoneValid ? "OK" : "..."}</span>
              </span>
              <div className="phone-row">
                <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
                  {COUNTRY_CODES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="7XX XXX XXX"
                  inputMode="numeric"
                  required
                />
              </div>
            </label>

            <label className="stack auth-field">
              <span className="auth-label-row">
                <span>Email Address</span>
                <span className={emailValid ? "field-check ok" : "field-check"}>{emailValid ? "OK" : "..."}</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="stack auth-field">
              <span className="auth-label-row">
                <span>Password</span>
                <span className={passwordValid ? "field-check ok" : "field-check"}>{passwordValid ? "OK" : "..."}</span>
              </span>
              <div className="password-row">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className="password-strength">
                <div className="strength-bars">
                  <span className={passwordStrength.score >= 1 ? "bar active" : "bar"} />
                  <span className={passwordStrength.score >= 2 ? "bar active" : "bar"} />
                  <span className={passwordStrength.score >= 3 ? "bar active" : "bar"} />
                </div>
                <span>{passwordStrength.label}</span>
              </div>
              <small className="hint-text">Use at least 8 characters.</small>
            </label>

            <label className="stack auth-field">
              <span className="auth-label-row">
                <span>Confirm Password</span>
                <span className={passwordsMatch ? "field-check ok" : "field-check"}>{passwordsMatch ? "OK" : "..."}</span>
              </span>
              <div className="password-row">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch ? (
                <small className="error-soft">The passwords don't match yet.</small>
              ) : null}
            </label>

            <button type="submit" className="btn btn-primary checkout-cta" disabled={!canSubmit}>
              {loading ? "Creating account..." : "Create Account"}
            </button>

            <small className="hint-text">We'll never share your information.</small>
          </form>

          <p className="auth-footer">
            Already have an account? <Link href="/login">Log in</Link>
          </p>

          {status ? <p className="auth-status">{status}</p> : null}
        </article>
      </section>
    </main>
  );
}

