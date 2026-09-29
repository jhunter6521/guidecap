// Puppeteer is only for local tests and store screenshots.
// Skip its ~150 MB Chrome download on Cloudflare builds.
module.exports = { skipDownload: !!(process.env.CI || process.env.WORKERS_CI) };
