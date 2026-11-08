import "./globals.css";
import { BookingProvider } from "@/components/Booking/BookingProvider";
import BookingBar from "@/components/Booking/BookingBar";

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
          <BookingBar placement="global" />
        </BookingProvider>
      </body>
    </html>
  );
}
