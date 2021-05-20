#Pizza API
JSON RESTful API free of 3rd-party dependencies for a pizza-delivery company.

# ROUTES

## api/users

|Method|Header|Query params|Payload|Desc|
|------|---------------|----------------|----------------|----------------|
|`GET`   |`token`* ||`email`\*|Return information about the user except for password in a JSON format.|
|`PUT`   |`token`* ||`email`*, at least one of: \(`name`, `address`, `password`\)\*| Change one/more of user's information. Email change not allowed.|
|`POST`  | | | `name` *, `address`\*, `email`\*, `password`\*, `tosAgreement`\*|Create a user account.|
|`DELETE`|`token`* ||`email`* |Delete user's account.|

## api/tokens
|Method|Header|Query params|Payload|Desc|
|------|---------------|----------------|----------------|----------------|
|`GET`   ||`id`\*||Get token's id and expiration date.|
|`PUT`   |||`id`\*, `extend`\*|With extend set to true, a valid token's lifespan is extended.|
|`POST`  ||| `email`\*, `password`\* |Log in. Return a new, valid token for the user to use with other routes.|
|`DELETE`||`id`\*||Log out.|

## api/menu

|Method|Header|Query params|Payload|Desc|
|------|---------------|----------------|----------------|----------------|
|`GET` |`token`*| `email`\*||Get menu as a JSON array of pizzas. |

## api/shoppingCarts
|Method|Header|Query params|Payload|Desc|
|------|---------------|----------------|----------------|----------------|
|`GET`   |`token`\*|| `email`\*|Get full list of existing, unpurchased orders for the user.|
|`PUT`   |`token`\* || `email`\*, `items` array of items*, eg. [{"id":1,"amount":2}]||
|`DELETE`|`token`\* || `email`\*, `item` item id|Delete items from user's shopping cart.|

## api/purchases
|Method|Header|Query params|Payload|Desc|
|------|---------------|----------------|----------------|----------------|
|`POST`  |`token`*||`email`| |

*Required