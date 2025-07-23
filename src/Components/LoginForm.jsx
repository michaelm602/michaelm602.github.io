import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("Login successful");
      navigate("/upload"); // or wherever your protected route is
    } catch (err) {
      console.error("Login error:", err);
      alert("Login failed");
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
          className="w-full mb-4 p-3 rounded-md bg-[#111] text-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-6 p-3 rounded-md bg-[#111] text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="w-full py-3 rounded-md font-semibold"
          style={{
            background: "linear-gradient(to right, #000000, #222222)",
          }}
        >
          Login
        </button>
      </form>
    </div>
  );
}
