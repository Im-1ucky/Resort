
import "./globals.css";
import { BookingProvider } from "@/contexts/BookingProvider";
import SiteOverlays from "@/components/layout/SiteOverlays";

export const metadata = {
  title: "The Estate | Coffee Estate Resort",
  description:
    "Experience a peaceful retreat surrounded by the coffee estates of Chikkamagaluru.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <BookingProvider>
          {children}
          <SiteOverlays />
        </BookingProvider>
      </body>
    </html>
  );
}
