/* 
* Helpers for various tasks 
*/

// Dependencies
const crypto = require('crypto');
const config = require('./config');
https = require('https');
const querystring = require('querystring');

// Container for all the helpers
const helpers = {};

// Create a SHA256 hash
helpers.hash = function(str) {
  if (typeof(str) == 'string' && str.length > 0) {
    const hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
    console.log(hash);
    return hash;
  } else {
    return false;
  }
};

// Parse a JSON string to an object in all cases, without throwing
helpers.parseJsonToObject = function(str) {
  try {
    return JSON.parse(str);
  } catch (error) {
    return {};
  }
}

// Create a string of random alphanumeric characters, of a given length
helpers.createRandomString = function(strLength) {
  strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;

  if (strLength) {
    // Define all possible characters that could go into a string
    const possibleCharacters = 'abcdefghijklmnopqrstuvwyz0123456789';

    // Start the final string
    let str = '';
    for (let i = 1; i <= strLength; i++) {
      // Get a random character from the possibleCharacters string
      const randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
      // Append this character to the final string
      str += randomCharacter;
    }
    // Return the final string
    return str;
    
  } else {
    return false;
  }
}

// Make Stripe purchase
helpers.makeStripePurchases = function () {

}

// Send an SMS message via Twilio
helpers.sendTwilioSms = function(phone, msg, callback) {
  // Validate parameters
  phone = typeof(phone) == 'string' && phone.trim().length === 9 ? phone.trim() : false;
  msg = typeof(msg) == 'string' && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg.trim() : false;

  if (phone && msg) {
    // Configure the request payload
    const payload = {
      'From': config.twilio.fromPhone,
      'To': '+48' + phone,
      'Body': msg,
    };

    // Stringify the payload
    const stringPayload = querystring.stringify(payload);

    // Configure the request detailed
    const requestDetails = {
      'protocol': 'https:',
      'hostname': 'api.twilio.com',
      'method': 'POST',
      'path': '/2010-04-01/Accounts/' + config.twilio.accountSid + '/Messages.json',
      'auth': config.twilio.accountSid + ':' + config.twilio.authToken,
      'headers': {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload),
      }
    };

    // Instantiate the request object
    const req = https.request(requestDetails, function (res) {
      // Grab the status of the sent request
      const status = res.statusCode;
      // Callback successfully if the request went through
      if (status === 200 || status === 201) {
        callback(false);
      } else {
        callback('Status code returned was ' + status);
      }
    });

    // Bind to the error event so it doesn't get thrown
    req.on('error', function(e) {
      callback(e);
    });

    // Add the payload
    req.write(stringPayload);

    // End the request
    req.end();
  } else {
    callback('Given parameters were missing or invalid');
  }
}

helpers.processOrder = function(receiverEmail, order, menu, callback) {
  const receiver = receiverEmail;
  const bill = calculateBill(order, menu);
  const orderPayload = createOrderPayload(bill, receiver);
  const orderDetails = createStripeRequest(orderPayload);

  purchase(orderDetails, orderPayload, function (err) {
    if (err) {
      callback(true);
    } else {
      callback(false);

      const sender = "Mailgun Sandbox <postmaster@sandboxe7c4bca396464619b563cb15d52013c6.mailgun.org>";
      sendReceipt(sender, receiver, "Pizza receipt", bill.desc, function (err) {
        if (err) {
            console.log('Error while sending receipt: ' + err);
        } else {
            console.log('Sent receipt.');
        }
      });
    }
  });
}

const sendReceipt = function (sender, receiver, subject, message, callback) {
  // Validate fields
  sender = helpers.stringValidation(sender) ? sender : false;
  receiver = helpers.emailValidation(receiver) ? receiver : false;
  subject = helpers.stringValidation(subject) ? subject : false;
  message = helpers.stringValidation(message) ? message : false;

  if (sender && receiver && subject && message) {

    // Create the request payload
    const payload = {
      from: sender,
      to: receiver,
      subject: subject,
      text: message
    };

    // Stringify the payload
    const stringPayload = querystring.stringify(payload);

    // Configure the request details
    const requestDetails = {
      'protocol': 'https:',
      'hostname': 'api.mailgun.net',
      'method': 'post',
      'path': `/v3/sandboxe7c4bca396464619b563cb15d52013c6.mailgun.org/messages`,
      'headers': {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload),
        'Authorization': 'Basic ' + Buffer.from('api:333f47513adf67a25b635d4a886a56b5-2a9a428a-4235d4f1', 'utf8').toString('base64')
      }
    };

    // Instantiate the request object
    const req = https.request(requestDetails, function (res) {

      res.on('data', function (data) {
        console.log("\nData from MailGun:\n" + data + "\n");
      });

      res.on('end', function () {
        const status = res.statusCode;
        if (status === 200 || status === 201) {
          callback(false);
        } else {
          console.log();
          callback('Status code returned was ' + status, JSON.stringify(res.headers));
        }
      });
    });

    req.on('error', function (error) {
      callback(error);
    });

    req.write(stringPayload);
    req.end();

  } else {
    callback(`Error: Missing required field. Input data:\nSender: ${sender}\nReceiver: ${receiver}\nSubject: ${subject}\nMessage: ${message}\n`);
  }
};

const purchase = function (orderDetails, orderPayload, callback) {
  if (orderDetails && orderPayload) {
    const req = https.request(orderDetails, function (res) {
      console.log(res.statusMessage);
      if (200 == res.statusCode || 201 == res.statusCode) {
        callback(false);
      } else {
        callback(true);
      }
    });
    req.on('error', function (error) {
      callback(500, error);
    });

    req.write(orderPayload);
    req.end();

  } else {
    callback('Missing required field or field invalid.');
  }
};

const createStripeRequest = function (content) {

  const requestDetails = {
    'protocol': 'https:',
    'hostname': 'api.stripe.com',
    'method': 'POST',
    'path': '/v1/charges',
    'headers':
      {
        'Authorization': `Bearer sk_test_51InQkTJU9NKOeoFbBnjjUNoYt1P6hSQEK8BhvWeyI7Jo0QoUfRIVTNqqbImpmtlJmsY3MMmx4dTgeX46YbBbzHjJ00PF994MQc`,
        'Content-Length': Buffer.byteLength(content),
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
  };
  return requestDetails;
}

const createOrderPayload = function (bill, email) {

  const payload = {
    'currency': 'usd',
    'source': 'tok_visa',
    'amount': bill.charge,
    'description': bill.desc,
    'receipt_email': email,
  };

  // Stringify the payload
  return querystring.stringify(payload);
};

const calculateBill = function (order, menu) {
  let sum = 0.0;
  let desc = "";
  console.log()
  for (let i = 0; i < order.length; ++i) {
    let pizza = menu.find(pizza => {
      return parseInt(pizza.id, 10) === parseInt(order[i].id, 10)
    });
    if (pizza == undefined) continue;

    let totalPrice = order[i].amount * parseInt(pizza.price, 10);
    sum += totalPrice;
  }

  desc += `TOTAL: ${sum.toFixed(2)}`;

  return {
    charge: (sum * 100).toFixed(0),
    desc: desc
  };
}

helpers.stringValidation = (name) => typeof (name) == 'string' && name.trim().length > 0;
helpers.emailValidation = (email) => typeof (email) == 'string' && (/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(email));
helpers.passwordValidation = (password) => typeof (password) == 'string' && password.trim().length > 7;
helpers.booleanValidation = (boolean) => typeof (boolean) == 'boolean' && boolean === true;

//Export the module
module.exports = helpers;