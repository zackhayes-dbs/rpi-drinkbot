// load the config. Node can read json in as if it were javascript exporting a plain object
var config = require('./config.json');

// load in gpioController script
var gpioController = require('./gpioController');

// declare these variables, they'll be initialized along with the gpioController inside init below
var queue, busy;

// get ingredient info from config given an ingredient's id
function getIngredient(ingredientID){
	return config.ingredients.find(n => n.id == ingredientID);
}

// this function is called when the button is pushed, and the message returned is logged out
function makeNextDrink(){

	// we don't want to try making two drinks at once, that could be distasterous
	if (busy){
		console.log('I\'M VERY BUSY. PLEASE WAIT.');
		return;
	}

	// if there are no drinks in the queue, obviously we can't make a drink
	if (!queue.length){
		console.log('No drinks are in the queue.');
		return;
	}

	busy = true;

	// get the first drink from the queue. The drink is one of the objects inside config.drinks
	var currentDrink = queue.shift();

	var promises = [];

	// iterate over the ingredients in the recipe for the current drink
	for (var ingredientID in currentDrink.recipe){
		var ingredientConfig = getIngredient(ingredientID);

		if (!ingredientConfig){
			console.log('Ingredient not found: ' + ingredientID);
			return;
		}

		// calculate how long to turn on the pin
		var ounces = currentDrink.recipe[ingredientID];
		var millisToRun = ounces * config.millisPerOunce;

		// turn the pin on. This happens asyncronously, so the loop continues so quickly that all
		// the needed pumps come on a virtually the same time
		// each call returns a promise and we collect those in an array
		promises.push(
			gpioController.pinOnDuration(ingredientConfig.pin, millisToRun)
		);
	}
	
	console.log('Making ' + currentDrink.displayName);

	// when all of the promises we collected have returned, we know the drink is done being made
	Promise.all(promises).then(() => {
		busy = false;
		console.log(queue.length ?
			'The next drink on the queue is ' + queue[0].displayName + '. Press the button.'
			: 'There are no more drinks in the queue. Order more.'
		);
	
	// if anything bad happens, log it out.
	}).catch(err => {
		console.error(err);
	});
}

module.exports = () => {

	// do some initialization
	queue = [];
	busy = false;

	var pumpPins = config.ingredients.map(ing => ing.pin);
	gpioController.init([config.buttonPin], pumpPins);

	// give gpioController a function to call when the button is pressed
	gpioController.onPress(config.buttonPin, makeNextDrink);

	// this is the API that the server uses to request drinks and access the config
	return {
		queueDrink(drinkID){

			// find the drink info from the config and push it onto the queue
			var drink = config.drinks.find(d => d.id == drinkID);
			if (!drink){
				return 'That drink doesn\'t exist! ' + drinkID;
			}

			queue.push(drink);

			return 'Request received for ' + drink.displayName + '. It is #' + queue.length + ' in queue.';
		},
		getConfig(){
			return config;
		}
	}
};
