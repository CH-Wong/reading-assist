/**
 * Content script entry point.
 * Injects a Shadow DOM container into the page and renders the React app into it.
 * Shadow DOM isolates our styles from the host page's CSS.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import ContentApp from './ContentApp';
import contentCss from './content.css?raw';

const CONTAINER_ID = 'reading-assist-extension-root';

// Avoid double-injection
if (!document.getElementById(CONTAINER_ID)) {
  // Create host container in the page
  const host = document.createElement('div');
  host.id = CONTAINER_ID;
  document.body.appendChild(host);

  // Create Shadow DOM for style isolation
  const shadowRoot = host.attachShadow({ mode: 'open' });

  // Inject CSS into the shadow
  const styleEl = document.createElement('style');
  styleEl.textContent = contentCss;
  shadowRoot.appendChild(styleEl);

  // Create the React mount point inside the shadow
  const mountPoint = document.createElement('div');
  mountPoint.id = 'ra-mount';
  shadowRoot.appendChild(mountPoint);

  // Render React into the Shadow DOM
  const root = createRoot(mountPoint);
  root.render(React.createElement(ContentApp));
}
