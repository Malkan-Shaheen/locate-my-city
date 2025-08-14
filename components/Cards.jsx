"use client";

import Head from "next/head";
import Link from "next/link";

export default function Features() {
  const features = [
    {
      icon: "📍",
      title: "Distance From Me",
      desc: "Calculate precise distances from your current location to any destination. Get accurate measurements in miles or kilometers with real-time updates.",
      link: "/location-from-me",
      btn: "Calculate Distance",
    },
    {
      icon: "🗺️",
      title: "Location to Location",
      desc: "Compare distances between any two points of interest. Perfect for planning trips or finding the most convenient routes between locations.",
      link: "/location-from-location/location-to-location",
      btn: "Compare Locations",
    },
    {
      icon: "🪨",
      title: "Rock Cities",
      desc: "Explore cities and towns with “rock” in their name—unique places tied together by one powerful word.",
      link: "/rock",
      btn: "Explore Rocks",
    },
    {
      icon: "💧",
      title: "Spring Cities",
      desc: "Explore cities with “Spring” in their name—perfect for discovering places that sound refreshing, whether or not water is involved.",
      link: "/spring",
      btn: "Discover Springs",
    },
    {
      icon: "🌆",
      title: "Find Places & Cities",
      desc: "Search for any place or city around the world. Get instant details, locations, and explore them on an interactive map.",
      link: "/find-places",
      btn: "Search Now",
    },
  ];

  return (
    <>
      <Head>
        <title>LocateMyCity - Features</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <section className="features-wrapper1">
        <h2 className="main-title1">Explore Location Features</h2>

        {features.map((f, i) => (
          <div className="feature-section1" key={i}>
            <div className="feature-icon1">{f.icon}</div>
            <div className="feature-content1">
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <Link href={f.link}>
                <button className="feature-btn1">{f.btn}</button>
              </Link>
            </div>
          </div>
        ))}
      </section>

   
    </>
  );
}
