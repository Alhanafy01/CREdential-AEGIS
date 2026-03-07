"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { connectWallet, formatAddress, getEthBalance } from "@/lib/web3";

export default function Navbar() {
  const pathname = usePathname();
  const [address, setAddress] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<string>("");
  const [connecting, setConnecting] = useState(false);

  // Fetch ETH balance when address changes
  useEffect(() => {
    if (address) {
      getEthBalance(address).then((balance) => {
        setEthBalance(parseFloat(balance).toFixed(2));
      }).catch(console.error);

      // Refresh balance every 10 seconds
      const interval = setInterval(() => {
        getEthBalance(address).then((balance) => {
          setEthBalance(parseFloat(balance).toFixed(2));
        }).catch(console.error);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [address]);

  useEffect(() => {
    // Check if already connected
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
        const accs = accounts as string[];
        if (accs.length > 0) {
          setAddress(accs[0]);
        }
      });

      // Listen for account changes
      const handleAccountsChanged = (accounts: unknown) => {
        const accs = accounts as string[];
        setAddress(accs[0] || "");
      };
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      return () => {
        window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      };
    }
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const addr = await connectWallet();
      setAddress(addr);
    } catch (e) {
      console.error(e);
    } finally {
      setConnecting(false);
    }
  };

  const navItems = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/my-agents", label: "My Agents" },
    { href: "/strategy", label: "Strategy Jobs" },
    { href: "/insurance", label: "Insurance" },
    { href: "/rwa", label: "RWA Guardian" },
    { href: "/register", label: "Register Agent" },
  ];

  return (
    <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">A</span>
            </div>
            <span className="text-xl font-bold text-white">AEGIS <span className="text-blue-400">(CRE</span><span className="text-gray-400">dential)</span></span>
            <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">CRE</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:text-white hover:bg-gray-800"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center space-x-4">
            {address ? (
              <div className="flex items-center space-x-3 bg-gray-800 rounded-lg px-4 py-2">
                {ethBalance && (
                  <span className="text-sm font-medium text-green-400">{ethBalance} ETH</span>
                )}
                <div className="w-px h-4 bg-gray-600"></div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-300">{formatAddress(address)}</span>
                </div>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
