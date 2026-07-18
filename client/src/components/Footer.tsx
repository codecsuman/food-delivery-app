import { Link } from "react-router-dom";
import {
  UtensilsCrossed,
  Heart,
  Linkedin,
  Github,
  Instagram,
  Facebook,
  Mail,
  Phone,
  MapPin,
  ArrowUpRight,
  Sparkles,
  Home,
  Search,
  User,
  ShoppingCart,
  Utensils,
  SquareMenu,
  PackageCheck,
  Info,
  MessageSquare,
  Shield,
  Scale,
} from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { label: "Home", href: "/", icon: <Home className="w-4 h-4" /> },
    { label: "Search", href: "/search/all", icon: <Search className="w-4 h-4" /> },
    { label: "Profile", href: "/profile", icon: <User className="w-4 h-4" /> },
    { label: "Cart", href: "/cart", icon: <ShoppingCart className="w-4 h-4" /> },
  ];

  const adminLinks = [
    { label: "My Restaurant", href: "/admin/restaurant", icon: <Utensils className="w-4 h-4" /> },
    { label: "Menu", href: "/admin/menu", icon: <SquareMenu className="w-4 h-4" /> },
    { label: "Orders", href: "/admin/orders", icon: <PackageCheck className="w-4 h-4" /> },
  ];

  const legalLinks = [
    { label: "About Us", href: "/about", icon: <Info className="w-4 h-4" /> },
    { label: "Contact", href: "/contact", icon: <MessageSquare className="w-4 h-4" /> },
    { label: "Privacy Policy", href: "/privacy", icon: <Shield className="w-4 h-4" /> },
    { label: "Terms of Service", href: "/terms", icon: <Scale className="w-4 h-4" /> },
  ];

  const socialLinks = [
    {
      icon: <Linkedin className="w-5 h-5" />,
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/sumanjhanp/",
      gradient: "from-[#0077B5] to-[#00A0DC]",
      shadow: "shadow-[#0077B5]/40",
      glow: "#0077B5",
    },
    {
      icon: <Github className="w-5 h-5" />,
      label: "GitHub",
      href: "https://github.com/codecsuman",
      gradient: "from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800",
      shadow: "shadow-gray-500/40",
      glow: "#6b7280",
    },
    {
      icon: <Instagram className="w-5 h-5" />,
      label: "Instagram",
      href: "https://www.instagram.com/sj.suman.nest/",
      gradient: "from-purple-500 via-pink-500 to-orange-500",
      shadow: "shadow-pink-500/40",
      glow: "#ec4899",
    },
    {
      icon: <Facebook className="w-5 h-5" />,
      label: "Facebook",
      href: "https://www.facebook.com/suman.jhanp.9/",
      gradient: "from-[#1877F2] to-[#42B72A]",
      shadow: "shadow-[#1877F2]/40",
      glow: "#1877F2",
    },
  ];

  // Glowing link button component
  const GlowingLink = ({
    href,
    icon,
    label,
  }: {
    href: string;
    icon: React.ReactNode;
    label: string;
  }) => (
    <li>
      <Link
        to={href}
        className="group flex items-center gap-3 px-3 py-2.5 rounded-xl
          text-sm text-gray-500 dark:text-gray-400
          bg-transparent
          hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600
          hover:text-white
          hover:shadow-lg hover:shadow-orange-500/30
          transition-all duration-300 ease-out
          relative overflow-hidden"
      >
        {/* Glow background on hover */}
        <span className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300" />

        {/* Icon with glow */}
        <span className="relative z-10 w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 
          group-hover:bg-white/20 flex items-center justify-center
          transition-all duration-300
          group-hover:shadow-md group-hover:shadow-orange-400/40">
          {icon}
        </span>

        {/* Label */}
        <span className="relative z-10 font-medium">{label}</span>

        {/* Arrow that appears on hover */}
        <ArrowUpRight className="relative z-10 w-3.5 h-3.5 ml-auto opacity-0 -translate-y-1 translate-x-1 
          group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 
          transition-all duration-300" />
      </Link>
    </li>
  );

  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 relative overflow-hidden">
      {/* Ambient Glow Background */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-orange-400/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 py-14 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          {/* Brand Column */}
          <div className="lg:col-span-4">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-5 group">
              <div className="w-11 h-11 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center 
                shadow-lg shadow-orange-500/20 group-hover:shadow-orange-500/50 group-hover:scale-105 transition-all duration-300">
                <UtensilsCrossed className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-extrabold text-orange-500 group-hover:text-orange-600 transition-colors">
                Suman Food
              </span>
            </Link>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6 max-w-xs">
              Delicious food delivered to your doorstep. Built with passion by{" "}
              <span className="font-semibold text-orange-500">Suman Jhanp</span>, a 
              Full-Stack MERN Developer from Kolkata, India.
            </p>

            {/* Contact Info Cards */}
            <div className="space-y-2.5">
              <a
                href="mailto:sumanjhanp1@gmail.com"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400 
                  hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 hover:text-white hover:shadow-lg hover:shadow-orange-500/25
                  transition-all duration-300 group"
              >
                <span className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center 
                  group-hover:bg-white/20 transition-colors">
                  <Mail className="w-3.5 h-3.5 text-orange-500 group-hover:text-white transition-colors" />
                </span>
                sumanjhanp1@gmail.com
              </a>
              <a
                href="tel:+918597376239"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400 
                  hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 hover:text-white hover:shadow-lg hover:shadow-orange-500/25
                  transition-all duration-300 group"
              >
                <span className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center 
                  group-hover:bg-white/20 transition-colors">
                  <Phone className="w-3.5 h-3.5 text-orange-500 group-hover:text-white transition-colors" />
                </span>
                +91-8597376239
              </a>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400">
                <span className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5 text-orange-500" />
                </span>
                Kolkata, West Bengal, India
              </div>
            </div>
          </div>

          {/* Quick Links - Glowing */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5 px-3">
              Quick Links
            </h3>
            <ul className="space-y-1">
              {quickLinks.map((link) => (
                <GlowingLink key={link.label} href={link.href} icon={link.icon} label={link.label} />
              ))}
            </ul>
          </div>

          {/* Dashboard Links - Glowing */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5 px-3">
              Dashboard
            </h3>
            <ul className="space-y-1">
              {adminLinks.map((link) => (
                <GlowingLink key={link.label} href={link.href} icon={link.icon} label={link.label} />
              ))}
            </ul>
          </div>

          {/* Legal Links - Glowing */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5 px-3">
              Legal
            </h3>
            <ul className="space-y-1">
              {legalLinks.map((link) => (
                <GlowingLink key={link.label} href={link.href} icon={link.icon} label={link.label} />
              ))}
            </ul>
          </div>

          {/* Social & Connect */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5 px-3">
              Connect
            </h3>

            {/* Glowing Social Buttons */}
            <div className="flex flex-wrap gap-3 mb-6 px-1">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    relative w-11 h-11 rounded-xl flex items-center justify-center
                    bg-gradient-to-br ${social.gradient}
                    text-white
                    shadow-lg ${social.shadow}
                    hover:shadow-xl hover:scale-110
                    transition-all duration-300 ease-out
                    group
                  `}
                  title={social.label}
                >
                  {/* Glow effect */}
                  <span 
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300"
                    style={{ background: social.glow }}
                  />
                  <span className="relative z-10">{social.icon}</span>

                  {/* Pulse ring */}
                  <span className="absolute inset-0 rounded-xl border-2 border-white/30 opacity-0 group-hover:opacity-100 group-hover:animate-ping transition-opacity" />
                </a>
              ))}
            </div>

            {/* Developer Badge */}
            <div className="mx-1 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10 
              rounded-xl p-4 border border-orange-200/50 dark:border-orange-800/30
              hover:shadow-lg hover:shadow-orange-500/10 transition-shadow duration-300">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                  Developer
                </span>
              </div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                Suman Jhanp
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Full-Stack MERN Developer
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Kolkata, West Bengal
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-200 dark:border-gray-800 relative">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            &copy; {currentYear} Suman Food. Made with
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse" />
            by{" "}
            <a
              href="https://www.linkedin.com/in/sumanjhanp/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-orange-500 hover:text-orange-600 transition-colors"
            >
              Suman Jhanp
            </a>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            All rights reserved. MERN Stack Application.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;