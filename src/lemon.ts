import {
	lemonSqueezySetup,
	getAuthenticatedUser,
	listProducts,
	listStores,
	listDiscounts,
	listFiles,
	listVariants,
} from "@lemonsqueezy/lemonsqueezy.js";

export const createLemonClient = async (apiKey: string) => {
	await lemonSqueezySetup({
		apiKey,
		onError: (error) => console.error("Error!", error),
	});

	return {
		getAuthenticatedUser,
		listStores,
		listProducts,
		listDiscounts,
		listFiles,
		listVariants,
	};
};
