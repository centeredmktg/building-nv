"use client";

import { useState } from "react";
import FadeUp from "@/components/FadeUp";

const projectTypes = [
  "Office Buildout",
  "Retail / Restaurant",
  "Medical Suite",
  "Warehouse / Industrial",
  "Suite Renovation",
  "Kitchen Remodel",
  "Bathroom Renovation",
  "Custom Residential Build",
  "Other",
];

export default function Contact() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    projectType: "",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus("success");
        setForm({ name: "", company: "", email: "", phone: "", projectType: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const inputClass =
    "w-full bg-surface border border-border px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors";

  return (
    <section id="contact" className="py-32 px-6 bg-surface">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <FadeUp>
            <div>
              <p className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-4">
                Get In Touch
              </p>
              <h2 className="text-[clamp(36px,5vw,56px)] font-bold text-text-primary leading-tight mb-6">
                Let&apos;s Talk About Your Project
              </h2>
              <p className="text-text-muted leading-relaxed mb-10">
                Whether you have a space ready for buildout or are still in early planning, we want to hear about it. We respond within one business day.
              </p>
              <div className="flex flex-col gap-4">
                <a
                  href="tel:+17752000000"
                  className="flex items-center gap-3 text-text-primary hover:text-accent transition-colors group"
                >
                  <span className="text-2xl font-bold">(775) 200-0000</span>
                </a>
                <p className="text-text-muted text-sm">Reno, Nevada</p>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  name="name"
                  type="text"
                  placeholder="Your Name *"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass}
                />
                <input
                  name="company"
                  type="text"
                  placeholder="Company / Property"
                  value={form.company}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  name="email"
                  type="email"
                  placeholder="Email Address *"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass}
                />
                <input
                  name="phone"
                  type="tel"
                  placeholder="Phone Number *"
                  required
                  value={form.phone}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <select
                name="projectType"
                value={form.projectType}
                onChange={handleChange}
                className={`${inputClass} appearance-none`}
              >
                <option value="" disabled>
                  Project Type
                </option>
                {projectTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <textarea
                name="message"
                placeholder="Tell us about your project — size, timeline, location..."
                rows={5}
                value={form.message}
                onChange={handleChange}
                className={`${inputClass} resize-none`}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-accent text-bg font-bold py-4 text-xs tracking-widest uppercase hover:bg-accent/90 transition-colors disabled:opacity-60"
              >
                {status === "loading" ? "Sending..." : "Send Message"}
              </button>
              {status === "success" && (
                <p className="text-accent text-sm text-center">
                  Message sent. We&apos;ll be in touch soon.
                </p>
              )}
              {status === "error" && (
                <p className="text-red-400 text-sm text-center">
                  Something went wrong. Please call us directly.
                </p>
              )}
            </form>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
