/*************************************************************************
 * Copyright (c) 2019, The Tor Project, Inc.
 * See LICENSE for licensing information.
 *
 * vim: set sw=2 sts=2 ts=8 et syntax=javascript:
 *
 * about:tor content script
 *************************************************************************/

/*
 * The following about:tor IPC messages are exchanged by this code and
 * the code in torbutton.js:
 *   AboutTor:Loaded          page loaded            content -> chrome
 *   AboutTor:ChromeData      privileged data        chrome -> content
 */

var {classes: Cc, interfaces: Ci, utils: Cu} = Components;


Cu.import("resource://gre/modules/Services.jsm");
let { bindPrefAndInit, show_torbrowser_manual } = Cu.import("resource://torbutton/modules/utils.js", {});


var AboutTorListener = {
  kAboutTorLoadedMessage: "AboutTor:Loaded",
  kAboutTorChromeDataMessage: "AboutTor:ChromeData",
  kAboutTorHideDonationBanner: "AboutTor:HideDonationBanner",

  get isAboutTor() {
    return content.document.documentURI.toLowerCase() == "about:tor";
  },

  init: function(aChromeGlobal) {
    aChromeGlobal.addEventListener("AboutTorLoad", this, false, true);
  },

  handleEvent: function(aEvent) {
    if (!this.isAboutTor)
      return;

    switch (aEvent.type) {
      case "AboutTorLoad":
        this.onPageLoad();
        break;
      case "pagehide":
        this.onPageHide();
        break;
    }
  },

  receiveMessage: function(aMessage) {
    if (!this.isAboutTor)
      return;

    switch (aMessage.name) {
      case this.kAboutTorChromeDataMessage:
        this.onChromeDataUpdate(aMessage.data);
        break;
    }
  },

  setupBannerClosing: function () {
    let that = this;
    let closer = content.document.getElementById("donation-banner-closer");
    closer.addEventListener("click", function () {
      sendAsyncMessage(that.kAboutTorHideDonationBanner);
    });

    bindPrefAndInit("extensions.torbutton.donation_banner_countdown3",
                    countdown => {
                      if (content.document && content.document.body) {
                        content.document.body.setAttribute(
                          "show-donation-banner", countdown > 0);
                      }
                    });
  },

  onPageLoad: function() {
    // Arrange to update localized text and links.
    bindPrefAndInit("intl.locale.requested", aNewVal => {
      if (aNewVal !== null) {
        this.onLocaleChange(aNewVal);
      }
    });

    this.setupBannerClosing();

    // Add message and event listeners.
    addMessageListener(this.kAboutTorChromeDataMessage, this);
    addEventListener("pagehide", this, false);
    addEventListener("resize", this, false);

    sendAsyncMessage(this.kAboutTorLoadedMessage);
  },

  onPageHide: function() {
    removeEventListener("resize", this, false);
    removeEventListener("pagehide", this, false);
    removeMessageListener(this.kAboutTorChromeDataMessage, this);
  },

  onChromeDataUpdate: function(aData) {
    let body = content.document.body;

    // Update status: tor on/off, Tor Browser manual shown.
    if (aData.torOn)
      body.setAttribute("toron", "yes");
    else
      body.removeAttribute("toron");

    if (show_torbrowser_manual())
      body.setAttribute("showmanual", "yes");
    else
      body.removeAttribute("showmanual");

    if (aData.updateChannel)
      body.setAttribute("updatechannel", aData.updateChannel);
    else
      body.removeAttribute("updatechannel");

    if (aData.hasBeenUpdated) {
      body.setAttribute("hasbeenupdated", "yes");
      content.document.getElementById("update-infolink").setAttribute("href",
                                                      aData.updateMoreInfoURL);
    }

    if (aData.mobile)
      body.setAttribute("mobile", "yes");

    // Setting body.initialized="yes" displays the body.
    body.setAttribute("initialized", "yes");
  },

  onLocaleChange: function(aLocale) {
    // Set Tor Browser manual link.
    content.document.getElementById("manualLink").href =
                            "https://tb-manual.torproject.org/" + aLocale;

    // Display the Tor Browser product name and version.
    try {
      const kBrandBundle = "chrome://branding/locale/brand.properties";
      let brandBundle = Cc["@mozilla.org/intl/stringbundle;1"]
                          .getService(Ci.nsIStringBundleService)
                          .createBundle(kBrandBundle);
      let productName = brandBundle.GetStringFromName("brandFullName");
      let tbbVersion = Services.prefs.getCharPref("torbrowser.version");
      let elem = content.document.getElementById("torbrowser-version");

      while (elem.firstChild)
        elem.removeChild(elem.firstChild);
      elem.appendChild(content.document.createTextNode(productName + ' '
                       + tbbVersion));
    } catch (e) {}
  }
};

AboutTorListener.init(this);
