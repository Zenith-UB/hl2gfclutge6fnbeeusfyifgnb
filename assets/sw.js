const CACHE = "hl2-shell-v3";

const PRECACHE = [
	"./",
	"./index.html",
	"../assets/hl2_launcher.js",
	"../assets/hl2_launcher.wasm",
	"../assets/icon-192.png",
	"../assets/icon-512.png",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await self.clients.claim();
		})(),
	);
});
function withCoiHeaders(resp) {
	if (!resp) return resp;
	const headers = new Headers(resp.headers);
	headers.set("Cross-Origin-Opener-Policy", "same-origin");
	headers.set("Cross-Origin-Embedder-Policy", "require-corp");
	headers.set("Cross-Origin-Resource-Policy", "cross-origin");
	return new Response(resp.body, {
		status: resp.status,
		statusText: resp.statusText,
		headers,
	});
}

self.addEventListener("fetch", (event) => {
	const req = event.request;
	const url = new URL(req.url);
	if (req.method !== "GET" || url.origin !== self.location.origin) return;

	const path = url.pathname;

	if (path.includes("/chunks/") && path.endsWith(".data")) {
		event.respondWith(
			fetch(req)
				.then(withCoiHeaders)
				.catch(() => new Response("offline", { status: 503 })),
		);
		return;
	}

	if (path.endsWith("/chunks/manifest.json")) {
		event.respondWith(
			(async () => {
				try {
					const resp = await fetch(req);
					const cache = await caches.open(CACHE);
					cache.put(req, resp.clone());
					return withCoiHeaders(resp);
				} catch (e) {
					const cached = await caches.match(req);
					return withCoiHeaders(
						cached ||
							new Response("{}", {
								headers: { "content-type": "application/json" },
							}),
					);
				}
			})(),
		);
		return;
	}
	if (req.mode === "navigate" || path.endsWith(".html")) {
		event.respondWith(
			(async () => {
				try {
					const resp = await fetch(req);
					const cache = await caches.open(CACHE);
					cache.put(req, resp.clone());
					return withCoiHeaders(resp);
				} catch (e) {
					const cached = await caches.match(req);
					return withCoiHeaders(cached || new Response("offline", { status: 503 }));
				}
			})(),
		);
		return;
	}

	event.respondWith(
		(async () => {
			const cached = await caches.match(req);
			if (cached) return withCoiHeaders(cached);
			try {
				const resp = await fetch(req);
				if (resp.ok && resp.type === "basic") {
					const cache = await caches.open(CACHE);
					cache.put(req, resp.clone());
				}
				return withCoiHeaders(resp);
			} catch (e) {
				return new Response("offline", { status: 503 });
			}
		})(),
	);
});
