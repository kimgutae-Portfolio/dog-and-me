const LINE_CONTACT_URL = "https://lin.ee/9ejBIax";

export function HomeLineContact() {
  return (
    <a
      className="home-line-contact"
      href={LINE_CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="LINEで相談する"
      title="LINEで相談する"
    >
      <svg
        viewBox="0 0 64 64"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M54.5 29.1c0-10.1-10.1-18.3-22.5-18.3S9.5 19 9.5 29.1c0 9 8 16.6 18.8 18l-1.2 5.2c-.2.8.6 1.5 1.3 1.1 8.5-4.7 13.5-8.7 16.4-12.2 6-3.3 9.7-7.5 9.7-12.1Z" />
        <path d="M18.1 23.9v10.2h6.4M27.1 23.9v10.2M31.2 34.1V23.9l7 10.2V23.9M47 23.9h-6v10.2h6m-6-5.2h5.4" />
      </svg>
      <span>LINEで相談</span>
    </a>
  );
}
