// Updated to match ES6 standards

const alloyData = document.querySelector('#_alloy_data');
const url = new URL(atob(alloyData.getAttribute('url')));
const prefix = alloyData.getAttribute('prefix');

const rewriteURL = (str) => {
  let proxiedURL = '';

  if (str.startsWith(`${window.location.origin}/`) && !str.startsWith(`${window.location.origin}${prefix}`)) {
    str = `/${str.split('/').splice(3).join('/')}`;
  }

  if (str.startsWith('//')) {
    str = `http:${str}`;
  } else if (str.startsWith('/') && !str.startsWith(prefix)) {
    str = `${url.origin}${str}`;
  }

  if (str.startsWith('https://') || str.startsWith('http://')) {
    const path = `/${str.split('/').splice(3).join('/')}`;
    const origin = btoa(str.split('/').splice(0, 3).join('/'));
    proxiedURL = `${prefix}${origin}${path}`;
  } else {
    proxiedURL = str;
  }

  return proxiedURL;
};

const fetchRewrite = window.fetch;
window.fetch = async function(url, options) {
  try {
    url = rewriteURL(url);
    const response = await fetchRewrite.call(this, url, options);

    // Handle cookies
    const responseUrl = new URL(response.url);
    if (responseUrl.origin === url.origin) {
      const cookies = response.headers.get('Set-Cookie');
      if (cookies) {
        document.cookie = cookies;
      }
    }

    // Handle caching
    const cacheControl = response.headers.get('Cache-Control');
    if (cacheControl && cacheControl.includes('no-store')) {
      // Disable caching for the response
      response.headers.delete('Cache-Control');
    }

    return response;
  } catch (error) {
    // Handle fetch errors
    console.error('Fetch error:', error);
    throw error;
  }
};

const xmlRewrite = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
  url = rewriteURL(url);
  return xmlRewrite.apply(this, arguments);
};

const createElementRewrite = document.createElement;
document.createElement = function(tag) {
  const element = createElementRewrite.call(document, tag);

  if (tag.toLowerCase() === 'script' || tag.toLowerCase() === 'iframe' || tag.toLowerCase() === 'embed') {
    Object.defineProperty(element.__proto__, 'src', {
      set: function(value) {
        value = rewriteURL(value);
        element.setAttribute('src', value);
      },
    });
  } else if (tag.toLowerCase() === 'link') {
    Object.defineProperty(element.__proto__, 'href', {
      set: function(value) {
        value = rewriteURL(value);
        element.setAttribute('href', value);
      },
    });
  } else if (tag.toLowerCase() === 'form') {
    Object.defineProperty(element.__proto__, 'action', {
      set: function(value) {
        value = rewriteURL(value);
        element.setAttribute('action', value);
      },
    });
  }

  return element;
};

const setAttributeRewrite = window.Element.prototype.setAttribute;
window.Element.prototype.setAttribute = function(attribute, href) {
  if (attribute === 'src' || attribute === 'href' || attribute === 'action') {
    href = rewriteURL(href);
  }

  return setAttributeRewrite.apply(this, arguments);
};

WebSocket = new Proxy(WebSocket, {
  construct(target, argsArray) {
    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    argsArray[0] = `${protocol}${location.origin.split('/').splice(2).join('/')}${prefix}ws/${btoa(argsArray[0])}`;
    return new target(...argsArray);
  },
});

history.pushState = new Proxy(history.pushState, {
  apply(target, thisArg, argsArray) {
    argsArray[2] = rewriteURL(argsArray[2]);
    return target.apply(thisArg, argsArray);
  },
});

const previousState = window.history.state;
setInterval(() => {
  if (!window.location.pathname.startsWith(`${prefix}${btoa(url.origin)}/`)) {
    history.replaceState('', '', `${prefix}${btoa(url.origin)}/${window.location.href.split('/').splice(3).join('/')}`);
  }
}, 0.1);