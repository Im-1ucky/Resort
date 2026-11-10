import "./globals.css";
import { BookingProvider } from "@/contexts/BookingProvider";
import SiteOverlays from "@/components/layout/SiteOverlays";
import { StaffAuthProvider } from "@/contexts/StaffAuthProvider";

export const metadata = {
  title: "The Estate",
  description:
    "Experience peaceful stays in the estates of Chikkamagaluru. Discover comfort, nature and unforgettable moments at The Estate.",
  icons: {
    icon: "/images/logo/logo.svg",
    shortcut: "/images/logo/logo.svg",
    apple: "/images/logo/logo.svg",
  },
  openGraph: {
    title: "The Estate | Stays in Chikkamagaluru",
    description:
      "Experience peaceful stays in the estates of Chikkamagaluru.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <BookingProvider>
          <StaffAuthProvider>
            {children}
          </StaffAuthProvider>
          <SiteOverlays />
        </BookingProvider>
      </body>
    </html>
  );
}
