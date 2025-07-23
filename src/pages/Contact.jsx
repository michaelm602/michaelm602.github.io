import React, { useRef, useState } from "react";
import emailjs from "@emailjs/browser";

export default function Contact() {
    const form = useRef();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        message: "",
    });

    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const sendEmail = (e) => {
        e.preventDefault();
        setLoading(true);

        emailjs
            .send(
                "service_6j3le5o",      // ✅ Your Gmail service ID
                "template_xs5pzrr",   // 🔁 Replace with your actual EmailJS template ID
                {
                    title: "Website Contact",
                    name: formData.name,
                    email: formData.email,
                    message: formData.message,
                    time: new Date().toLocaleString(),
                },
                "OLAEWsvf8PTH1I8A-"  // 🔁 Replace with your EmailJS public key
            )
            .then(
                (result) => {
                    console.log("✅ Message sent:", result.text);
                    setSent(true);
                    setFormData({ name: "", email: "", message: "" });
                },
                (error) => {
                    console.error("❌ Failed to send:", error.text);
                }
            )
            .finally(() => setLoading(false));
    };

    return (
        <div className="min-h-screen bg-black text-white flex justify-center items-center p-6">
            <form
                ref={form}
                onSubmit={sendEmail}
                className="w-full max-w-xl bg-[#111] p-8 rounded-lg shadow-md space-y-4"
            >
                <h2 className="text-3xl font-bold text-center mb-4">Contact Me</h2>

                <input
                    type="text"
                    name="name"
                    placeholder="Your Name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full p-3 rounded bg-black border border-gray-600 text-white placeholder-gray-400"
                />

                <input
                    type="email"
                    name="email"
                    placeholder="Your Email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full p-3 rounded bg-black border border-gray-600 text-white placeholder-gray-400"
                />

                <textarea
                    name="message"
                    placeholder="Your Message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows="5"
                    className="w-full p-3 rounded bg-black border border-gray-600 text-white placeholder-gray-400"
                ></textarea>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-black font-semibold py-3 px-6 rounded hover:bg-gray-200 transition disabled:opacity-50"
                >
                    {loading ? "Sending..." : "Send Message"}
                </button>

                {sent && (
                    <p className="text-green-400 text-center pt-2">
                        ✅ Your message has been sent!
                    </p>
                )}
            </form>
        </div>
    );
}
