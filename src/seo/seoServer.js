import express from 'express';
import fs from 'fs';
import path from 'path';
import { buildSeoForPath, renderHeadHtml } from './headBuilder.js';
import { Setting } from '../models/Setting.js';

/**
 * Optional: serve the built React app (frontend/dist) from this Node server with
 * server-rendered SEO <head> for every route (+ 301s for old WordPress URLs and real 404 status codes).
 *
 * Enable by setting FRONTEND_DIST_PATH=/absolute/path/to/jayroop-perfume-frontend/dist
 * Requires the frontend index.html to contain the <!--seo:start--> … <!--seo:end--> markers (it does).
 */
const cache = new Map();
const TTL = 60 * 1000;

const noscriptBlock = (bodyHtml) =>
  bodyHtml ? `<noscript><div style="max-width:960px;margin:0 auto;padding:24px;font-family:sans-serif;color:#ddd">${bodyHtml}</div></noscript>` : '';

export const mountSeoSpa = (app, distPath) => {
  // app.html is the untouched SPA shell written by the frontend prerender step; fall back to index.html.
  const shellPath = path.join(distPath, 'app.html');
  const indexPath = fs.existsSync(shellPath) ? shellPath : path.join(distPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.warn(`[SEO Server] FRONTEND_DIST_PATH set but ${indexPath} not found – SPA serving disabled.`);
    return;
  }
  let template = fs.readFileSync(indexPath, 'utf8');
  fs.watchFile(indexPath, { interval: 5000 }, () => {
    try {
      template = fs.readFileSync(indexPath, 'utf8');
      cache.clear();
    } catch {
      /* ignore */
    }
  });

  app.use('/assets', express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '365d', index: false }));
  app.use(express.static(distPath, { index: false, maxAge: '1d' }));

  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    if (/\.[a-z0-9]{2,5}$/i.test(req.path)) return next(); // missing static file → 404 handler

    try {
      const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      if (req.path.length > 1 && req.path.endsWith('/')) {
        return res.redirect(301, `${req.path.replace(/\/+$/, '')}${qs}`);
      }

      const key = req.path.toLowerCase();
      let entry = cache.get(key);
      if (!entry || Date.now() - entry.at > TTL) {
        const seo = await buildSeoForPath(req.path);
        if (seo.redirect) {
          entry = { at: Date.now(), redirect: seo.redirect };
        } else {
          const settings = await Setting.getStoreSettings();
          const head = renderHeadHtml(seo, settings);
          const html = template
            .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, `<!--seo:start-->\n    ${head}\n    <!--seo:end-->`)
            .replace('<!--seo:body-->', noscriptBlock(seo.bodyHtml));
          entry = { at: Date.now(), status: seo.status === 404 ? 404 : 200, html };
        }
        cache.set(key, entry);
        if (cache.size > 2000) cache.delete(cache.keys().next().value);
      }

      if (entry.redirect) return res.redirect(301, entry.redirect + (entry.redirect.includes('?') ? '' : qs));
      res.status(entry.status).set('Cache-Control', 'public, max-age=300').type('html').send(entry.html);
    } catch (err) {
      console.error('[SEO Server]', err.message);
      res.status(200).type('html').send(template);
    }
  });

  console.log(`[SEO Server] Serving storefront from ${distPath} with server-side SEO tags`);
};
