'use strict';

var _cloneNode, _createElement, _isCanvasBlank, domToImage, jsPDF, downloadPdf;

domToImage = require('dom-to-image');
jsPDF = require('jspdf');

_cloneNode = function(node, javascriptEnabled) {
  var child, clone;
  clone = node.nodeType === 3 ? document.createTextNode(node.nodeValue) : node.cloneNode(false);
  child = node.firstChild;
  while (child) {
    if (javascriptEnabled === true || child.nodeType !== 1 || child.nodeName !== 'SCRIPT') {
      clone.appendChild(_cloneNode(child, javascriptEnabled));
    }
    child = child.nextSibling;
  }
  if (node.nodeType === 1) {
    if (node.nodeName === 'CANVAS') {
      clone.width = node.width;
      clone.height = node.height;
      clone.getContext('2d').drawImage(node, 0, 0);
    } else if (node.nodeName === 'TEXTAREA' || node.nodeName === 'SELECT') {
      clone.value = node.value;
    }
    clone.addEventListener('load', (function() {
      clone.scrollTop = node.scrollTop;
      clone.scrollLeft = node.scrollLeft;
    }), true);
  }
  return clone;
};

_createElement = function(tagName, opt) {
  var el, i, key, scripts;
  el = document.createElement(tagName);
  if (opt.className) {
    el.className = opt.className;
  }
  if (opt.innerHTML) {
    el.innerHTML = opt.innerHTML;
    scripts = el.getElementsByTagName('script');
    i = scripts.length;
    while (i-- > 0) {
      scripts[i].parentNode.removeChild(scripts[i]);
      null;
    }
  }
  for (key in opt.style) {
    el.style[key] = opt.style[key];
  }
  return el;
};

_isCanvasBlank = function(canvas) {
  var blank, ctx;
  blank = document.createElement('canvas');
  blank.width = canvas.width;
  blank.height = canvas.height;
  ctx = blank.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, blank.width, blank.height);
  return canvas.toDataURL() === blank.toDataURL();
};

downloadPdf = function(dom, options, cb) {
  var a4Height, a4Width, overrideWidth, container, containerCSS,
    containerWidth, elements, excludeClassNames, filename, filterFn,
    innerRatio, overlay, overlayCSS, pageHeightPx, proxyUrl;

  ({filename, excludeClassNames = [], overrideWidth, proxyUrl} = options);

  overlayCSS = {
    position: 'fixed',
    zIndex: 1000,
    opacity: 0,
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.8)'
  };
  if (overrideWidth) {
    overlayCSS.width = `${overrideWidth}px`;
  }
  containerCSS = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 'auto',
    margin: 'auto',
    overflow: 'auto',
    backgroundColor: 'white'
  };
  overlay = _createElement('div', {
    style: overlayCSS
  });
  container = _createElement('div', {
    style: containerCSS
  });
  container.appendChild(_cloneNode(dom));
  overlay.appendChild(container);
  document.body.appendChild(overlay);
  a4Width = 595.28;
  a4Height = 841.89;
  innerRatio = a4Height / a4Width;
  containerWidth = overrideWidth || container.getBoundingClientRect().width;
  pageHeightPx = Math.floor(containerWidth * innerRatio);
  elements = container.querySelectorAll('*');
  Array.prototype.forEach.call(elements, function(el) {
    var clientRect, endPage, nPages, pad, rules, startPage;
    rules = {
      before: false,
      after: false,
      avoid: true
    };
    clientRect = el.getBoundingClientRect();
    if (rules.avoid && !rules.before) {
      startPage = Math.floor(clientRect.top / pageHeightPx);
      endPage = Math.floor(clientRect.bottom / pageHeightPx);
      nPages = Math.abs(clientRect.bottom - clientRect.top) / pageHeightPx;
      // Turn on rules.before if the el is broken and is at most one page long.
      if (endPage !== startPage && nPages <= 1) {
        rules.before = true;
      }
      // Before: Create a padding div to push the element to the next page.
      if (rules.before) {
        pad = _createElement('div', {
          style: {
            display: 'block',
            height: pageHeightPx - clientRect.top % pageHeightPx + 'px'
          }
        });
        return el.parentNode.insertBefore(pad, el);
      }
    }
  });

  // Remove unnecessary elements from result pdf
  filterFn = function(node) {
    var cName, j, len, ref, ref1;
    if (node.classList) {
      for (j = 0, len = excludeClassNames.length; j < len; j++) {
        cName = excludeClassNames[j];
        if (Array.prototype.indexOf.call(node.classList, cName) >= 0) {
          return false;
        }
      }
    }
    return (ref = (ref1 = node.tagName) != null ? ref1.toLowerCase() : void 0) !== 'button' && ref !== 'input' && ref !== 'select';
  };

  return domToImage.toCanvas(container, {
    filter: filterFn,
    proxy: proxyUrl
  }).then(function(canvas) {
    var h, imgData, nPages, page, pageCanvas, pageCtx, pageHeight, pdf, pxFullHeight, w;
    // Remove overlay
    document.body.removeChild(overlay);
    // Initialize the PDF.
    pdf = new jsPDF('p', 'pt', 'a4');
    // Calculate the number of pages.
    pxFullHeight = canvas.height;
    nPages = Math.ceil(pxFullHeight / pageHeightPx);
    // Define pageHeight separately so it can be trimmed on the final page.
    pageHeight = a4Height;
    pageCanvas = document.createElement('canvas');
    pageCtx = pageCanvas.getContext('2d');
    pageCanvas.width = canvas.width;
    pageCanvas.height = pageHeightPx;
    page = 0;
    while (page < nPages) {
      if (page === nPages - 1 && pxFullHeight % pageHeightPx !== 0) {
        pageCanvas.height = pxFullHeight % pageHeightPx;
        pageHeight = pageCanvas.height * a4Width / pageCanvas.width;
      }
      w = pageCanvas.width;
      h = pageCanvas.height;
      pageCtx.fillStyle = 'white';
      pageCtx.fillRect(0, 0, w, h);
      pageCtx.drawImage(canvas, 0, page * pageHeightPx, w, h, 0, 0, w, h);
      // Don't create blank pages
      if (_isCanvasBlank(pageCanvas)) {
        ++page;
        continue;
      }
      // Add the page to the PDF.
      if (page) {
        pdf.addPage();
      }
      imgData = pageCanvas.toDataURL('image/PNG');
      pdf.addImage(imgData, 'PNG', 0, 0, a4Width, pageHeight);
      ++page;
    }
    if (typeof cb === "function") {
      cb();
    }
    return pdf.save(filename);
  }).catch(function(error) {
    // Remove overlay
    document.body.removeChild(overlay);
    if (typeof cb === "function") {
      cb();
    }
    return console.error(error);
  });
};

module.exports = downloadPdf;
