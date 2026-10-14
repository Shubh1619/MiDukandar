"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";

export type TermsSectionLink = {
  id: string;
  title: string;
};

type TermsTocProps = {
  sections: TermsSectionLink[];
};

export default function TermsToc({ sections }: TermsTocProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-112px 0px -58% 0px", threshold: [0, 0.1, 0.5] },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections]);

  const jumpTo = (id: string) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="lg:hidden">
        <label htmlFor="terms-section-jump" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-navy-500">
          <List className="size-3.5 text-royal-600" aria-hidden />
          Jump to section
        </label>
        <select
          id="terms-section-jump"
          value={activeId}
          onChange={(event) => jumpTo(event.target.value)}
          className="h-11 w-full rounded-xl border border-navy-200 bg-white px-3 text-sm font-semibold text-navy-800 outline-none focus:border-royal-500 focus:ring-4 focus:ring-royal-500/10"
        >
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.title}
            </option>
          ))}
        </select>
      </div>

      <aside className="sticky top-28 hidden max-h-[calc(100vh-9rem)] overflow-y-auto pr-2 lg:block" aria-label="Terms sections">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-navy-400">
          <List className="size-3.5 text-royal-600" aria-hidden />
          On this page
        </p>
        <nav className="space-y-1 border-l border-navy-100">
          {sections.map((section, index) => {
            const active = activeId === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={active ? "location" : undefined}
                onClick={() => setActiveId(section.id)}
                className={`-ml-px flex gap-2 border-l-2 py-2 pl-3 text-xs leading-snug transition-colors ${
                  active
                    ? "border-royal-600 font-semibold text-royal-700"
                    : "border-transparent text-navy-500 hover:border-navy-300 hover:text-navy-900"
                }`}
              >
                <span className={`w-4 shrink-0 text-[10px] tabular-nums ${active ? "text-royal-500" : "text-navy-300"}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{section.title}</span>
              </a>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
