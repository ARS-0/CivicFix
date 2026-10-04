import './globals.css';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/public-sans';
import AuthProvider from '@/components/AuthProvider';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'CivicFix: report local problems, get them fixed',
  description: 'Snap a photo of a pothole, broken streetlight, leak or dumping. AI sorts it, groups duplicates and routes it to the right city team.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="mt-12 border-t border-line py-6 text-center text-sm text-mute">CivicFix. Built for the hackathon with Next.js, Express, PostGIS and FastAPI.</footer>
        </AuthProvider>
      </body>
    </html>
  );
}
