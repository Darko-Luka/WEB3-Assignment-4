import { Hand } from "./hand";

export type CardType = "SKIP" | "NUMBERED" | "REVERSE" | "DRAW" | "WILD" | "WILD DRAW";
export type CardColor = "BLUE" | "GREEN" | "RED" | "YELLOW";
export const colors: CardColor[] = ["BLUE", "GREEN", "RED", "YELLOW"];

export interface Card {
	type: CardType;
	color?: CardColor;
	number?: number;
}

export type Deck = Readonly<Card[]>;

export function createInitialDeck(): Deck {
	const cards: Card[] = [];
	const colors: CardColor[] = ["BLUE", "GREEN", "RED", "YELLOW"];

	// Color cards
	colors.forEach((color) => {
		for (let index = 0; index < 10; index++) {
			cards.push({ type: "NUMBERED", color, number: index });
			if (index != 0) cards.push({ type: "NUMBERED", color, number: index });
		}
	});

	// Skip, Reverse and Draw cards
	colors.forEach((color) => {
		for (let index = 0; index < 2; index++) {
			cards.push({ type: "SKIP", color, number: undefined });
			cards.push({ type: "REVERSE", color, number: undefined });
			cards.push({ type: "DRAW", color, number: undefined });
		}
	});

	// Wild cards
	for (let index = 0; index < 4; index++) {
		cards.push({ type: "WILD", color: undefined, number: undefined });
		cards.push({ type: "WILD DRAW", color: undefined, number: undefined });
	}

	return cards;
}

// Removes the first card from the cards array
export function deal(drawPile: Deck, hand: Hand): { dealCard?: Card; hand: Hand } {
	const _hand = { ...hand };
	const _cards = [...hand.drawPile];
	const dealCard = _cards.shift();
	_hand.drawPile = _cards;
	return { dealCard, hand: _hand };
}

export function push(card: Card, cards: Deck): Deck {
	const _cards = [...cards];
	_cards.unshift(card);
	return _cards;
}

export function top(deck: Deck): Card {
	return deck[0];
}
