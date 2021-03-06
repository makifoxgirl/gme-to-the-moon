import Pbf from "pbf";
import { yaticker } from "./yaticker";

const isChrome = window.browser == null;
if (window.browser == null) {
	window.browser = (window as any).chrome;
}

if (!isChrome) {
	browser.browserAction.setBadgeTextColor({
		color: "#fff",
	});
}

let lastText = "";
const setText = (text: string) => {
	if (lastText == text) return;
	lastText = text;
	browser.browserAction.setBadgeText({
		text,
	});
};

let lastColor = "";
const setColor = (color: string) => {
	if (lastColor == color) return;
	lastColor = color;
	browser.browserAction.setBadgeBackgroundColor({
		color,
	});
};

let lastIconUp: boolean = null;
const setIconUp = (up: boolean) => {
	if (lastIconUp == up) return;
	lastIconUp = up;

	// looks better flipped in firefox
	const deg = isChrome ? (up ? 0 : 180) : up ? 270 : 90;
	const path = "icons/rocket-" + deg + "deg-";

	browser.browserAction.setIcon({
		path: {
			"16": path + "16px.png",
			"32": path + "32px.png",
			"320": path + "320px.png",
		},
	});
};

const makeLoading = () => {
	setText("...");
	setColor("#607d8b");
	setIconUp(true);
};

const formatNumber = (n: number) => {
	// return new Intl.NumberFormat("en-US", {
	// 	style: "currency",
	// 	currency: "USD",
	// })
	// 	.format(n)
	// 	.replace(/^\$/, "");
	return n.toFixed(2);
};

let lastPrice = 0;
const setPrice = (price: number) => {
	const tendieManComing = price >= lastPrice;
	lastPrice = price;

	setText(formatNumber(price));
	setColor(tendieManComing ? "#4caf50" : "#f44336");
	setIconUp(tendieManComing);
};

const updateWithCurrentPrice = async () => {
	const req = await fetch("https://finance.yahoo.com/quote/GME/");
	const html = await req.text();

	const matches = html.match(/root\.App\.main = ({[^]+?});\n/i);
	if (matches == null) return;
	if (matches.length < 2) return;

	const data = JSON.parse(matches[1]);
	const GME =
		data?.context?.dispatcher?.stores?.StreamDataStore?.quoteData?.GME;
	if (GME == null) return;

	const price = GME?.regularMarketPrice?.raw;
	if (price == null) return;

	console.log("Manually fetched from Yahoo Finance");
	setPrice(price);
};

const connectToYahoo = () => {
	const socket = new WebSocket("wss://streamer.finance.yahoo.com");

	socket.onopen = () => {
		console.log("Connected to Yahoo Finance");
		socket.send(JSON.stringify({ subscribe: ["GME"] }));
	};

	socket.onmessage = event => {
		const raw = Uint8Array.from(atob(event.data), c => c.charCodeAt(0));
		const pbf = new Pbf(raw);
		const { id, price } = yaticker.read(pbf);
		if (id != "GME") return;
		setPrice(price);
	};

	socket.onclose = () => {
		console.log("Disconnected from Yahoo Finance");
		// makeLoading();
		updateWithCurrentPrice();
		setTimeout(() => {
			connectToYahoo();
		}, 5000);
	};
};

makeLoading();

updateWithCurrentPrice();

connectToYahoo();
