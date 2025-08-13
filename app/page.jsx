import Head from 'next/head';
import Script from 'next/script'; // ✅ Import this
import Image from 'next/image';
import Header from '../components/Header';
import Hero from '../components/Hero';
import Cards from '../components/Cards';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <>
      <Head>
        <title>Locate My City</title>
        <meta charSet="UTF-8" />
        <meta name="robots" content="index, follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/png" href="/images/cityfav.png" />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700;900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@700&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "LocateMyCity - Distance Calculator & Location Explorer",
              "url": "https://www.locatemycity.com",
              "description": "Calculate precise distances between locations, explore cities worldwide, and discover unique geographical features like rock formations and springs.",
              "applicationCategory": "TravelApplication",
              "operatingSystem": "Web Browser",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "featureList": [
                "Distance calculator (current location to any destination)",
                "Location-to-location comparison",
                "Rock city explorer",
                "Spring city finder"
              ],
              "screenshot": "https://www.locatemycity.com/images/app-screenshot.jpg",
              "creator": {
                "@type": "Organization",
                "name": "LocateMyCity"
              },
              "interactionStatistic": {
                "@type": "InteractionCounter",
                "interactionType": "https://schema.org/UseAction",
                "userInteractionCount": "50000"
              }
            })
          }}
        />
      </Head>

      <main>
        <Header />
        <Hero />
        <Cards />
        <Footer />
      </main>
    </>
  );
}
