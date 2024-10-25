//TODO: Make sure that we are updating the hand data example
// playerHand(_hand.playerInTurn, _hand.hands).push(card); we are not saving the new Card[] data in to the hand object
//TODO: Update the nextPlayer function to take hand as a parameter and return a new modified copy of hand object, do the same for other functions

import { Shuffler, standardShuffler } from "../utils/random_utils";
import { Card, CardColor, createInitialDeck, deal, Deck, push, top } from "./deck";

type UnoFailure = {
	accuser: number;
	accused: number;
};

type EndCallback = (event: { winner: number }) => void;

export type Hand = Readonly<{
	players: string[];
	hands: Card[][];
	playerUnos: boolean[];
	dealer: number;
	shuffler?: Shuffler<Card>;
	cardsPerPlayer?: number;
	drawPile: Deck;
	discardPile: Deck;
	playerInTurn: number;
	isReverse: boolean;
	selectedColor?: CardColor;
	score?: number;
	endCallbacks: EndCallback[];
	playerCount: number;
}>;

export function createHand(players: string[], dealer: number, shuffler: Shuffler<Card>, cardsPerPlayer: number): Hand {
	if (players.length < 2) throw new Error("Not enough player");
	if (players.length > 10) throw new Error("To many players");

	const hands = Array.from({ length: players.length }, () => []);
	const playerUnos = Array.from({ length: players.length }, () => false);

	dealer = dealer;
	cardsPerPlayer = cardsPerPlayer;

	const drawPile = createInitialDeck();
	const discardPile: Deck = [];
	let playerInTurn = dealer;
	const isReverse = false;

	let hand: Hand = {
		players,
		dealer,
		cardsPerPlayer,
		shuffler,
		hands,
		playerUnos,
		drawPile,
		discardPile,
		playerInTurn,
		isReverse,
		endCallbacks: [],
		playerCount: players.length,
	};

	let _hand = { ...hand };
	_hand.drawPile = shuffle(_hand.drawPile, _hand.shuffler);
	_hand = initialDealCards(_hand);
	_hand.playerInTurn = nextPlayer(_hand.playerInTurn, _hand.isReverse, hands.length);

	return _hand;
}

export function canPlay(cardIndex: number, hand: Hand): boolean {
	if (
		// Checks if the cardIndex is in bounds, otherwise return false
		cardIndex < 0 ||
		cardIndex >= playerHand(hand.playerInTurn, hand.hands).length
	)
		return false;

	const cardToPlay = playerHand(hand.playerInTurn, hand.hands)[cardIndex];
	const topDiscardCard = { ...top(hand.discardPile) };

	if (hand.selectedColor !== undefined) {
		topDiscardCard.color = hand.selectedColor; // Override the top discard card color if a previous played has played a wild card and changed the color
		topDiscardCard.number = undefined;
	}

	if (cardToPlay.type === "WILD DRAW") {
		// Check if the player has a card of the same color as the top discard card
		const hasMatchingColorCard = playerHand(hand.playerInTurn, hand.hands).some(
			(card) => card.color === topDiscardCard.color
		);

		// The card can be played if there is no matching color card
		if (hasMatchingColorCard) {
			return false; // Illegal to play a Wild Draw 4 card if hand contains a card with the matching color
		}
		return true;
	}

	if (cardToPlay.type === "WILD") {
		return true; // Wild cards can always be played
	}

	// Check if the cardToPlay has the same color as the top discard card
	if (cardToPlay.color === topDiscardCard.color) {
		return true;
	}

	// Check if cardToPlay is a numbered card and has the same number as the top discard card
	if (
		cardToPlay.type === "NUMBERED" &&
		topDiscardCard.type === "NUMBERED" &&
		cardToPlay.number === topDiscardCard.number
	) {
		return true;
	}

	// Special handling for reverse, skip, and draw cards
	// Checks if the type of the color is the same as the top discard card and allows the play
	if (cardToPlay.type === "REVERSE" || cardToPlay.type === "SKIP" || cardToPlay.type === "DRAW") {
		return cardToPlay.color === topDiscardCard.color || cardToPlay.type === topDiscardCard.type;
	}

	// If none of the above conditions are met, the card is not playable
	return false;
}

export function catchUnoFailure(unoFailure: UnoFailure, hand: Hand): Hand {
	if (checkUnoFailure(unoFailure, hand)) throw new Error("Uno Failure");

	return hand;
}

export function sayUno(playerIndex: number, hand: Hand): Hand {
	if (hasEnded(hand)) throw Error("Cannot say UNO, the round has ended");
	const _hand = { ...hand };

	if (playerIndex < 0) throw new Error("Player hand index out of bounds");
	if (playerIndex >= _hand.hands.length) throw new Error("Player hand index out of bounds");

	if (
		_hand.playerInTurn === playerIndex ||
		_hand.playerInTurn === nextPlayerIndex(_hand.playerInTurn, _hand.isReverse, _hand.hands.length, playerIndex)
	)
		_hand.playerUnos[playerIndex] = true;
	return _hand;
}

