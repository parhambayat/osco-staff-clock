import './globals.css';

export const metadata = {
  title: 'Osco Lounge — Staff Clock',
  description: 'Staff clock-in / clock-out for Osco Lounge',
  manifest: '/manifest.json',
  themeColor: '#CE1126',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Osco Clock',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  );
}
