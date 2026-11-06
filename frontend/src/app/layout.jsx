import "./globals.css";

export const metadata = {
  title: "The Estate | Coffee Estate Resort",
  description:
    "Experience a peaceful retreat surrounded by the coffee estates of Chikkamagaluru.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
