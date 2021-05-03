/*
* Request handlers
*/

// Dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');

// Define the handlers
const handlers = {};

// Users
handlers.users = function(data, callback) {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for the users sub methods
handlers._users = {};

// Users - post
// Required data: name, address, email, password, tosAgreement
// Optional data: none
handlers._users.post = function(data, callback) {
  // Check that all required fields are filled out
  const name = helpers.stringValidation(data.payload.name) ? data.payload.name.trim() : false;
  const address = helpers.stringValidation(data.payload.address) ? data.payload.address.trim() : false;
  const email = helpers.emailValidation(data.payload.email) ? data.payload.email.trim() : false;
  const password = helpers.passwordValidation(data.payload.password) ? data.payload.password.trim() : false;
  const tosAgreement = helpers.booleanValidation(data.payload.tosAgreement);

  if (name && address && email && password && tosAgreement) {
    // Make sure that the user doesn't exist
    _data.read('users', email, function(err) {
      if (err) {
        // Hash the password
        const hashedPassword = helpers.hash(password);

        if (hashedPassword) {

          // Create the user object
          const userObject = {
            name,
            address,
            email,
            hashedPassword,
            tosAgreement: true
          };

          // Store the user
          _data.create('users', email, userObject, function(err) {
            if (!err) {
              _data.create('shoppingCarts', email, [], function(err) {
                if (!err) {
                  callback(200);
                } else {
                  callback(500, {'Error': 'Could not create the shopping cart'})
                }
              });
            } else {
              console.log(err);
              callback(500, {'Error': 'Could not create the new user'});
            }
          });
        } else {
          callback(500, {'Error': 'Could not hash the user\'s password'});
        }
      } else {
        // User (email) already exist
        callback(400, {'Error:': 'A user with that phone number already exist'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required fields'});
  }
}

// Users - get
// Required data: email
// Optional data: none
handlers._users.get = function(data, callback) {

  // Check that the phone number is valid
  const email = helpers.emailValidation(data.queryStringObject.email) ? data.queryStringObject.email.trim() : false;

  if (email) {
    // get the token from the headers
    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

    // Verify that the given token is valid for the phone number
    handlers._tokens.verifyToken(token, email, function(tokenIsValid) {
      if (tokenIsValid) {
        _data.read('users', email, function(err, data) {
          if (!err && data) {
            // Remove the hashed password from the user object before running it to the requester
            delete data.hashedPassword;
            callback(200, data);
          } else {
            callback(404);
          }
        });
      } else {
        callback(403, {'Error': 'Missing required token in header, or token is invalid'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
}

// Users - put
// Required data : email
// Optional data: name, address, password (at least one must be specified)
handlers._users.put = function(data, callback) {
  // Check for the required field
  const email = helpers.emailValidation(data.payload.email) ? data.payload.email.trim() : false;

  // Check for the optional fields
  const name = helpers.stringValidation(data.payload.name) ? data.payload.name.trim() : false;
  const address = helpers.stringValidation(data.payload.address) ? data.payload.address.trim() : false;
  const password = helpers.passwordValidation(data.payload.password) ? data.payload.password.trim() : false;

  // Error if the email is invalid
  if (email) {
    if (name || address || password) {

      // get the token from the headers
      const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

      // Verify that the given token is valid for the phone number
      handlers._tokens.verifyToken(token, email, function(tokenIsValid) {
        if (tokenIsValid) {
          // Lookup the user
          _data.read('users', email, function(err, userData) {
            if (!err && userData) {
              // Update the fields necessary
              if (name) {
                userData.name = name;
              }
              if (address) {
                userData.address = address;
              }
              if (password) {
                userData.hashedPassword = helpers.hash(password);
              }
    
              // Store the new updates
              _data.update('users', email, userData, function(err) {
                if (!err) {
                  callback(200);
                } else {
                  console.log(err);
                  callback(500, {'Error': 'Could not update the user'});
                }
              })
            } else {
              callback(400, {'Error': 'The specified user does not exist'});
            }
          });
        } else {
          callback(403, {'Error': 'Missing required token in header, or token is invalid'});
        }
      });

    } else {
      callback(400, {'Error': 'Missing fields to update'});
    }
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
}

// Users - delete
// Required field: email
handlers._users.delete = function(data, callback) {
  // Check that the email is valid
  const email = helpers.emailValidation(data.queryStringObject.email) ? data.queryStringObject.email.trim() : false;
  if (email) {
    // get the token from the headers
    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function(tokenIsValid) {
      if (tokenIsValid) {
        // Lookup the user
        _data.read('users', email, function(err, userData) {
          if (!err && userData) {
            _data.delete('users', email, function(err) {
              if (!err) {
                //Delete user shopping cart
                _data.delete('shoppingCarts', email, function(err) {
                  if (!err) {
                    callback(200);
                  } else {
                    callback(500, {'Error': 'Could not delete the user shopping cart'});
                  }
                });
              } else {
                callback(500, {'Error': 'Could not delete the specified user'});
              }
            });
          } else {
            callback(400, {'Error': 'Could not find the specified user'});
          }
        });
      } else {
        callback(403, {'Error': 'Missing required token in header, or token is invalid'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
}

// Tokens
handlers.tokens = function(data, callback) {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all the tokens methods
handlers._tokens = {};

// Tokens - post
// Required data: email, password
// Optional data: none
handlers._tokens.post = function(data, callback) {
  const email = helpers.emailValidation(data.payload.email) ? data.payload.email.trim() : false;
  const password = helpers.passwordValidation(data.payload.password) ? data.payload.password.trim() : false;

  if (email && password) {
    // Lookup the user who matches that phone number
    _data.read('users', email, function(err, userData) {
      if (!err && userData) {
        // Hash the sent password, and compare it to the password stored in the user object
        const hashedPassword = helpers.hash(password);
        if (hashedPassword === userData.hashedPassword) {
          // If valid, create a new token with a random name. Set expiration date 1 hour in the future
          const tokenId = helpers.createRandomString(20);

          const expires = Date.now() + 1000 * 60 * 60;
          const tokenObject = {
            'email': email,
            'id': tokenId,
            'expires': expires,
          };

          // Store the token
          _data.create('tokens', tokenId, tokenObject, function(err) {
            if (!err) {
              callback(200, tokenObject);
            } else {
              callback(500, {'Error' : 'Could not create the new token'});
            }
          });
        } else {
          callback(400, {'Error': 'Password did not match the specified user\'s stored password'});
        }
      } else {
        callback(400, {'Error': 'Could not find the specified user'});
      }
    });
  } else {
    callback(400, {'Error' : 'Missing required field(s)'})
  }
}

// Tokens - get
// Required data: id
// Optional data: none
handlers._tokens.get = function(data, callback) {
  // Check that the id is valid
  const id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length === 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    // Lookup the token
    _data.read('tokens', id, function(err, tokenData) {
      if (!err && tokenData) {
        callback(200, tokenData);
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field'});
    }
}

// Tokens - put
// Required data: id, extend
// Optional data: none
handlers._tokens.put = function(data, callback) {
  const id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length === 20 ? data.payload.id.trim() : false;
  const extend = typeof (data.payload.extend) == 'boolean' && data.payload.extend === true;
  if (id && extend) {
    // LOOKUP THE TOKEN
    _data.read('tokens', id, function(err, tokenData) {
      if (!err && tokenData) {
        // Check to the make sure the token isn't already expired
        if (tokenData.expires > Date.now()) {
          // Set the expiration an hour from now
          tokenData.expires = Date.now() + 1000 * 60 * 60;

          // Store the new updates
          _data.update('tokens', id, tokenData, function(err) {
            if (!err) {
              callback(200);
            } else {
              callback(500, {'Error': 'Could not update the token expiration'});
            }
          });
        } else {
          callback(400, {'Error': 'The token has already expired, and cannot be extended'});
        }
      } else {
        callback(400, {'Error': 'Specified token does not exist'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field(s) or field(s) are invalid'});
  }

}

// Tokens - delete
// Required data: id
// Optional data: none
handlers._tokens.delete = function(data, callback) {
  // Check that the id is valid
  const id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length === 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    _data.read('tokens', id, function(err, data) {
      if (!err && data) {
        _data.delete('tokens', id, function(err) {
          if (!err) {
            callback(200);
          } else {
            callback(500, {'Error': 'Could not delete the specified token'});
          }
        });
      } else {
        callback(400, {'Error': 'Could not find the specified token'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
}

// Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = function(id, email, callback) {
  // Lookup the token
  _data.read('tokens', id, function(err, tokenData) {
    if (!err && tokenData) {
      // Check that the token is for the given user and has not expired
      if (tokenData.email === email && tokenData.expires > Date.now()) {
        callback(true);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  });
}

// Checks
handlers.checks = function(data, callback) {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all the checks methods
handlers._checks = {};

// Checks - post
// Required data: protocol, url, method, successCodes, timeoutSeconds
// Optional data: none

handlers._checks.post = function(data, callback) {
  // Validate inputs
  const protocol = typeof (data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
  const url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
  const method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
  const successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
  const timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

  if (protocol && url && method && successCodes && timeoutSeconds) {
    // Get the token from the headers
    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

    // Lookup the user by reading the token
    _data.read('tokens', token, function(err, tokenData) {
      if (!err && tokenData) {
        const userPhone = tokenData.phone;

        // Lookup the user data
        _data.read('users', userPhone, function(err, userData) {
          if (!err && userData) {
            const userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
            // Verify that the user has less than the number of max-checks-per-user
            if (userChecks.length < config.maxChecks) {
              // Create a random id for the check
              const checkId = helpers.createRandomString(20);

              // Create the check object, and include the user's phone
              const checkObject = {
                'id': checkId,
                'userPhone': userPhone,
                'protocol': protocol,
                'url': url,
                'method': method,
                'successCodes': successCodes,
                'timeoutSeconds': timeoutSeconds,
              };

              // Save the object
              _data.create('checks', checkId, checkObject, function(err) {
                if (!err) {
                  // Add the check id to the user's object
                  userData.checks = userChecks;
                  userData.checks.push(checkId);

                  // Save the new user data
                  _data.update('users', userPhone, userData, function(err) {
                    if (!err) {
                      // Return the data about the new check
                      callback(200, checkObject);
                    } else {
                      callback(500, {'Error': 'Could not update the user with the new check'});
                    }
                  });
                } else {
                  callback(500, {'Error': 'Could not create the new check'});
                }
              });
            } else {
              callback(400, {'Error': 'The user already has the maximum number of checks ('+config.maxChecks+')'});
            }
          } else {
            callback(403);
          }
        });
      } else {
        callback(403);
      }
    });
  } else {
    callback(400, {'Error': 'Missing required inputs, or inputs are invalid'});
  }
}

// Checks - get
// Required data: id
// Optional data: none
handlers._checks.get = function(data, callback) {

  // Check that the id is valid
  const id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length === 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    // Lookup the check
    _data.read('checks', id, function(err, checkData) {
      if (!err && checkData) {
        // get the token from the headers
        const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

        // Verify that the given token is valid and belongs to the user who created the check
        handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
          if (tokenIsValid) {
            // Return the check data
            callback(200, checkData);
          } else {
            callback(403);
          }
        });
      } else {
        callback(400);
      }
    });

  } else {
    callback(400, {'Error': 'Missing required field'});
  }
}

// Checks - put
// Required data: id
// Optional data: protocol, url, method, successCodes, timeoutSeconds (one must be sent)
handlers._checks.put = function(data, callback) {
  // Check for the required field
  const id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length === 20 ? data.payload.id.trim() : false;

  // Check for the optional fields
  const protocol = typeof (data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
  const url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
  const method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
  const successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
  const timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

  // Check to make sure id is valid
  if (id) {
     // Check to make sure one or more optional fields has been sent
     if (protocol || url || method || successCodes || timeoutSeconds) {
      // Lookup the check
      _data.read('checks', id, function(err, checkData) {
        if (!err && checkData) {
          // get the token from the headers
          const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

          // Verify that the given token is valid and belongs to the user who created the check
          handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
            if (tokenIsValid) {
              // Update the check where necessary
              if (protocol) {
                checkData.protocol = protocol;
              }
              if (url) {
                checkData.url = url;
              }
              if (method) {
                checkData.method = method;
              }
              if (successCodes) {
                checkData.successCodes = successCodes;
              }
              if (timeoutSeconds) {
                checkData.timeoutSeconds = timeoutSeconds;
              }

              // Store the new updates
              _data.update('checks', id, checkData, function(err) {
                if (!err) {
                  callback(200);
                } else {
                  callback(500, {'Error': 'Could not update the check'});
                }
              });
            } else {
              callback(403)
            }
          });
        } else {
          callback(400, {'Error': 'Check ID did not exist'});
        }
      });
     } else {
       callback(400, {'Error': 'Fields to update'});
     }
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
}

// Checks - delete
// required data: id
// Optional data: none
handlers._checks.delete = function(data, callback) {
  // Check that the id is valid
  const id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length === 20 ? data.queryStringObject.id.trim() : false;
  if (id) {

    // Lookup the check
    _data.read('checks', id, function(err, checkData) {
      if (!err && checkData) {
        // get the token from the headers
        const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

        // Verify that the given token is valid for the phone number
        handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
          if (tokenIsValid) {
            // Delete the check data
            _data.delete('checks', id, function(err) {
              if (!err) {
                // Lookup the user
                _data.read('users', checkData.userPhone, function(err, userData) {
                  if (!err && userData) {
                    const userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

                    // Remove the delete check from their list of checks
                    const checkPosition = userChecks.indexOf(id);
                    if (checkPosition > -1) {
                      userChecks.splice(checkPosition, 1);

                      // Re-save the user's data
                      _data.update('users', checkData.userPhone, userData, function(err) {
                        if (!err) {
                          callback(200);
                        } else {
                          callback(500, {'Error': 'Could not update the specified user'});
                        }
                      });
                    } else {
                      callback(500, {'Error': 'Could not find the check on the users object, so could not remove it'})
                    }
                  } else {
                    callback(500, {'Error': 'Could not find the user who created the check, so could not remove the check from the list of checks on the user object'});
                  }
                });
              } else {
                callback(500, {'Error': 'Could not delete check data'});
              }
            });
          } else {
            callback(403);
          }
        });
      } else {
        callback(400, {'Error': 'The specified check ID does not exist'});
      }
    });

  } else {
    callback(400, {'Error': 'Missing required field'});
  }
}

// Menu
handlers.menu = function(data, callback) {
  const acceptableMethods = ['get'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._menu[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for the menu sub methods
handlers._menu = {};

// Menu - get
// Required data: email
// Optional data: none
handlers._menu.get = function(data, callback) {

  // Check that the phone number is valid
  const email = helpers.emailValidation(data.payload.email) ? data.payload.email.trim() : false;

  if (email) {
    // get the token from the headers
    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function(tokenIsValid) {
      if (tokenIsValid) {
        _data.read('menu', 'items', function(err, data) {
          if (!err && data) {
            callback(200, data);
          } else {
            callback(404);
          }
        });
      } else {
        callback(403, {'Error': 'Missing required token in header, or token is invalid'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
}

// Shopping cart
handlers.shoppingCarts = function(data, callback) {
  const acceptableMethods = ['get', 'put'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._shoppingCarts[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for the shopping carts sub methods
handlers._shoppingCarts = {};

// shopping carts - get
// Required data: email
// Optional data: none
handlers._shoppingCarts.get = function(data, callback) {

  // Check that the phone number is valid
  const email = helpers.emailValidation(data.queryStringObject.email) ? data.queryStringObject.email.trim() : false;

  if (email) {
    // get the token from the headers
    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function(tokenIsValid) {
      if (tokenIsValid) {
        _data.read('shoppingCarts', email, function(err, data) {
          if (!err && data) {
            callback(200, data);
          } else {
            callback(404);
          }
        });
      } else {
        callback(403, {'Error': 'Missing required token in header, or token is invalid'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
}

// shoppingCarts - put
// Required data: items, email
// Optional data: none
handlers._shoppingCarts.put = function(data, callback) {
  // Check for the required field
  let items = data.payload.items && data.payload.items.length > 0 ? data.payload.items : false;
  const email = helpers.emailValidation(data.queryStringObject.email) ? data.queryStringObject.email.trim() : false;

  // Check to make sure id is valid
  if (items && email) {
    // Lookup the check
    _data.read('shoppingCarts', email, function(err, shoppingCart) {
      if (!err && shoppingCart) {
        // get the token from the headers
        const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

        // Verify that the given token is valid and belongs to the user who created the check
        handlers._tokens.verifyToken(token, email, function(tokenIsValid) {
          if (tokenIsValid) {
            // Update the check where necessary
            items = items.concat(shoppingCart);

            // Store the new updates
            _data.update('shoppingCarts', email, items, function(err) {
              if (!err) {
                callback(200);
              } else {
                callback(500, {'Error': 'Could not update the shopping cart'});
              }
            });
          } else {
            callback(403)
          }
        });
      } else {
        callback(400, {'Error': 'Check ID did not exist'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
}

// Ping handler
handlers.ping = function(data, callback) {
  // Callback a http status code, and a payload object
  callback(200);
};

// Not found handler
handlers.notFound = function(data, callback) {
  callback(404);
};

module.exports = handlers;