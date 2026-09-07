import { useState } from "react";
import { useLocation } from "react-router-dom";
import emailjs from "@emailjs/browser";
import { CONTACT_INTENTS, parseContactContext, buildContactPayload } from "../utils/contactIntent";

export default function Contact() {
    const { search } = useLocation();
    const context = parseContactContext(search);
    const { heading, helper } = CONTACT_INTENTS[context.intent];

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        message: "",
    });

    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setSent(false);
    };

    const sendEmail = async (e) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        setError(false);
        setSent(false);

        try {
            await emailjs.send(
                "service_6j3le5o",
                "template_xs5pzrr",
                buildContactPayload(formData, context, new Date().toLocaleString()),
                "OLAEWsvf8PTH1I8A-"
            );
            setSent(true);
            setFormData({ name: "", email: "", message: "" });
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen text-white flex justify-center items-center p-6">
            <form
                onSubmit={sendEmail}
                aria-busy={loading}
                className="w-full max-w-xl bg-[#111] p-5 sm:p-8 rounded-lg shadow-md space-y-4"
            >
                <h1 className="text-3xl font-bold text-center mb-4">{heading}</h1>
                <p className="text-zinc-300 leading-relaxed">{helper}</p>
                {(context.product || context.piece) && (
                    <div className="rounded border border-white/20 p-3 text-sm break-words">
                        {context.product && <p>Selected print: {context.productTitle || context.product}</p>}
                        {context.piece && <p>Selected artwork: {context.pieceTitle || context.piece}</p>}
                    </div>
                )}
                <p className="text-sm text-zinc-400 leading-relaxed">
                    I’ll get back to you as soon as I can by email to discuss your questions or next steps.
                    An inquiry doesn’t reserve artwork or confirm a project.
                </p>

                <label htmlFor="contact-name" className="block font-medium">Your name</label>
                <input
                    id="contact-name"
                    autoComplete="name"
                    type="text"
                    name="name"
                    placeholder="Your Name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    className="w-full p-3 rounded bg-black border border-gray-600 text-white placeholder-gray-400"
                />

                <label htmlFor="contact-email" className="block font-medium">Email address</label>
                <input
                    id="contact-email"
                    autoComplete="email"
                    type="email"
                    name="email"
                    placeholder="Your Email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    className="w-full p-3 rounded bg-black border border-gray-600 text-white placeholder-gray-400"
                />

                <label htmlFor="contact-message" className="block font-medium">Your message</label>
                <textarea
                    id="contact-message"
                    name="message"
                    placeholder="Your Message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    disabled={loading}
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
                <p className="text-sm text-zinc-300 text-center">
                    Prefer email? Contact me directly at{" "}
                    <a href="mailto:airbrushnink@gmail.com" className="underline underline-offset-4 break-all">
                        airbrushnink@gmail.com
                    </a>.
                </p>

                {sent && (
                    <p role="status" className="text-green-400 text-center pt-2">
                        Your message has been sent. I’ll get back to you as soon as I can at the email address you provided.
                    </p>
                )}

                {error && (
                    <p role="alert" className="text-red-400 text-center pt-2">
                        Your message couldn’t be sent. Your entries are still here so you can try again or email me directly at{" "}
                        <a href="mailto:airbrushnink@gmail.com" className="underline underline-offset-4 break-all">
                            airbrushnink@gmail.com
                        </a>.
                    </p>
                )}
            </form>
        </div>
    );
}