export function checkUnoFailure(unoFailure: UnoFailure, hand: Hand): boolean {
	const accusedPlayer = hand.hands[unoFailure.accused];
	let _hand = { ...hand };

	if (
		accusedPlayer.length === 1 &&
		!_hand.playerUnos[unoFailure.accused] &&
		(_hand.playerInTurn === unoFailure.accused ||
			_hand.playerInTurn ===
				nextPlayerIndex(_hand.playerInTurn, _hand.isReverse, _hand.hands.length, unoFailure.accused))
	) {
		for (let index = 0; index < 4; index++) {
			let { dealCard: drawnCard, hand: updatedHand } = deal(_hand.drawPile, _hand);
			_hand = updatedHand;
			if (drawnCard) accusedPlayer.push(drawnCard);
		}
		return true;
	}

	return false;
}

export function draw(hand: Hand): Hand {
	if (hasEnded(hand)) throw new Error("Cannot draw, the round has ended");
	let _hand = { ...hand };

	// Deal a card from the draw pile
	const { dealCard, hand: updatedHand } = deal(hand.drawPile, hand);
	_hand = updatedHand;
	if (!dealCard) return _hand; // If no card is available, return hand unchanged

	// Create new copies for immutability
	const updatedDrawPile = hand.drawPile.slice(1); // Remove dealt card from draw pile
	const updatedPlayerHands = hand.hands.map(
		(playerHand, index) => (index === hand.playerInTurn ? [...playerHand, dealCard] : playerHand) // Add the card to the current player's hand
	);
	const updatedPlayerUnos = hand.playerUnos.map(
		(uno, index) => (index === hand.playerInTurn ? false : uno) // Set `playerUnos` for current player to false
	);

	// Determine the next player if no playable cards are in hand
	const updatedPlayerInTurn = canPlayAny({ ...hand, hands: updatedPlayerHands })
		? hand.playerInTurn
		: nextPlayer(hand.playerInTurn, hand.isReverse, hand.hands.length);

	// Return a new Hand object with the updates applied
	return {
		...hand,
		drawPile: updatedDrawPile,
		hands: updatedPlayerHands,
		playerUnos: updatedPlayerUnos,
		playerInTurn: updatedPlayerInTurn,
	};
}

export function play(cardIndex: number, nextColor: CardColor, hand: Hand): Hand {
	if (!canPlay(cardIndex, hand)) throw new Error("Can not play the card"); // Checks if the move is legal

	let _hand = { ...hand };

	_hand.selectedColor = undefined;

	const cardToPlay = playerHand(_hand.playerInTurn, _hand.hands)[cardIndex];

	// Check if the cardToPlay is not a Wild or Wild Draw card and check if the nextColor is provided
	if (!(cardToPlay.type === "WILD" || cardToPlay.type === "WILD DRAW") && nextColor)
		throw Error("Cannot name a color on a colored card");

	if (cardToPlay.type === "WILD" || cardToPlay.type === "WILD DRAW") {
		if (!nextColor) throw Error("Next color is undefined but a wild card was played");
		_hand.selectedColor = nextColor; // Set the selected color for Wild and Wild Draw 4 cards
	}

	_hand.discardPile = push(cardToPlay, _hand.discardPile); // Adds the played cared to the discard pile
	const deck = playerHand(_hand.playerInTurn, _hand.hands);
	deck.splice(cardIndex, 1); // Removes the played card from the players deck
	_hand.hands[hand.playerInTurn] = deck;
	_hand = handleLogicForSpecialCards(cardToPlay, _hand);
	_hand.playerInTurn = nextPlayer(_hand.playerInTurn, _hand.isReverse, _hand.hands.length);
	hasEnded(_hand); // Check if the game has ended
	return _hand;
}

export function hasEnded(hand: Hand): boolean {
	for (let index = 0; index < hand.hands.length; index++) {
		if (playerHand(index, hand.hands).length === 0) {
			hand = calculateScore(hand);
			const _winner = winner(hand);
			//if (_winner !== undefined) this.endCallbacks.forEach((callback) => callback({ winner }));
			return true;
		}
	}

	return false;
}

export function winner(hand: Hand): number | undefined {
	for (let index = 0; index < hand.hands.length; index++) {
		if (playerHand(index, hand.hands).length === 0) return index;
	}

	return undefined;
}

export function canPlayAny(hand: Hand): boolean {
	for (let index = 0; index < playerHand(hand.playerInTurn, hand.hands).length; index++) {
		if (canPlay(index, hand)) return true;
	}
	return false;
}

export function score(hand: Hand): number | undefined {
	return hand.score;
}

