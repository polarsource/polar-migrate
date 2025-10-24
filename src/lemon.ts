import {
	getAuthenticatedUser,
	lemonSqueezySetup,
	listDiscounts,
	listFiles,
	listProducts,
	listStores,
	listVariants,
} from '@lemonsqueezy/lemonsqueezy.js';

export const createLemonClient = (apiKey: string) => {
	lemonSqueezySetup({
		apiKey,
		onError: error => {
			console.error('Error!', error);
		},
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
