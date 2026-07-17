import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#f8f5ed",
        background: "#303a31",
        border: "24px solid #d8c6a7",
        fontFamily: "Georgia, serif",
        fontSize: 178,
        letterSpacing: 8,
      }}
    >
      WM
    </div>,
    size,
  );
}
