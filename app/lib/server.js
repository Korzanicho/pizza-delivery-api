/**
 * Server related tasks
 */
const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const fs = require('fs');
const handlers = require('./handlers');
const helpers = require('./helpers');
const path = require('path');

// Instantiate the server module object
const server = {};

// Instantiate the HTTP server
server.httpServer = http.createServer(function (req, res) {
  server.undefinedServer(res, req);
});

// Instantiate the HTTPS server
server.httpsServerOptions = {
  'key': fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
  'cert': fs.readFileSync(path.join(__dirname, '/../https/cert.pem')),
};
server.httpsServer = https.createServer(server.httpsServerOptions, function (req, res) {
  server.undefinedServer(res, req);
});

// All the server login for both the http and https server
server.undefinedServer = function (res, req) {

  // Get the URL and parse it
  const parsedUrl = url.parse(req.url, true);

  // Get the path
  const path = parsedUrl.pathname;
  const trimmedPath = path.replace(/^\/+|\/+$/g, '');

  // Get the query string as an object
  const queryStringObject = parsedUrl.query;

  // Get the HTTP Method
  const method = req.method.toLowerCase();

  // Get the headers as an object
  const headers = req.headers;

  // Get the payload, if any
  const decoder = new StringDecoder('utf-8');
  let buffer = '';
  req.on('data', function (data) {
    buffer += decoder.write(data);
  })
  req.on('end', function () {
    buffer += decoder.end();

    // Choose the handler this request  should go to. If one is not found, use the notFound handler.
    const chosenHandler = typeof (server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

    // Construct the data object to send to the handler
    const data = {
      'trimmedPath': trimmedPath,
      'queryStringObject': queryStringObject,
      'method': method,
      'headers': headers,
      'payload': helpers.parseJsonToObject(buffer),
    };

    // Route the request to the handler specified in the router
    chosenHandler(data, function (statusCode, payload, contentType) {

      // Determine the type of response (fallback to JSON)
      contentType = typeof(contentType) == 'string' ? contentType : 'json';

      // Use the status code called back by handler, or default to 200
      statusCode = typeof (statusCode) == 'number' ? statusCode : 200;
      
      // Return the response parts that are content-specific
      let payloadString = '';
      
      if (contentType == 'json') {
        res.setHeader('Content-Type', 'application/json');
        // Use the payload called back by the handler, or default to an empty object
        payload = typeof (payload) == 'object' ? payload : {};
        payloadString = JSON.stringify(payload);
      }
      if (contentType == 'html') {
        res.setHeader('Content-Type', 'text/html');
        payloadString = typeof(payload) == 'string' ? payload : '';
      }

      // Return the respones-parts that are common to all content-types
      res.writeHead(statusCode);
      res.end(payloadString);

      // If the response is 200, print green otherwise print red
      if (statusCode === 200) {
        console.log('\x1b[32m%s\x1b[0m', method.toUpperCase() + ' /'+trimmedPath+' '+statusCode);
      } else {
        console.log('\x1b[31m%s\x1b[0m', method.toUpperCase() + ' /'+trimmedPath+' '+statusCode);
      }
    });

  });
}

// Define a request router
server.router = {
  '': handlers.index,
  'account/create': handlers.accountCreate,
  'account/edit': handlers.accountEdit,
  'account/deleted': handlers.accountDeleted,
  'session/create': handlers.sessionCreate,
  'session/deleted': handlers.sessionDeleted,
  'menu': handlers.menu,

  'ping': handlers.ping,
  'api/users': handlers.users,
  'api/tokens': handlers.tokens,
  'api/menu': handlers.menu,
  'api/checks': handlers.checks,
  'api/shoppingCarts': handlers.shoppingCarts,
  'api/purchases': handlers.purchases
}

// Init script
server.init = function () {
  // Start the HTTP server
  server.httpServer.listen(config.httpPort, function () {
    console.log('\x1b[36m%s\x1b[0m', 'The server is listening on port ' + config.httpPort + ' in ' + config.envName);

  });
  // Start the HTTPS server
  server.httpsServer.listen(config.httpsPort, function () {
    console.log('\x1b[35m%s\x1b[0m', 'The server is listening on port ' + config.httpsPort + ' in ' + config.envName);
  });
};

// Export the module
module.exports = server;