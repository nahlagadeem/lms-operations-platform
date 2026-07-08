"use client";

import { useFormStatus } from "react-dom";

type LoginLabels = {
  email: string;
  password: string;
  submit: string;
  pending: string;
};

type LoginFormProps = {
  action: (formData: FormData) => void;
  labels: LoginLabels;
};

function SubmitButton({ labels }: { labels: LoginLabels }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="primary-button w-full" disabled={pending}>
      {pending ? labels.pending : labels.submit}
    </button>
  );
}

export function LoginForm({ action, labels }: LoginFormProps) {
  return (
    <form action={action} className="space-y-4">
      <label className="field-shell">
        <span className="field-label">{labels.email}</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          className="field-input"
          required
        />
      </label>

      <label className="field-shell">
        <span className="field-label">{labels.password}</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="field-input"
          required
        />
      </label>

      <SubmitButton labels={labels} />
    </form>
  );
}
