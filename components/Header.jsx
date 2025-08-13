'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';


const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef(null);
  const hamburgerRef = useRef(null);
  const headerRef = useRef(null);

  useEffect(() => {
    setMounted(true);

    const handleClickOutside = (e) => {
      if (menuOpen && headerRef.current && !headerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };

    const handleScroll = () => {
      if (menuOpen) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [menuOpen]);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const handleNavigation = useCallback((e, path) => {
    e.preventDefault();
    setMenuOpen(false);
    // Smooth scroll to section if it's an internal link
    if (path.startsWith('#')) {
      const section = document.querySelector(path);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // Regular navigation for other links
      window.location.href = path;
    }
  }, []);

  if (!mounted) return null;

  return (
    <>
      <style>{`
        header {
          width: 100%;
          background: #3bb5fd;
          position: sticky;
          top: 0;
          z-index: 1000;
          min-height: 70px;
          display: flex;
          align-items: center;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .container {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 16px;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          background: linear-gradient(90deg, #ffffff, #e0e0e0);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .logo-image {
          border-radius: 50%;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
          height: 32px;
          width: 32px;
          object-fit: contain;
        }

        .nav-links {
          display: flex;
          gap: 10px;
        }

        .nav-links a {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          color: white;
          text-decoration: none;
          font-weight: 600;
          padding: 0.5rem 1rem;
          border-radius: 50px;
          min-width: 100px;
          text-align: center;
          transition: all 0.3s ease;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .nav-links a:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-2px);
        }

        .hamburger {
          display: none;
          cursor: pointer;
          width: 32px;
          height: 32px;
          position: relative;
          background: transparent;
          border: none;
          padding: 0;
          z-index: 1001;
        }

        .hamburger span {
          display: block;
          position: absolute;
          height: 2px;
          width: 24px;
          background: white;
          left: 4px;
          transition: all 0.3s ease;
        }

        .hamburger span:nth-child(1) {
          top: 10px;
        }

        .hamburger span:nth-child(2) {
          top: 16px;
        }

        .hamburger span:nth-child(3) {
          top: 22px;
        }

        .hamburger.open span:nth-child(1) {
          transform: rotate(45deg) translate(5px, 5px);
        }

        .hamburger.open span:nth-child(2) {
          opacity: 0;
        }

        .hamburger.open span:nth-child(3) {
          transform: rotate(-45deg) translate(5px, -5px);
        }

        .mobile-menu {
          position: fixed;
          top: 70px;
          right: 0;
          min-width: 200px;
          background: rgba(59, 181, 253, 0.98);
          padding: 10px;
          box-shadow: 0 5px 15px rgba(0,0,0,0.2);
          border-radius: 0 0 0 10px;
          transform: translateX(100%);
          transition: transform 0.3s ease;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .mobile-menu.open {
          transform: translateX(0);
        }

        .mobile-menu a {
          color: black;
          text-decoration: none;
          padding: 10px 15px;
          border-radius: 5px;
          transition: background 0.2s;
        }

        .mobile-menu a:hover {
          background: rgba(255,255,255,0.2);
        }

        @media (max-width: 768px) {
          .nav-links {
            display: none;
          }
          .hamburger {
            display: block;
          }
          .logo h2 {
            display: none;
          }
        }
      `}</style>

      <nav aria-label="Skip navigation">
        <a href="#main-content" className="skip-link">Skip to main content</a>
      </nav>
      <header role="banner" ref={headerRef}>
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <img
                src="/Images/cityfav.png"
                alt="Locate My City logo"
                className="logo-image"
                width="32"
                height="32"
                loading="lazy"
              />
              <h2>LocateMyCity</h2>
            </div>

            <nav className="nav-links" aria-label="Main navigation">
              <a href="/" onClick={(e) => handleNavigation(e, '/')}>Home</a>
              <a href="/about" onClick={(e) => handleNavigation(e, '/about')}>About</a>
              <a href="/contact" onClick={(e) => handleNavigation(e, '/contact')}>Contact</a>
            </nav>

            <button
              ref={hamburgerRef}
              className={`hamburger ${menuOpen ? 'open' : ''}`}
              onClick={toggleMenu}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>

        <div
  ref={menuRef}
  className={`mobile-menu ${menuOpen ? 'open' : ''}`}
  aria-hidden={!menuOpen}
>
  <a
    href="/"
    tabIndex={menuOpen ? 0 : -1}
    onClick={(e) => handleNavigation(e, '/')}
  >
    Home
  </a>
  <a
    href="/about"
    tabIndex={menuOpen ? 0 : -1}
    onClick={(e) => handleNavigation(e, '/about')}
  >
    About
  </a>
  <a
    href="/contact"
    tabIndex={menuOpen ? 0 : -1}
    onClick={(e) => handleNavigation(e, '/contact')}
  >
    Contact
  </a>
</div>

      </header>
    </>
  );
};

export default Header;