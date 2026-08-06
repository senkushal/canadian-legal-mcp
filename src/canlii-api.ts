export type ApiFetch = (url: string) => Promise<Response>;

export function createRateLimitedApiFetch(): ApiFetch {
	let queue: Promise<void> = Promise.resolve();
	let dailyCount = 0;
	let dailyResetDate = new Date().toDateString();
	let lastRequestTime = 0;

	const minimumIntervalMs = 500;
	const dailyLimit = 5000;

	return (url: string): Promise<Response> => {
		const request = queue.then(async () => {
			const today = new Date().toDateString();

			if (today !== dailyResetDate) {
				dailyCount = 0;
				dailyResetDate = today;
			}

			if (dailyCount >= dailyLimit) {
				throw new Error(
					"Daily API limit reached (5,000 queries). Try again tomorrow.",
				);
			}

			const elapsed = Date.now() - lastRequestTime;

			if (elapsed < minimumIntervalMs) {
				await new Promise((resolve) =>
					setTimeout(resolve, minimumIntervalMs - elapsed),
				);
			}

			lastRequestTime = Date.now();
			dailyCount += 1;

			return fetch(url);
		});

		// Prevent one failed request from permanently blocking the queue.
		queue = request.then(
			() => undefined,
			() => undefined,
		);

		return request;
	};
}
