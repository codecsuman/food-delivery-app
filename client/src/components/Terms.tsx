import { motion } from "framer-motion";
import { FileText, Scale, Truck, CreditCard, UserX, AlertTriangle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Terms = () => {
  const sections = [
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Acceptance of Terms",
      content: [
        "By accessing or using Suman Food, you agree to be bound by these Terms of Service.",
        "You must be at least 18 years old to use our platform or place orders.",
        "We reserve the right to modify these terms at any time. Continued use constitutes acceptance.",
        "You are responsible for maintaining the confidentiality of your account credentials.",
      ],
    },
    {
      icon: <Scale className="w-6 h-6" />,
      title: "User Responsibilities",
      content: [
        "Provide accurate and complete information during registration and checkout.",
        "Do not use the platform for any illegal or unauthorized purposes.",
        "Respect restaurant policies, delivery instructions, and platform guidelines.",
        "Do not attempt to disrupt, hack, or interfere with the platform's functionality.",
      ],
    },
    {
      icon: <Truck className="w-6 h-6" />,
      title: "Orders & Delivery",
      content: [
        "All orders are subject to restaurant availability and confirmation.",
        "Delivery times are estimates and may vary based on traffic, weather, and restaurant preparation time.",
        "You must be available at the provided delivery address to receive your order.",
        "Refunds for undelivered or incorrect orders are handled on a case-by-case basis.",
      ],
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Payments & Refunds",
      content: [
        "All payments are processed securely through Stripe and Razorpay.",
        "Prices listed include applicable taxes unless stated otherwise.",
        "Refunds, if approved, will be processed to the original payment method within 5-7 business days.",
        "We are not responsible for payment failures caused by third-party payment providers.",
      ],
    },
    {
      icon: <AlertTriangle className="w-6 h-6" />,
      title: "Limitation of Liability",
      content: [
        "Suman Food acts as a platform connecting customers with restaurants. We are not responsible for food quality prepared by partner restaurants.",
        "We are not liable for delays caused by circumstances beyond our control (e.g., weather, traffic, restaurant closures).",
        "Our total liability is limited to the amount paid for the specific order in question.",
      ],
    },
    {
      icon: <UserX className="w-6 h-6" />,
      title: "Account Termination",
      content: [
        "We reserve the right to suspend or terminate accounts that violate these terms.",
        "Fraudulent activity, abuse, or repeated complaints may result in permanent account suspension.",
        "You may delete your account at any time by contacting us at sumanjhanp1@gmail.com.",
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
            <Scale className="w-4 h-4" />
            Terms of Service
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
            Terms &{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">
              Conditions
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
            Welcome to <span className="font-semibold text-orange-500">Suman Food</span>. These Terms of Service 
            govern your use of our website and mobile services. Please read them carefully before using our platform. 
            If you do not agree with any part of these terms, you must not use our services.
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
            For any questions regarding these terms, please contact us at{" "}
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

export default Terms;