/**
 * Loaded FIRST by every entry point (server.js, seed and migration scripts):
 *   import './src/config/env.js';   (or '../config/env.js' from src/*)
 *
 * 1. Loads .env before any other module reads process.env.
 * 2. Fixes "querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net":
 *    mongodb+srv:// URIs need a DNS SRV lookup, which some routers / ISPs / Windows network
 *    setups refuse. Node can use public DNS resolvers for its own lookups instead.
 *
 *    MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1   → always use these resolvers
 *    MONGO_DNS_SERVERS=system            → never change DNS (use the computer's own)
 *    (not set)                           → automatic: public DNS in development when MONGO_URI is
 *                                          mongodb+srv://, system DNS in production
 */
import dotenv from 'dotenv';
import dns from 'node:dns';

dotenv.config();

const DEFAULT_PUBLIC_DNS = ['8.8.8.8', '1.1.1.1', '8.8.4.4'];

const configured = String(process.env.MONGO_DNS_SERVERS || '').trim();
const isSrv = /^mongodb\+srv:\/\//i.test(process.env.MONGO_URI || '');
const isProd = process.env.NODE_ENV === 'production';

let servers = null;
if (configured && !/^(system|off|false|none)$/i.test(configured)) {
  servers = configured.split(',').map((s) => s.trim()).filter(Boolean);
} else if (!configured && isSrv && !isProd) {
  servers = DEFAULT_PUBLIC_DNS;
}

if (servers?.length) {
  try {
    dns.setServers(servers);
    // Prefer IPv4 answers – avoids slow/failed IPv6 routes on some home networks
    dns.setDefaultResultOrder?.('ipv4first');
    if (!isProd) console.log(`[DNS] Using ${servers.join(', ')} for MongoDB lookups`);
  } catch (err) {
    console.warn(`[DNS] Could not apply MONGO_DNS_SERVERS (${err.message}) – using system DNS`);
  }
}

export const dnsServersInUse = servers || dns.getServers();
