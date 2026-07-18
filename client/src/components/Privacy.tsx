import { motion } from "framer-motion";
import { Shield, Lock, Eye, Database, Cookie, Mail, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Privacy = () => {
  const sections = [
    {
      icon: <Database className="w-6 h-6" />,
      title: "Information We Collect",
      content: [
        "Personal information: name, email, phone number, and delivery address.",
        "Payment information: processed securely through Stripe and Razorpay. We do not store your card details.",
        "Order history: items ordered, restaurant preferences, and delivery locations.",
        "Device information: IP address, browser type, and operating system for analytics.",
      ],
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: "How We Protect Your Data",
      content: [
        "All data is encrypted in transit using SSL/TLS protocols.",
        "Passwords are hashed using bcrypt before storage.",
        "JWT tokens are stored in HTTP-only cookies for secure authentication.",
        "Regular security audits and updates to protect against vulnerabilities.",
      ],
    },
    {
      icon: <Eye className="w-6 h-6" />,
      title: "How We Use Your Information",
      content: [
        "To process and deliver your food orders.",
        "To send order confirmations, updates, and promotional emails (with opt-out options).",
        "To improve our platform through analytics and user feedback.",
        "To comply with legal obligations and prevent fraud.",
      ],
    },
    {
      icon: <Cookie className="w-6 h-6" />,
      title: "Cookies & Tracking",
      content: [
        "We use cookies to remember your preferences and login sessions.",
        "Analytics cookies help us understand how users interact with our platform.",
        "You can disable cookies in your browser settings, though some features may not work.",
      ],
    },
    {
      icon: <Mail className="w-6 h-6" />,
      title: "Your Rights",
      content: [
        "You can request access to your personal data at any time.",
        "You have the right to request deletion of your account and associated data.",
        "You can opt out of marketing communications via email or account settings.",
        "Contact us at sumanjhanp1@gmail.com for any privacy-related requests.",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 rounded-full text-sm font-medium mb-6">
            <Shield className="w-4 h-4" />
            Privacy Policy
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
            Privacy{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">
              Policy
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </motion.div>

        {/* Introduction */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 mb-8"
        >
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            At <span className="font-semibold text-orange-500">Suman Food</span>, we take your privacy seriously. 
            This Privacy Policy explains how we collect, use, store, and protect your personal information 
            when you use our food delivery platform. By using Suman Food, you agree to the collection and 
            use of information in accordance with this policy.
          </p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-500">
                  {section.icon}
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {section.title}
                </h2>
              </div>
              <ul className="space-y-3">
                {section.content.map((item, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-3 text-gray-600 dark:text-gray-400"
                  >
                    <span className="w-2 h-2 bg-orange-400 rounded-full mt-2 shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            If you have any questions about this Privacy Policy, please contact us at{" "}
            <a
              href="mailto:sumanjhanp1@gmail.com"
              className="text-orange-500 hover:underline font-medium"
            >
              sumanjhanp1@gmail.com
            </a>
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-4">
            &copy; {new Date().getFullYear()} Suman Food. All rights reserved. Built by Suman Jhanp.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Privacy;