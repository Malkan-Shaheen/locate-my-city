'use client';
import Head from 'next/head';
import { FiMail, FiClock, FiMessageSquare, FiUsers, FiGlobe, FiSend } from 'react-icons/fi';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function ContactPage() {
  return (
    <>
      <Head>
        <title>Contact Us | LocateMyCity</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div className="contact-page">
        <Header />
        <main>
        {/* Hero Section */}
        <section className="contact-hero">
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <h1>Get in <span>Touch</span></h1>
            <p className="hero-subtitle">
              Have a question, found an error, or want to suggest a location? We'd love to hear from you.
            </p>
            <div className="divider"></div>
          </div>
        </section>

        {/* Main Content */}
        <section className="contact-content">
          <div className="contact-grid">
            {/* Contact Cards */}
            <div className="contact-card support-card">
              <div className="card-icon">
                <FiMail size={28} />
              </div>
              <h3>Email Support</h3>
              <a href="mailto:support@locatemycity.com" className="email-link">
                support@locatemycity.com
              </a>
              <p className="card-description">
                Whether you're reporting a bug, requesting a feature, or just curious about how something works.
              </p>
              <div className="response-time">
                <FiClock size={18} />
                <span>We typically respond within 24–48 hours</span>
              </div>
            </div>

            <div className="contact-card media-card">
              <div className="card-icon">
                <FiMessageSquare size={28} />
              </div>
              <h3>Media Inquiries</h3>
              <p className="card-description">
                Reach out with "Media" in your subject line so we can prioritize your message.
              </p>
            </div>

            <div className="contact-card partnership-card">
              <div className="card-icon">
                <FiUsers size={28} />
              </div>
              <h3>Partnerships</h3>
              <p className="card-description">
                Include "Partnership" in your subject line for business collaboration opportunities.
              </p>
            </div>

       
          </div>
        </section>

        {/* Closing Section */}
        <section className="closing-section">
          <div className="closing-content">
            <FiGlobe size={48} className="globe-icon" />
            <h2>Let's keep exploring — together.</h2>
            <p>
              Your feedback helps us improve LocateMyCity for everyone. We appreciate every message we receive.
            </p>
          </div>
         
        </section>
        </main>
        <Footer />
      </div>

      
    </>
  );
}