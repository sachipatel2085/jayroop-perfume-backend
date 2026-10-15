/**
 * Print imposition – puts many single documents (invoices, labels …) on one sheet of paper.
 *
 *   composeSheets([pdfBuffer, …], { paper: 'A4', orientation: 'auto', perPage: 4, margin: 6, gap: 4, cutLines: true })
 *
 * Every page of every source PDF becomes one "slot"; slots fill the grid left→right, top→bottom.
 * Each slot is scaled to fit its cell (never stretched), centred, and optionally framed with dashed cut lines.
 * With orientation "auto" the layout (portrait / landscape, rows × columns) that prints the
 * documents largest is chosen automatically.
 */
import { PDFDocument, rgb, degrees } from 'pdf-lib';

const MM = 72 / 25.4;

// width × height in PDF points (portrait)
export const PAPER_SIZES = {
  A3: { label: 'A3 (297 × 420 mm)', size: [841.89, 1190.55] },
  A4: { label: 'A4 (210 × 297 mm)', size: [595.28, 841.89] },
  A5: { label: 'A5 (148 × 210 mm)', size: [419.53, 595.28] },
  A6: { label: 'A6 (105 × 148 mm)', size: [297.64, 419.53] },
  LETTER: { label: 'US Letter (8.5 × 11 in)', size: [612, 792] },
  LEGAL: { label: 'US Legal (8.5 × 14 in)', size: [612, 1008] },
  LABEL_4X6: { label: 'Label 4 × 6 in (thermal printer)', size: [288, 432] },
  LABEL_100X150: { label: 'Label 100 × 150 mm (thermal printer)', size: [283.46, 425.2] },
  LABEL_4X4: { label: 'Label 4 × 4 in (thermal printer)', size: [288, 288] },
};

export const PER_PAGE_OPTIONS = [1, 2, 3, 4, 6, 8, 9, 12, 16];

/** All grids (cols × rows) that hold exactly `n` cells with at most a few spare cells. */
const gridsFor = (n) => {
  const out = [];
  for (let cols = 1; cols <= n; cols += 1) {
    const rows = Math.ceil(n / cols);
    if (cols * rows - n < Math.min(cols, rows)) out.push({ cols, rows });
  }
  return out;
};

/**
 * Best layout for `perPage` documents of size srcW × srcH on the chosen paper.
 * Returns { pageW, pageH, cols, rows, scale, rotate } – rotate=true turns each document 90° when that
 * makes it bigger (e.g. 2 portrait A4 invoices side by side on a portrait A4 sheet).
 */
export const planLayout = ({ paper = 'A4', orientation = 'auto', perPage = 1, margin = 6, gap = 4, srcW = 595.28, srcH = 841.89, allowRotate = true }) => {
  const [pw, ph] = (PAPER_SIZES[paper] || PAPER_SIZES.A4).size;
  const orients = orientation === 'portrait' ? [[pw, ph]] : orientation === 'landscape' ? [[ph, pw]] : [[pw, ph], [ph, pw]];
  const m = Math.max(0, Number(margin) || 0) * MM;
  const g = Math.max(0, Number(gap) || 0) * MM;
  let best = null;
  for (const [pageW, pageH] of orients) {
    for (const { cols, rows } of gridsFor(perPage)) {
      const cellW = (pageW - 2 * m - (cols - 1) * g) / cols;
      const cellH = (pageH - 2 * m - (rows - 1) * g) / rows;
      if (cellW <= 0 || cellH <= 0) continue;
      for (const rotate of allowRotate ? [false, true] : [false]) {
        const w = rotate ? srcH : srcW;
        const h = rotate ? srcW : srcH;
        const scale = Math.min(cellW / w, cellH / h);
        // prefer the bigger print; on a tie prefer no rotation and the stated paper orientation
        const score = scale - (rotate ? 1e-4 : 0) - (pageW > pageH && orientation === 'auto' ? 1e-5 : 0);
        if (!best || score > best.score) best = { pageW, pageH, cols, rows, cellW, cellH, scale, rotate, margin: m, gap: g, score };
      }
    }
  }
  return best;
};

/**
 * @param {Buffer[]} sources PDFs to place (all pages of each are used)
 * @param {object} opts { paper, orientation, perPage, margin(mm), gap(mm), cutLines, title }
 */
export const composeSheets = async (sources, opts = {}) => {
  const perPage = PER_PAGE_OPTIONS.includes(Number(opts.perPage)) ? Number(opts.perPage) : 1;
  const out = await PDFDocument.create();
  out.setTitle(opts.title || 'Jayrup documents');
  out.setCreator('Jayrup');
  out.setProducer('Jayrup admin');

  // Collect every source page as an embeddable object
  const slots = [];
  for (const buf of sources) {
    const src = await PDFDocument.load(buf);
    const pages = await out.embedPages(src.getPages());
    slots.push(...pages);
  }
  if (!slots.length) return Buffer.from(await out.save());

  // Plan with the size of the first document (all invoices are A4, all labels 4×6)
  const ref = slots[0];
  const plan = planLayout({ ...opts, perPage, srcW: ref.width, srcH: ref.height, allowRotate: opts.allowRotate !== false });

  let page = null;
  slots.forEach((emb, i) => {
    const k = i % perPage;
    if (k === 0) page = out.addPage([plan.pageW, plan.pageH]);
    const col = k % plan.cols;
    const row = Math.floor(k / plan.cols);
    const cellX = plan.margin + col * (plan.cellW + plan.gap);
    const cellTop = plan.pageH - plan.margin - row * (plan.cellH + plan.gap);
    const cellY = cellTop - plan.cellH;

    const w = plan.rotate ? emb.height : emb.width;
    const h = plan.rotate ? emb.width : emb.height;
    const s = Math.min(plan.cellW / w, plan.cellH / h);
    const drawW = w * s;
    const drawH = h * s;
    const x = cellX + (plan.cellW - drawW) / 2;
    const y = cellY + (plan.cellH - drawH) / 2;

    if (plan.rotate) {
      // rotate 90° anticlockwise around the bottom-left corner, then shift into the cell
      page.drawPage(emb, { x: x + drawW, y, xScale: s, yScale: s, rotate: degrees(90) });
    } else {
      page.drawPage(emb, { x, y, xScale: s, yScale: s });
    }

    if (opts.cutLines && perPage > 1) {
      page.drawRectangle({
        x: cellX,
        y: cellY,
        width: plan.cellW,
        height: plan.cellH,
        borderColor: rgb(0.62, 0.62, 0.62),
        borderWidth: 0.4,
        borderDashArray: [3, 3],
      });
    }
  });

  return Buffer.from(await out.save());
};

/** Join finished PDFs one after another. */
export const mergePdfs = async (buffers, title = 'Jayrup documents') => {
  const out = await PDFDocument.create();
  out.setTitle(title);
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save());
};
