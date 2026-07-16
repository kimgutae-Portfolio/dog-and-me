import type { Metadata } from "next";
import { CustomerFilmSite } from "./CustomerFilmSite";

export const metadata: Metadata = {
  title: "専用メモリーサイト",
  robots: { index: false, follow: false },
};

export default function CustomerFilmPage() {
  return <CustomerFilmSite />;
}