export function playerHand(index: number, playerHands: Card[][]): Card[] {
	if (index < 0) throw new Error("Player hand index out of bounds");
	if (index >= playerHands.length) throw new Error("Player hand index out of bounds");
	return [...playerHands[index]];
}

function initialDealCards(hand: Hand): Hand {
	let _hand = { ...hand };
	// Deal 7 cards to each player
	for (let i = 0; i < _hand.hands.length; i++) {
		_hand.playerInTurn = nextPlayer(_hand.playerInTurn, _hand.isReverse, _hand.hands.length);
		for (let j = 0; j < (_hand.cardsPerPlayer ?? 7); j++) {
			const { dealCard, hand: updatedHand } = deal(_hand.drawPile, _hand);
			_hand = updatedHand;
			if (dealCard) {
				const deck = playerHand(_hand.playerInTurn, _hand.hands);
				deck.push(dealCard);
				_hand.hands[_hand.playerInTurn] = deck;
			}
		}
	}

	// Deal the first card to the discard pile
	let { dealCard: card, hand: updatedHand } = deal(_hand.drawPile, _hand);
	_hand = updatedHand;
	if (!card) return _hand;

	// Ensure the first card is not WILD or WILD DRAW 4
	while (card.type === "WILD" || card.type === "WILD DRAW") {
		_hand.drawPile = push(card, _hand.drawPile); // put it back in the pile
		_hand.drawPile = shuffle(_hand.drawPile, _hand.shuffler); // shuffle again
		let { dealCard, hand: updatedHand } = deal(_hand.drawPile, _hand); // draw a new card
		_hand = updatedHand;
		card = dealCard;
		if (!card) return _hand; // fail-safe
	}

	// Add the valid first card to the discard pile
	_hand.discardPile = push(card, _hand.discardPile);

	// Special case handling for the first discard
	_hand = handleLogicForSpecialCards(card, _hand);
	return _hand;
}

function nextPlayer(playerInTurn: number, isReverse: boolean, amountOfPlayers: number): number {
	return nextPlayerIndex(playerInTurn, isReverse, amountOfPlayers);
}

function shuffle(drawPile: Deck, shuffler?: Shuffler<Card>): Deck {
	const effectiveShuffler = shuffler || standardShuffler;
	const shuffledCards = effectiveShuffler([...drawPile]);

	return shuffledCards;
}

function handleLogicForSpecialCards(card: Card, hand: Hand): Hand {
	let _hand = { ...hand };
	switch (card.type) {
		case "REVERSE":
			// If there is two players, reverse card acts like a skip card.
			if (_hand.playerCount === 2)
				_hand.playerInTurn = nextPlayer(_hand.playerInTurn, _hand.isReverse, _hand.playerCount);

			_hand.isReverse = !_hand.isReverse;
			break;
		case "SKIP":
			_hand.playerInTurn = nextPlayer(_hand.playerInTurn, _hand.isReverse, _hand.playerCount); // skip the next player
			break;
		case "DRAW":
		case "WILD DRAW":
			const _nextPlayer = _hand.hands[nextPlayerIndex(_hand.playerInTurn, _hand.isReverse, _hand.playerCount)];
			// Deal ether 2 or 4 cards depending is it a normal Draw or Wild Draw
			for (let index = 0; index < (card.type === "DRAW" ? 2 : 4); index++) {
				let { dealCard, hand: updatedHand } = deal(_hand.drawPile, _hand);
				_hand = updatedHand;
				if (dealCard) _nextPlayer.push(dealCard);
			}
			_hand.playerInTurn = nextPlayer(_hand.playerInTurn, _hand.isReverse, _hand.playerCount); // the player who draws also skips their turn
			break;
	}

	return _hand;
}

function nextPlayerIndex(
	playerInTurn: number,
	isReverse: boolean,
	amountOfPlayers: number,
	playerIndex?: number
): number {
	const range = amountOfPlayers;
	if (isReverse) return ((playerIndex ?? playerInTurn) - 1 + range) % range;
	else return ((playerIndex ?? playerInTurn) + 1 + range) % range;
}

function calculateScore(hand: Hand): Hand {
	if (hand.score !== undefined)
		// Do not calculate the score if the score has been calculated already!
		return hand;

	const _hand = { ...hand };
	_hand.score = 0;

	for (let i = 0; i < _hand.hands.length; i++) {
		const _playerHand = playerHand(i, _hand.hands);
		for (let j = 0; j < playerHand.length; j++) {
			const card = _playerHand[j];
			if (!card) return _hand;
			if (card.type === "NUMBERED" && card.number) _hand.score += card.number;
			if (card.type === "DRAW") _hand.score += 20;
			if (card.type === "REVERSE") _hand.score += 20;
			if (card.type === "SKIP") _hand.score += 20;
			if (card.type === "WILD") _hand.score += 50;
			if (card.type === "WILD DRAW") _hand.score += 50;
		}
	}

	return _hand;
}
