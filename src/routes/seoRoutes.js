import express from 'express';
import {
  getSitemapXml,
  getRobotsTxt,
  getGoogleMerchantFeed,
  lookupRedirect,
  getSeoRoutes,
  renderSeo,
} from '../controllers/seoController.js';

const router = express.Router();

router.get('/sitemap.xml', getSitemapXml);
router.get('/robots.txt', getRobotsTxt);
router.get('/google-merchant-feed.xml', getGoogleMerchantFeed);
router.get('/redirects/lookup', lookupRedirect);
router.get('/routes', getSeoRoutes);
router.get('/render', renderSeo);

export default router;
