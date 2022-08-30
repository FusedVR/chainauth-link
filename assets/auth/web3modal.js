"use strict";

/**
 * Example JavaScript code that interacts with the page and Web3 wallets
 */

const submitID = "#auth-button";
const codeID = "#code-input";

const host = "https://api-crypto.fusedvr.com"

// Web3modal instance
let web3Modal;

/**
 * Setup the orchestra
 */
async function init() {

  await (new Promise(waitForWeb3)); 

  const Web3Modal = window.Web3Modal.default;
  const WalletConnectProvider = window.WalletConnectProvider.default;
  const evmChains = window.evmChains;

  console.log("WalletConnectProvider is", WalletConnectProvider);
  console.log("window.web3 is", window.web3, "window.ethereum is", window.ethereum);

  // Check that the web page is run in a secure context,
  // as otherwise MetaMask won't be available
  if(location.protocol !== 'https:') {
    // https://ethereum.stackexchange.com/a/62217/620
    document.querySelector(submitID).setAttribute("disabled", "disabled");
    return;
  }

  // Tell Web3modal what providers we have available.
  // Built-in web browser provider (only one can exist as a time)
  // like MetaMask, Brave or Opera is added automatically by Web3modal
  const providerOptions = {
    walletconnect: {
      package: WalletConnectProvider,
      options: {
        // Mikko's test key - don't copy as your mileage may vary
        infuraId: "f343e4a6365543d28f128ea6dc30c13e",
      }
    }
  };

  web3Modal = new Web3Modal({
    cacheProvider: false, // optional
    providerOptions, // required
    disableInjectedProvider: false, // optional. For MetaMask / Brave / Opera.
  });

  console.log("Web3Modal instance is", web3Modal);

  if (getUrlParameter('code')){ //if code is in getter, than start login already
    login(getUrlParameter('code'));
  }

  document.querySelector(submitID).addEventListener("click", function(){
    let code = document.querySelector(codeID).value;
    login(code);
  });
}

//login function
async function login(code) {
  var web3 = await handleWeb3Modal();
  let provider = new ethers.providers.Web3Provider(web3);
  let signer = provider.getSigner()

  var myAddress = await signer.getAddress();
  if (myAddress) {
    apiCall("auth/getNonce" , { address: myAddress },
      async function(data) {
        let rawMessage = data.nonce;
        let signature;
        if (web3.wc) { // a bug with wallet connect is preventing us from using ethers.s
            signature = await provider.send(
                'personal_sign',
                [ ethers.utils.hexlify(ethers.utils.toUtf8Bytes(rawMessage)), myAddress.toLowerCase() ]
            );
        }
        else { 
            signature = await signer.signMessage(rawMessage); //other wallets work with ethers.js
        }

        if (signature) {
          apiCall( "fused/authorizeWallet" , 
            {
              code: code,
              address: myAddress,
              signedNonce: signature
            },
            function(data) { 
              if (data.token){ //got token, so successful authorization
                showAlert("Login Success!", "Please Return Back to your Game.");
              }
            },
            function(request, status, error) { showAlert("Login Failed!", request.responseText); }
          );
        }
      },
      function() { showAlert("Login Failed!", "Message Not Received"); }
    );
  }
}

/**
 * Connect wallet button pressed.
 */
async function handleWeb3Modal() {
  console.log("Opening a dialog", web3Modal);
  let instance;
  try {
    instance = await web3Modal.connect();
  } catch(e) {
    console.log("Could not get a wallet connection", e);
    return;
  }

  //let provider = new ethers.providers.Web3Provider(instance);
  //return provider.getSigner();
  return instance;
}

/**
 * Disconnect wallet button pressed.
 */
async function onDisconnect() {

  console.log("Killing the wallet connection", provider);

  // TODO: Which providers have close method?
  if(provider.close) {
    await provider.close();

    // If the cached provider is not cleared,
    // WalletConnect will default to the existing session
    // and does not allow to re-scan the QR code with a new wallet.
    // Depending on your use case you may want or want not his behavir.
    await web3Modal.clearCachedProvider();
    provider = null;
  }

  // Set the UI back to the initial state
  //document.querySelector("#prepare").style.display = "block";
  //document.querySelector("#connected").style.display = "none";
}


/**
 * Main entry point.
 */
window.addEventListener('load', async () => {

  loadScript("https://unpkg.com/web3@1.2.11/dist/web3.min.js");
  loadScript("https://unpkg.com/evm-chains@0.2.0/dist/umd/index.min.js");
  loadScript("https://unpkg.com/@walletconnect/web3-provider@1.2.1/dist/umd/index.min.js");
  loadScript("https://unpkg.com/ethers@4.0.16/dist/ethers.min.js");
  loadScript("https://unpkg.com/web3modal@1.9.9/dist/index.js");

  init();
  //document.querySelector("#btn-disconnect").addEventListener("click", onDisconnect);
});

function apiCall(apiName, payload, successFn, errFn, token=false) {
  var apiPayload = { type: "POST", url: host + "/api/" + apiName, data: payload, success: successFn, error: errFn};
  if (token) {
    apiPayload["headers"] = { 'Authorization': 'Bearer ' + token };
  }

  $.ajax(apiPayload);
}

function showAlert(title, message) {
    let modal = $('#alert');
    modal.find('.modal-title').text(title);
    modal.find('.modal-body').text(message);
    modal.modal({
      fadeDuration: 250,
      showClose : false
    });
}

function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
        }
    }
    return false;
}

function waitForWeb3(resolve, reject) {
    if (window.Web3Modal && window.WalletConnectProvider && window.evmChains)
        resolve(window.Web3Modal.default);
    else
        setTimeout(waitForWeb3.bind(this, resolve, reject), 30);
}

function loadScript(url, callback)
{
    // Adding the script tag to the head as suggested before
    var head = document.head;
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;

    // Then bind the event to the callback function.
    // There are several events for cross browser compatibility.
    script.onreadystatechange = callback;
    script.onload = callback;

    // Fire the loading
    head.appendChild(script);
}