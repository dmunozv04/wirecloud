/*
 *     Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
 *
 *     This file is part of Wirecloud Platform.
 *
 *     Wirecloud Platform is free software: you can redistribute it and/or
 *     modify it under the terms of the GNU Affero General Public License as
 *     published by the Free Software Foundation, either version 3 of the
 *     License, or (at your option) any later version.
 *
 *     Wirecloud is distributed in the hope that it will be useful, but WITHOUT
 *     ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 *     FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 *     License for more details.
 *
 *     You should have received a copy of the GNU Affero General Public License
 *     along with Wirecloud Platform.  If not, see
 *     <http://www.gnu.org/licenses/>.
 *
 */

(function () {

    'use strict';

    class Widget extends HTMLElement {
        constructor() {
            super();
            this.hasShadowDOM = false;
            this.loadedURL = "";
        }

        connectedCallback() {
            this.style.width = '100%';
            this.style.height = '100%';
            this.style.display = 'block';

            if (!this.hasShadowDOM) {
                this.attachShadow({mode: 'open'});
                this.hasShadowDOM = true;
            }
        }

        disconnectedCallback() {
            this._unload();
        }

        load(codeurl) {
            this._unload();

            this.codeurl = codeurl;

            // Load the widget code
            const xmlhttp = new XMLHttpRequest();
            xmlhttp.onreadystatechange = () => {
                if (xmlhttp.readyState === XMLHttpRequest.DONE) {
                    if (xmlhttp.status === 200) {
                        if (xmlhttp.getResponseHeader('Content-Type').indexOf('text/html') === -1) {
                            throw new Error('Error loading widget: non-HTML content type');
                        }

                        this.loadedURL = codeurl;

                        // Load the widget code into the shadow DOM
                        this._handleHTMLResponse(xmlhttp.responseText);

                        // Dispatch onload event
                        this.dispatchEvent(new Event('load'));
                    } else {
                        // Maybe show an error screen in the shadow DOM?
                        throw new Error('Error loading widget (HTTP ' + xmlhttp.status + '): ' + xmlhttp.responseText);
                    }
                }
            };

            xmlhttp.open('GET', codeurl, true);
            xmlhttp.send();
        }

        _unload() {
            if (this.observer != null) {
                this.observer.disconnect();
                this.observer = null;
            }

            // Clean the shadow DOM
            this.shadowRoot.innerHTML = '';

            // Dispatch onunload event
            this.dispatchEvent(new Event('unload'));
        }

        _handleHTMLResponse(text) {
            const dom = new DOMParser().parseFromString(text, 'text/html');
            const headElements = [];

            // Add all stylesheets to the headElements array (which will be in the shadow root), as the DOMParser
            // always puts them in the head
            Array.from(dom.head.querySelectorAll('link, script, style')).forEach((node) => {
                if (node.tagName === 'LINK' || node.tagName === 'STYLE' || node.tagName === 'SCRIPT') {
                    headElements.push(node);
                }
            });

            // List of attributes that can contain relative URLs
            const ATTR_LIST = ["href", "src", "background", "action", "data", "formaction", "icon", "poster", "usemap"];

            // Walk the DOM tree and replace all relative URLs with absolute ones
            const walk = (node, walkChildren = true) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    ATTR_LIST.forEach((attr) => {
                        if (node.hasAttribute(attr)) {
                            const url = new URL(node.getAttribute(attr), this.codeurl);
                            node.setAttribute(attr, url.href);
                        }
                    });

                    // Additionally, handle srcset attribute
                    if (node.hasAttribute('srcset')) {
                        const srcset = node.getAttribute('srcset').split(',').map((src) => {
                            const [url, size] = src.trim().split(' ');
                            const absolute_url = new URL(url, this.codeurl);
                            return `${absolute_url.href} ${size}`;
                        }).join(', ');
                        node.setAttribute('srcset', srcset);
                    }
                }

                if (walkChildren) {
                    node.childNodes.forEach(walk);
                }
            };

            walk(dom.body);

            // Add the widget code to the shadow DOM
            headElements.forEach((node) => {
                walk(node);
                this.shadowRoot.appendChild(node);
            });
            this.shadowRoot.appendChild(dom.body);

            // We use an observer so that, if any code causes changes in
            // the shadow DOM, we can re-walk the DOM and replace relative
            // URLs with absolute ones so that everything is relative to
            // the widget code URL
            this.observer = new MutationObserver((mutations) => {
                // Disconnect the observer so that we don't get notified of
                // changes we make ourselves
                this.observer.disconnect();

                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            walk(node);
                        });
                    } else if (mutation.type === 'attributes') {
                        walk(mutation.target, false);
                    } else if (mutation.type === 'characterData') {
                        walk(mutation.target.parentNode, false);
                    }
                });

                // Reconnect the observer
                this.observer.observe(this.shadowRoot, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    characterData: true
                });
            });

            this.observer.observe(this.shadowRoot, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true
            });
        }
    };

    window.customElements.define('wirecloud-widget', Widget);

})();