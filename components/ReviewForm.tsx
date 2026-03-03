"use client";

import { FormEvent, useState } from "react";

type Props = {
  productId: string;
  isAuthenticated: boolean;
};

export function ReviewForm({ productId, isAuthenticated }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productId,
        rating,
        comment
      })
    });

    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setStatus(payload.error || "Failed to submit review");
      return;
    }

    setComment("");
    setRating(5);
    setStatus("Review submitted. It will appear after moderation.");
  };

  if (!isAuthenticated) {
    return <p style={{ color: "#617065" }}>Log in to leave a review.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ marginTop: "0.6rem" }}>
      <div className="row">
        <label style={{ display: "grid", gap: "0.25rem" }}>
          Rating
          <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} star{value > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <textarea
        placeholder="Write your review"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={4}
      />

      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Submitting..." : "Submit review"}
        </button>
        {status ? <span style={{ color: "#617065" }}>{status}</span> : null}
      </div>
    </form>
  );
}
