import React, { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { authorizeAdminLogin, getLoginErrorMessage } from "../utils/login";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const authorized = await authorizeAdminLogin(
        credential.user,
        () => signOut(auth)
      );

      if (!authorized) {
        setError("This account is not authorized for admin access.");
        return;
      }

      navigate("/admin/home", { replace: true });
    } catch (err) {
      console.error("Login error:", err);
      if (auth.currentUser) await signOut(auth).catch(() => {});
      setError(getLoginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-black text-white">
      <form
        onSubmit={handleLogin}
        className="p-8 rounded-2xl shadow-xl w-full max-w-md"
        style={{
          background: "linear-gradient(to right, #000000, #222222)",
        }}
      >
        <h1 className="text-2xl font-bold text-center mb-6">Admin Login</h1>

        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
          disabled={submitting}
          className="w-full mb-4 p-3 rounded-md bg-[#111] text-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          required
          disabled={submitting}
          className="w-full mb-6 p-3 rounded-md bg-[#111] text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-md font-semibold"
          style={{
            background: "linear-gradient(to right, #000000, #222222)",
          }}
        >
          {submitting ? "Checking access..." : "Login"}
        </button>
      </form>
    </div>
  );
}
