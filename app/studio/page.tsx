import type { Metadata } from "next";
import { StudioClient } from "./StudioClient";

export const metadata: Metadata = { title: "制作室" };

export default function StudioPage() { return <StudioClient />; }
