import { DEFAULT_SITE_ORIGIN, SITE_NAME } from "./site";

type Faq = readonly [question: string, answer: string];

export function createGuideStructuredData({
  path,
  title,
  description,
  faqs,
}: {
  path: string;
  title: string;
  description: string;
  faqs?: readonly Faq[];
}) {
  const url = new URL(path, DEFAULT_SITE_ORIGIN).toString();
  const items: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: title,
      description,
      inLanguage: "ja-JP",
      isPartOf: { "@id": `${DEFAULT_SITE_ORIGIN}/#website` },
      about: { "@id": `${DEFAULT_SITE_ORIGIN}/#memory-film-service` },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: SITE_NAME,
          item: DEFAULT_SITE_ORIGIN,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: title,
          item: url,
        },
      ],
    },
  ];

  if (faqs?.length) {
    items.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    });
  }

  return items;
}
