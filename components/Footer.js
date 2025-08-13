'use client';

import { FaFacebook, FaTwitter, FaInstagram, FaPhone, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer-wrapper" role="contentinfo">
      <div className="footer-content">
        {/* Left: Logo + Description */}
        <div className="footer-section">
          <h2 className="footer-logo">LocateMyCity</h2>
          <p className="footer-description">
            Helping you explore cities smarter. Fast, accurate, and user-friendly.
          </p>
        </div>

        {/* Center: Links */}
        <div className="footer-section">
          <h2 className="footer-heading">Quick Links</h2>
          <ul className="footer-links">
            <li><Link href="/">Home</Link></li>
            <li><Link href="/about">About Us</Link></li>
            <li><Link href="/faq">FAQ</Link></li>
            <li><Link href="/contact">Contact</Link></li>
          </ul>
        </div>

        {/* Right: Contact Info */}
        <div className="footer-section">
          <h2 className="footer-heading">Contact Us</h2>
  
<p>
  <FaEnvelope className="footer-icon" />{' '}
  <a href="mailto:support@locatemycity.com" style={{ color: 'inherit', textDecoration: 'none' }}>
    support@locatemycity.com
  </a>
</p>         
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} LocateMyCity. All rights reserved.</p>
      </div>
    </footer>
  );
}
