const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
for (const name of fs.readdirSync(path.join(root, 'js'))) {
  if (name.endsWith('.js')) new vm.Script(fs.readFileSync(path.join(root, 'js', name), 'utf8'), { filename: name });
}
for (const file of ['service-worker.js', 'OneSignalSDKWorker.js']) {
  new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
}
for (const file of ['index.html', 'dashboard.html']) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8'));
  const seen = new Set();
  for (const element of dom.window.document.querySelectorAll('[id]')) {
    if (seen.has(element.id)) throw new Error(`Duplicate ID: ${element.id} in ${file}`);
    seen.add(element.id);
  }
  for (const element of dom.window.document.querySelectorAll('script[src], link[rel="stylesheet"]')) {
    const url = element.getAttribute('src') || element.getAttribute('href');
    if (!/^https?:/.test(url) && !fs.existsSync(path.join(root, url.split('?')[0]))) {
      throw new Error(`Missing asset: ${url}`);
    }
  }
  for (const script of dom.window.document.querySelectorAll('script:not([src])')) new vm.Script(script.textContent);
  for (const element of dom.window.document.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      if (attribute.name.startsWith('on')) new vm.Script(`(function(event){${attribute.value}})`);
    }
  }
  dom.window.close();
}
console.log('All JavaScript, inline handlers, HTML IDs and local assets passed.');
