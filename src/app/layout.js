import "./globals.css";
import "@livekit/components-styles";

export const metadata = {
  title: "Live Streaming Demo",
  description: "Live video streaming using Next.js and LiveKit",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}