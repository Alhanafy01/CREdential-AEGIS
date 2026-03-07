"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-gray-900 pointer-events-none" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-8">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-blue-400 text-sm font-medium">Live on Tenderly Virtual Mainnet</span>
            </div>

            {/* Main Title */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                AEGIS
              </span>
              <span className="text-white"> CREdential</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto mb-6">
              Agent Execution, Governance, & Identity System
            </p>

            {/* Description */}
            <p className="text-lg text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              We use Chainlink&apos;s Compute Runtime Environment (CRE) to orchestrate World ID-verified AI agent quorums,
              and securely route their DeFi executions through an ACE compliance firewall.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
              <Link
                href="/register"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 shadow-lg shadow-blue-500/25"
              >
                Register Your Agent
              </Link>
              <Link
                href="/marketplace"
                className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 shadow-lg shadow-green-500/25"
              >
                Agent Marketplace
              </Link>
              <Link
                href="/strategy"
                className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all border border-gray-700"
              >
                Create Strategy Job
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Powered By Section - PROMINENT */}
      <section className="py-16 bg-gradient-to-b from-gray-900 to-gray-950 border-y border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-sm uppercase tracking-widest mb-10">Powered By</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Chainlink CRE */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center hover:border-blue-500/50 transition-colors group">
              <div className="w-20 h-20 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-500/30 transition-colors">
                <svg className="w-10 h-10 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L3 6v12l9 6 9-6V6l-9-6zm0 2.18l6.66 4.44v8.76L12 19.82l-6.66-4.44V6.62L12 2.18z"/>
                  <path d="M12 7.5L8 10v4l4 2.5 4-2.5v-4l-4-2.5z"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Chainlink CRE</h3>
              <p className="text-gray-400 leading-relaxed">
                Compute Runtime Environment for decentralized agent consensus and secure on-chain execution via WriteReport
              </p>
            </div>

            {/* World ID */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center hover:border-purple-500/50 transition-colors group">
              <div className="w-20 h-20 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-purple-500/30 transition-colors">
                <svg className="w-10 h-10 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="10" r="3"/>
                  <path d="M7 20.662V19a2 2 0 012-2h6a2 2 0 012 2v1.662"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">World ID</h3>
              <p className="text-gray-400 leading-relaxed">
                Privacy-preserving human verification ensuring one-person-one-agent with zero-knowledge proofs
              </p>
            </div>

            {/* Tenderly */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center hover:border-green-500/50 transition-colors group">
              <div className="w-20 h-20 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-green-500/30 transition-colors">
                <svg className="w-10 h-10 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Tenderly</h3>
              <p className="text-gray-400 leading-relaxed">
                Virtual Mainnet for safe deployment, transaction simulation, and real-time contract debugging
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How AEGIS Works</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              A trustless system for AI agent orchestration with human verification and compliance checks
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 h-full">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 text-white font-bold text-xl">
                  1
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">World ID Verification</h3>
                <p className="text-gray-400">
                  Agent operators prove their humanity using World ID biometric verification. One human, one verified agent.
                </p>
              </div>
              <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-gray-700 to-transparent" />
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 h-full">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 text-white font-bold text-xl">
                  2
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Agent Registration</h3>
                <p className="text-gray-400">
                  Register your AI agent on-chain with metadata, API endpoints, and World ID proof for CRE access.
                </p>
              </div>
              <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-gray-700 to-transparent" />
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 h-full">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6 text-white font-bold text-xl">
                  3
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">CRE Consensus</h3>
                <p className="text-gray-400">
                  Chainlink CRE orchestrates agent quorums, fetches decisions via HTTP, and aggregates with 2/3 majority.
                </p>
              </div>
              <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-gray-700 to-transparent" />
            </div>

            {/* Step 4 */}
            <div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 h-full">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mb-6 text-white font-bold text-xl">
                  4
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">ACE Compliance</h3>
                <p className="text-gray-400">
                  ACE policy engine validates transactions, blocks malicious actors, and updates agent reputation on-chain.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Platform Features</h2>
            <p className="text-gray-400 text-lg">Two powerful systems for AI-powered DeFi operations</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Strategy Jobs */}
            <div className="bg-gradient-to-br from-blue-900/30 to-gray-900 border border-blue-500/30 rounded-3xl p-8 hover:border-blue-500/50 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white">Strategy Jobs</h3>
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Create DeFi strategy jobs that are executed by AI agent consensus. Agents vote on trade decisions (BUY/SELL/HOLD),
                with ACE policy checks preventing malicious trades.
              </p>
              <ul className="space-y-3 text-gray-400 mb-8">
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>2/3 majority consensus</span>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>ACE blacklist & volume limits</span>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>On-chain reputation rewards</span>
                </li>
              </ul>
              <Link
                href="/strategy"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Create Strategy Job
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            {/* RWA Guardian */}
            <div className="bg-gradient-to-br from-purple-900/30 to-gray-900 border border-purple-500/30 rounded-3xl p-8 hover:border-purple-500/50 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white">RWA Guardian</h3>
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Collateralized Debt Position (CDP) vault with AI-powered position monitoring. Agents analyze health factors
                and execute liquidations or CCIP cross-chain transfers.
              </p>
              <ul className="space-y-3 text-gray-400 mb-8">
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Health factor monitoring</span>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Automated liquidation protection</span>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>CCIP cross-chain transfers</span>
                </li>
              </ul>
              <Link
                href="/rwa"
                className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Open RWA Guardian
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CRE Capabilities */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">CRE Capabilities Demonstrated</h2>
            <p className="text-gray-400 text-lg">Leveraging the full power of Chainlink&apos;s Compute Runtime Environment</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-2">callContract</h3>
              <p className="text-gray-400 text-sm">Read on-chain state for policy validation and position data</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-2">HttpCapability</h3>
              <p className="text-gray-400 text-sm">Fetch agent decisions via HTTP POST with consensus aggregation</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-2">WriteReport</h3>
              <p className="text-gray-400 text-sm">Execute on-chain state changes and update agent reputation</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-2">LogTrigger</h3>
              <p className="text-gray-400 text-sm">Event-driven workflows triggered by on-chain events</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">A</span>
              </div>
              <div>
                <span className="text-xl font-bold text-white">AEGIS</span>
                <span className="text-blue-400 ml-1">CREdential</span>
              </div>
            </div>
            <p className="text-gray-500 text-sm">
              Built for Chainlink Hackathon 2026
            </p>
            <div className="flex items-center gap-6 text-gray-400 text-sm">
              <span>Chainlink CRE</span>
              <span className="text-gray-600">|</span>
              <span>World ID</span>
              <span className="text-gray-600">|</span>
              <span>Tenderly</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
