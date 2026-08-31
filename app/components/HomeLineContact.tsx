"use client";

import { useEffect, useState } from "react";

const LINE_CONTACT_URL = "https://lin.ee/9ejBIax";

function LineMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M54.5 29.1c0-10.1-10.1-18.3-22.5-18.3S9.5 19 9.5 29.1c0 9 8 16.6 18.8 18l-1.2 5.2c-.2.8.6 1.5 1.3 1.1 8.5-4.7 13.5-8.7 16.4-12.2 6-3.3 9.7-7.5 9.7-12.1Z"
      />
      <path
        fill="none"
        stroke="#06c755"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.1 23.9v10.2h6.4M27.1 23.9v10.2M31.2 34.1V23.9l7 10.2V23.9M47 23.9h-6v10.2h6m-6-5.2h5.4"
      />
    </svg>
  );
}

export function HomeLineContact() {
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const footerAction = document.querySelector(".storybook-final-cta");
    if (!footerAction) return;

    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { rootMargin: "0px 0px -8%", threshold: 0.08 },
    );
    observer.observe(footerAction);
    return () => observer.disconnect();
  }, []);

  if (footerVisible) return null;

  return (
    <a
      className="home-line-contact"
      href={LINE_CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="LINEで相談する"
      title="LINEで相談する"
    >
      <LineMark />
      <span>LINEで相談</span>
    </a>
  );
}

export function HomeLineContactLink() {
  return (
    <a
      className="button button-cream final-line-contact"
      href={LINE_CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      <LineMark />
      <span>LINEで相談する</span>
    </a>
  );
}
