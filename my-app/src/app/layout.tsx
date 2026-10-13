import type { Metadata } from "next";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css"; // Don't forget this import!
import "./globals.css";


export const metadata: Metadata = {
  title: "Spatial Music Lab | NYU Shanghai Creative Innovation Lab",
  description: "Explore music through spatial mixing. Move sound sources to hear how position and level change an arrangement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>        
        <Theme appearance="dark">
          {children}
        </Theme>
      </body>
    </html>
  );
}
