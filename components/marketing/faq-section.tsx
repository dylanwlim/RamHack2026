"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";

type FAQItem = {
  question: string;
  answer: string;
};

export function FAQSection({
  title = "Frequently asked questions",
  faqs,
}: {
  title?: string;
  faqs: FAQItem[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="section-space bg-white/60">
      <div className="site-shell">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="text-[2.5rem] leading-tight tracking-tight text-slate-950 lg:sticky lg:top-24">
              {title}
            </h2>
          </div>

          <div className="lg:col-span-8">
            {faqs.map((faq, index) => (
              <div key={faq.question} className="border-b border-slate-200 last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-6 py-6 text-left"
                  onClick={() => setOpenIndex((value) => (value === index ? null : index))}
                >
                  <span className="text-lg leading-7 text-slate-900">{faq.question}</span>
                  <motion.span
                    animate={{ rotate: openIndex === index ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-none text-slate-700"
                  >
                    <Plus className="h-5 w-5" strokeWidth={1.5} />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {openIndex === index ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <p className="pb-6 pr-0 text-base leading-7 text-slate-600 sm:pr-12">
                        {faq.answer}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
