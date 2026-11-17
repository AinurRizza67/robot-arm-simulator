// Shared locations for the test tools, resolved from this file so the project folder can be moved.
// Set CHROME_PATH when Chrome is not installed in the default location.
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT, 'app');
const URL_APP = pathToFileURL(path.join(APP_DIR, 'index.html')).href;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

module.exports = { ROOT, APP_DIR, URL_APP, CHROME };
