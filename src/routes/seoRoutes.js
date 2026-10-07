import express from 'express';
import {
  getSitemapXml,
  getRobotsTxt,
  getGoogleMerchantFeed,
  lookupRedirect,
} from '../controllers/seoController.js';

const router = express.Router();

router.get('/sitemap.xml', getSitemapXml);
router.get('/robots.txt', getRobotsTxt);
router.get('/google-merchant-feed.xml', getGoogleMerchantFeed);
router.get('/redirects/lookup', lookupRedirect);

export default router;
