/*
* Request handlers
*/

// Dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');

// Define the handlers
const handlers = {};

/**
* HTML Handlers
*/

// Index handler
handlers.index = function(data, callback) {
  if (data.method == 'get') {
    // Read in a template as a string
    helpers.getTemplate('index', function(err, str) {
      if (!err && str) {
        callback(200, str, 'html');
      } else {
        callback(500, undefined);
      }
    });
  } else {
    callback(405, undefined, 'html');
  }
}

/**
* JSON API Handlers 
*/

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
        callback(400, {'Error:': 'A user with that email already exist'});
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

  // Check that the email is valid
  const email = helpers.emailValidation(data.queryStringObject.email) ? data.queryStringObject.email.trim() : false;

  if (email) {
    // get the token from the headers
    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

    // Verify that the given token is valid for the email
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

      // Verify that the given token is valid for the email
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
    // Lookup the user who matches that email
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

// Purchases
handlers.purchases = function(data, callback) {
  const acceptableMethods = ['post'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._purchases[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all the purchases methods
handlers._purchases = {};

// Purchases - post
// Required data: email
// Optional data: none
handlers._purchases.post = function(data, callback) {
  // Check that the email is valid
  const email = helpers.emailValidation(data.queryStringObject.email) ? data.queryStringObject.email.trim() : false;

  if (email) {
    // get the token from the headers
    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function(tokenIsValid) {
      if (tokenIsValid) {
        _data.read('shoppingCarts', email, function(err, shoppingCart) {
          if (!err && shoppingCart && shoppingCart.length > 0) {
            const order = shoppingCart;
            const orderUuid = helpers.createRandomString(20);
            _data.read('menu', 'items', function(err, menu) {
              if (!err && menu) {
                helpers.processOrder(email, order, menu,function(err) {
                  if (!err) {
                    // Store the purchase
                    _data.create('purchases', orderUuid, order, function(err) {
                      if (!err) {
                        _data.update('shoppingCarts', email, shoppingCart, function(err) {
                          if (!err) {
                            callback(403, {'Error': 'Unable to clean shopping cart'});
                          } else {
                            callback(200);
                          }
                        });
                      } else {
                        callback(403, {'Error': 'Could not save order'});
                      }
                    });
                  } else {
                    callback(403, {'Error': 'Could not make payment'});
                  }
                });
              } else {
                callback(404);
              }
            });

          } else {
            callback(500);
          }
        });
      } else {
        callback(403);
      }

    });
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

  // Check that the email is valid
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
  const acceptableMethods = ['get', 'put', 'delete'];
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

  // Check that the email is valid
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
// Required data: []items, email
// Optional data: none
handlers._shoppingCarts.put = function(data, callback) {
  // Check for the required field
  console.log(data.payload);
  let items = data.payload.items && data.payload.items.length > 0 ? data.payload.items : false;
  const email = helpers.emailValidation(data.queryStringObject.email) ? data.queryStringObject.email.trim() : false;

  // Check to make sure items is valid
  if (items && email) {
    // Lookup the check
    _data.read('shoppingCarts', email, function(err, shoppingCart) {
      if (!err && shoppingCart) {
        // get the token from the headers
        const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

        // Verify that the given token is valid and belongs to the user who created the check
        handlers._tokens.verifyToken(token, email, function(tokenIsValid) {
          if (tokenIsValid) {
            // Update the shopping cart where necessary
            items.forEach(item => {
              let index = shoppingCart.findIndex(oldItem => item.id == oldItem.id);
              if (index > -1) {
                shoppingCart[index].amount += item.amount;
              } else {
                shoppingCart.push(item);
              }
            });

            // Store the new updates
            _data.update('shoppingCarts', email, shoppingCart, function(err) {
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
        callback(400, {'Error': 'Could not find shopping cart'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
}

// shoppingCarts - delete
// required data: email, item
// Optional data: none
handlers._shoppingCarts.delete = function(data, callback) {
  // Check for the required field
  let item = data.payload.item ? data.payload.item : false;
  const email = helpers.emailValidation(data.queryStringObject.email) ? data.queryStringObject.email.trim() : false;

  if (email && item) {
    // Lookup the check
    _data.read('shoppingCarts', email, function(err, shoppingCart) {
      if (!err && shoppingCart) {
        // get the token from the headers
        const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

        // Verify that the given token is valid for the email
        handlers._tokens.verifyToken(token, email, function(tokenIsValid) {
          if (tokenIsValid) {
            let index = shoppingCart.findIndex(oldItem => item == oldItem.id);
            if (index > -1) {
              if (shoppingCart[index].amount > 1) {
                shoppingCart[index].amount = shoppingCart[index].amount - 1;
              } else {
                delete  shoppingCart[index];
              }
              // Store the new updates
              _data.update('shoppingCarts', email, shoppingCart, function(err) {
                if (!err) {
                  callback(200);
                } else {
                  callback(500, {'Error': 'Could not update the shopping cart'});
                }
              });
            } else {
              callback(403, {"Error": "Could not find item"});
            }
          } else {
            callback(403)
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